"""Normalizer — turns raw rows into domain entities using a Mapping.

The Mapping is a plain dict of correspondences applied deterministically.
The AI never executes this code; it only produces the mapping.

A TraceLab JSONL row represents ONE LLM round within a session. Multiple
rows share the same `external_session_id`. The Normalizer groups rows by
session so that one session -> many model_calls -> many tool_calls.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
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
                    agent=_get(data, smap, "agent"),
                    model=_get(data, smap, "model"),
                    started_at=_get(data, smap, "started_at"),
                    ended_at=_get(data, smap, "ended_at"),
                    metadata={},
                )
                session_cache[ext_str] = session
                sessions.append(session)

            pt = _get(data, mmap, "prompt_tokens")
            ct = _get(data, mmap, "completion_tokens")
            call = ModelCall(
                id=new_id(),
                session_id=session.id,
                round_index=int(_get(data, mmap, "round_index") or 0),
                model=_get(data, mmap, "model"),
                prompt_tokens=int(pt) if pt is not None else None,
                completion_tokens=int(ct) if ct is not None else None,
                cache_creation_tokens=_get(data, mmap, "cache_creation_tokens"),
                latency_ms=_get(data, mmap, "latency_ms"),
                is_error=bool(_get(data, mmap, "is_error") or False),
                occurred_at=_get(data, mmap, "occurred_at"),
                raw_payload=data,
            )
            model_calls.append(call)

            tools = data.get(tmap.get("tools_path", "tools")) or []
            for t in tools:
                tool_calls.append(
                    ToolCall(
                        id=new_id(),
                        session_id=session.id,
                        model_call_id=call.id,
                        tool_name=str(t.get(tmap.get("tool_name", "tool_name"), "")),
                        input_chars=t.get(tmap.get("input_chars", "input_chars")),
                        result_chars=t.get(tmap.get("result_chars", "result_chars")),
                        wall_latency_ms=t.get(
                            tmap.get("wall_latency_ms", "tool_wall_latency_ms")
                        ),
                        internal_latency_ms=t.get(
                            tmap.get("internal_latency_ms", "tool_internal_latency_ms")
                        ),
                        is_error=bool(t.get(tmap.get("is_error", "is_error"), False)),
                        occurred_at=t.get(tmap.get("occurred_at", "emitted_at")),
                    )
                )

        return NormalizedBatch(sessions, model_calls, tool_calls)


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
