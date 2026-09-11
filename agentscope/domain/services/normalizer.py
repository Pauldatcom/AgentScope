"""Normalizer — turns raw rows into domain entities using a Mapping.

The Mapping is a plain dict of correspondences applied deterministically.
The AI never executes this code; it only produces the mapping.

A TraceLab JSONL row represents ONE LLM round within a session. Multiple
rows share the same `external_session_id`. The Normalizer groups rows by
session so that one session -> many model_calls -> many tool_calls.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from ..contracts.file_reader import RawRow
from ..entities import ModelCall, Session, ToolCall, new_id


@dataclass(frozen=True)
class NormalizedBatch:
    sessions: list[Session]
    model_calls: list[ModelCall]
    tool_calls: list[ToolCall]


class Normalizer:
    """Apply a mapping to raw rows and produce normalized entities."""

    def normalize(
        self,
        rows: Iterable[RawRow],
        mapping: dict[str, Any],
        *,
        source_id: UUID,
        import_run_id: UUID,
    ) -> NormalizedBatch:
        sessions: list[Session] = []
        model_calls: list[ModelCall] = []
        tool_calls: list[ToolCall] = []

        smap = mapping.get("session", {})
        mmap = mapping.get("model_call", {})
        tmap = mapping.get("tool_call", {})

        # Group rows by external_session_id so one session -> many rounds.
        session_cache: dict[str, Session] = {}

        for row in rows:
            data = row.data

            ext = _get(data, smap, "external_session_id")
            if ext is None:
                continue

            ext_str = str(ext)
            session = session_cache.get(ext_str)
            if session is None:
                session = Session(
                    id=new_id(),
                    source_id=source_id,
                    import_run_id=import_run_id,
                    external_session_id=ext_str,
                    agent=_as_str(_get(data, smap, "agent")),
                    model=_as_str(_get(data, smap, "model")),
                    started_at=_as_datetime(_get(data, smap, "started_at")),
                    ended_at=_as_datetime(_get(data, smap, "ended_at")),
                    metadata={},
                )
                session_cache[ext_str] = session
                sessions.append(session)

            pt = _get(data, mmap, "prompt_tokens")
            ct = _get(data, mmap, "completion_tokens")
            call = ModelCall(
                id=new_id(),
                session_id=session.id,
                round_index=_as_int(_get(data, mmap, "round_index")) or 0,
                model=_as_str(_get(data, mmap, "model")),
                prompt_tokens=_as_int(pt),
                completion_tokens=_as_int(ct),
                cache_creation_tokens=_as_int(_get(data, mmap, "cache_creation_tokens")),
                latency_ms=_as_int(_get(data, mmap, "latency_ms")),
                is_error=_as_bool(_get(data, mmap, "is_error")),
                occurred_at=_as_datetime(_get(data, mmap, "occurred_at")),
                raw_payload=data,
            )
            model_calls.append(call)

            tools = _tool_records(data, tmap)
            name_key = tmap.get("tool_name", "tool_name")
            for t in tools:
                tool_name = _as_str(t.get(name_key))
                if not tool_name:
                    continue
                tool_calls.append(
                    ToolCall(
                        id=new_id(),
                        session_id=session.id,
                        model_call_id=call.id,
                        tool_name=tool_name,
                        input_chars=_as_int(t.get(tmap.get("input_chars", "input_chars"))),
                        result_chars=_as_int(
                            t.get(tmap.get("result_chars", "result_chars"))
                        ),
                        wall_latency_ms=_as_int(
                            t.get(tmap.get("wall_latency_ms", "tool_wall_latency_ms"))
                        ),
                        internal_latency_ms=_as_int(
                            t.get(tmap.get("internal_latency_ms", "tool_internal_latency_ms"))
                        ),
                        is_error=_as_bool(t.get(tmap.get("is_error", "is_error"))),
                        occurred_at=_as_datetime(
                            t.get(tmap.get("occurred_at", "emitted_at"))
                        ),
                    )
                )

        return NormalizedBatch(
            _derive_session_bounds(sessions, model_calls),
            model_calls,
            tool_calls,
        )


def _tool_records(data: dict[str, Any], tmap: dict[str, Any]) -> list[dict[str, Any]]:
    """Resolve tool rows from either a nested list or a flat column on the record.

    Nested traces (TraceLab) set ``tools_path`` to an array of tool objects.
    Flat tables (SWE-chat conversations, CSV) omit ``tools_path`` and put
    ``tool_name`` on the same row; those rows become a single tool record.
    """

    nested_path = tmap.get("tools_path") or ""
    if nested_path:
        raw = data.get(nested_path)
        if isinstance(raw, list):
            return [t for t in raw if isinstance(t, dict)]
        return []

    name_key = tmap.get("tool_name")
    if not name_key:
        return []
    value = _get(data, tmap, "tool_name")
    if _is_missing(value):
        return []
    return [data]


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    try:
        if value != value:
            return True
    except Exception:
        return True
    return False


def _as_str(value: Any) -> str | None:
    if _is_missing(value):
        return None
    text = str(value).strip()
    return text or None


def _as_int(value: Any) -> int | None:
    if _is_missing(value):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_bool(value: Any) -> bool:
    if _is_missing(value):
        return False
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    return bool(value)


def _as_datetime(value: Any) -> datetime | None:
    if _is_missing(value):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, int | float):
        return _epoch_to_datetime(value)
    if isinstance(value, str):
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return None
    return None


def _epoch_to_datetime(value: int | float) -> datetime | None:
    """Convert an epoch timestamp to a timezone-aware datetime.

    Heuristic: values >= 10**12 are treated as milliseconds (covers 2001+),
    smaller values as seconds.
    """
    if value >= 10**12:
        value = value / 1000
    try:
        return datetime.fromtimestamp(value, tz=UTC)
    except (OverflowError, OSError, ValueError):
        return None


def _derive_session_bounds(
    sessions: list[Session], model_calls: list[ModelCall]
) -> list[Session]:
    """Set started_at/ended_at on sessions from their model_calls when not
    explicitly mapped."""
    calls_by_session: dict[UUID, list[ModelCall]] = {}
    for call in model_calls:
        calls_by_session.setdefault(call.session_id, []).append(call)

    updated: list[Session] = []
    for session in sessions:
        calls = calls_by_session.get(session.id, [])
        timestamps = [
            c.occurred_at for c in calls if c.occurred_at is not None
        ]
        if not timestamps:
            updated.append(session)
            continue
        started = min(timestamps) if session.started_at is None else session.started_at
        ended = max(timestamps) if session.ended_at is None else session.ended_at
        if started is session.started_at and ended is session.ended_at:
            updated.append(session)
        else:
            updated.append(replace(session, started_at=started, ended_at=ended))
    return updated


def _get(data: dict[str, Any], mapping: dict[str, Any], field: str) -> Any:
    path = mapping.get(field)
    if path is None:
        return None
    cur: Any = data
    for part in str(path).split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur
