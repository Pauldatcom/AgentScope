"""Seed data — TraceLab source + mapping, created at startup if absent.

This is configuration, not code. The mapping is a plain dict applied by the
deterministic import engine. The AI never writes to the DB.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from .entities import Mapping, Source, new_id

TRACELAB_SOURCE_ID = UUID("00000000-0000-0000-0000-000000000001")

TRACELAB_SOURCE = Source(
    id=TRACELAB_SOURCE_ID,
    name="tracelab",
    version="v0.0.1",
    retrieved_at=datetime(2026, 9, 7),
    method="github release download (scripts/fetch_sample.sh)",
    license="CC-BY-4.0",
)

TRACELAB_MAPPING: dict[str, Any] = {
    "session": {
        "external_session_id": "session_id",
        "agent": "provider",
        "model": "model",
    },
    "model_call": {
        "round_index": "round_index",
        "model": "model",
        "prompt_tokens": "input_tokens_total",
        "completion_tokens": "output_tokens",
        "cache_creation_tokens": "claude_cache_creation_input_tokens",
        "occurred_at": None,
    },
    "tool_call": {
        "tools_path": "tools",
        "tool_name": "tool_name",
        "input_chars": "input_chars",
        "result_chars": "result_chars",
        "wall_latency_ms": "tool_wall_latency_ms",
        "internal_latency_ms": "tool_internal_latency_ms",
        "is_error": "is_error",
        "occurred_at": "emitted_at",
    },
}

TRACELAB_MAPPING_ENTITY = Mapping(
    id=new_id(),
    source_id=TRACELAB_SOURCE_ID,
    version=1,
    mapping=TRACELAB_MAPPING,
    created_by="seed",
    is_active=True,
)


def seed_defaults(uow) -> None:
    """Create the TraceLab source + mapping if they don't exist."""

    if uow.sources.get_source(TRACELAB_SOURCE_ID) is None:
        uow.sources.add_source(TRACELAB_SOURCE)
    if uow.mappings.get_active_mapping(TRACELAB_SOURCE_ID) is None:
        uow.mappings.add_mapping(TRACELAB_MAPPING_ENTITY)
