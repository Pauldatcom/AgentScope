"""Domain entities.

Pure dataclasses describing the relational model shared by every source.
One row in each table has a precise meaning documented in `docs/data_model.md`.

- Session      one coding-agent session, identified by (source_id, external_session_id)
- ModelCall     one round of LLM invocation within a session (tokens, latency, cache)
- ToolCall      one tool invocation within a session, linked to the round that emitted it
- ImportRun    one file upload, identified by its sha256 hash (idempotence)
- Source       one dataset provenance (TraceLab, SWE-chat, Trace Commons, ...)
- Mapping      one reusable, versioned field-to-field correspondence for a source
- Rejection    one line rejected at import time, with its reason and excerpt
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4


@dataclass(frozen=True)
class Source:
    """A dataset provenance."""

    id: UUID
    name: str
    version: str
    retrieved_at: datetime
    method: str
    license: str | None = None


@dataclass(frozen=True)
class ImportRun:
    """One file upload attempt. `file_hash` guarantees idempotence."""

    id: UUID
    source_id: UUID
    filename: str
    file_hash: str
    status: str
    summary: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def key(self) -> str:
        """Natural key used for idempotence: the file hash."""

        return self.file_hash


@dataclass(frozen=True)
class Session:
    """One coding-agent session.

    Natural key: (source_id, external_session_id) — re-importing the same
    session from the same source must NOT create a duplicate row.
    """

    id: UUID
    source_id: UUID
    import_run_id: UUID
    external_session_id: str
    agent: str | None = None
    model: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def natural_key(self) -> tuple[UUID, str]:
        return (self.source_id, self.external_session_id)


@dataclass(frozen=True)
class ModelCall:
    """One round of LLM invocation within a session.

    `metric_available` flags metrics that genuinely do not exist for a source
    (e.g. cache tokens on Codex). They are NOT silently turned into zero.
    """

    id: UUID
    session_id: UUID
    round_index: int
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cache_creation_tokens: int | None = None
    latency_ms: int | None = None
    is_error: bool = False
    occurred_at: datetime | None = None
    raw_payload: dict[str, Any] = field(default_factory=dict)

    @property
    def total_tokens(self) -> int | None:
        """Prompt + completion tokens, or None if either is missing."""

        if self.prompt_tokens is None or self.completion_tokens is None:
            return None
        return self.prompt_tokens + self.completion_tokens

    @property
    def metric_available(self) -> bool:
        """True when the token/latency metrics exist for this round."""

        return self.prompt_tokens is not None or self.completion_tokens is not None


@dataclass(frozen=True)
class ToolCall:
    """One tool invocation within a session."""

    id: UUID
    session_id: UUID
    model_call_id: UUID | None
    tool_name: str
    input_chars: int | None = None
    result_chars: int | None = None
    wall_latency_ms: int | None = None
    internal_latency_ms: int | None = None
    is_error: bool = False
    occurred_at: datetime | None = None


@dataclass(frozen=True)
class Mapping:
    """A reusable, versioned field-to-field correspondence for a source.

    The `mapping` dict is applied by the deterministic import engine
    (`application.apply_mapping`); the AI never writes to the database.
    """

    id: UUID
    source_id: UUID
    version: int
    mapping: dict[str, Any]
    created_by: str
    validated_at: datetime | None = None
    is_active: bool = True


@dataclass(frozen=True)
class Rejection:
    """One line rejected at import time."""

    id: UUID
    import_run_id: UUID
    line_number: int
    reason: str
    excerpt: str


def new_id() -> UUID:
    """Generate a fresh UUID4 for a new entity."""

    return uuid4()
