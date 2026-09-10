"""Unit test for the Normalizer with the TraceLab mapping."""

from __future__ import annotations

from uuid import uuid4

from agentscope.domain.contracts.file_reader import RawRow
from agentscope.domain.services import Normalizer

TRACELAB_MAPPING = {
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
    },
    "tool_call": {
        "tools_path": "tools",
        "tool_name": "tool_name",
        "wall_latency_ms": "tool_wall_latency_ms",
        "is_error": "is_error",
    },
}


def test_normalizer_groups_rows_by_session():
    """Two rounds from the same session -> one session, two model_calls."""

    source_id = uuid4()
    import_run_id = uuid4()
    rows = [
        RawRow(
            line_number=1,
            data={
                "session_id": "sess-abc",
                "provider": "claude",
                "model": "claude-3-5",
                "round_index": 0,
                "input_tokens_total": 100,
                "output_tokens": 50,
                "claude_cache_creation_input_tokens": 80,
                "tools": [{"tool_name": "Bash", "tool_wall_latency_ms": 100}],
            },
        ),
        RawRow(
            line_number=2,
            data={
                "session_id": "sess-abc",
                "provider": "claude",
                "model": "claude-3-5",
                "round_index": 1,
                "input_tokens_total": 200,
                "output_tokens": 30,
                "claude_cache_creation_input_tokens": 150,
                "tools": [],
            },
        ),
        RawRow(
            line_number=3,
            data={
                "session_id": "sess-xyz",
                "provider": "codex",
                "model": "gpt-4o",
                "round_index": 0,
                "input_tokens_total": 500,
                "output_tokens": 10,
                "claude_cache_creation_input_tokens": None,
                "tools": [
                    {"tool_name": "Edit", "tool_wall_latency_ms": 50, "is_error": True}
                ],
            },
        ),
    ]

    batch = Normalizer().normalize(
        rows, TRACELAB_MAPPING, source_id=source_id, import_run_id=import_run_id
    )

    assert len(batch.sessions) == 2
    assert len(batch.model_calls) == 3
    assert len(batch.tool_calls) == 2

    sess_abc = [s for s in batch.sessions if s.external_session_id == "sess-abc"][0]
    sess_xyz = [s for s in batch.sessions if s.external_session_id == "sess-xyz"][0]
    assert sess_abc.agent == "claude"
    assert sess_xyz.agent == "codex"

    abc_calls = [c for c in batch.model_calls if c.session_id == sess_abc.id]
    assert len(abc_calls) == 2
    assert abc_calls[0].prompt_tokens == 100
    assert abc_calls[1].prompt_tokens == 200

    xyz_calls = [c for c in batch.model_calls if c.session_id == sess_xyz.id]
    assert len(xyz_calls) == 1
    assert xyz_calls[0].cache_creation_tokens is None

    abc_tools = [t for t in batch.tool_calls if t.session_id == sess_abc.id]
    assert len(abc_tools) == 1
    assert abc_tools[0].tool_name == "Bash"

    xyz_tools = [t for t in batch.tool_calls if t.session_id == sess_xyz.id]
    assert len(xyz_tools) == 1
    assert xyz_tools[0].is_error is True


def test_normalizer_skips_rows_without_session_id():
    source_id = uuid4()
    import_run_id = uuid4()
    rows = [
        RawRow(line_number=1, data={"no_session": "here"}),
        RawRow(
            line_number=2,
            data={
                "session_id": "s-1",
                "provider": "claude",
                "model": "m",
                "round_index": 0,
                "tools": [],
            },
        ),
    ]
    batch = Normalizer().normalize(
        rows, TRACELAB_MAPPING, source_id=source_id, import_run_id=import_run_id
    )
    assert len(batch.sessions) == 1
    assert len(batch.model_calls) == 1


SWECHAT_MAPPING = {
    "session": {
        "external_session_id": "session_id",
        "agent": "agent",
        "model": "model",
    },
    "model_call": {
        "round_index": "turn_number",
        "model": "model",
        "prompt_tokens": "input_tokens",
        "completion_tokens": "output_tokens",
        "cache_creation_tokens": "cache_creation_input_tokens",
    },
    "tool_call": {
        "tool_name": "tool_name",
    },
}


def test_normalizer_flat_tool_column():
    """Conversation-style rows: tool_name sits on the row, not in a nested list."""

    source_id = uuid4()
    import_run_id = uuid4()
    rows = [
        RawRow(
            line_number=1,
            data={
                "session_id": "s-aaa",
                "agent": "Claude Code",
                "model": "claude-sonnet-4",
                "turn_number": 0,
                "input_tokens": 100,
                "output_tokens": 20,
                "cache_creation_input_tokens": 40,
                "tool_name": None,
            },
        ),
        RawRow(
            line_number=2,
            data={
                "session_id": "s-aaa",
                "agent": "Claude Code",
                "model": "claude-sonnet-4",
                "turn_number": 1,
                "input_tokens": None,
                "output_tokens": None,
                "cache_creation_input_tokens": None,
                "tool_name": "Read",
            },
        ),
        RawRow(
            line_number=3,
            data={
                "session_id": "s-bbb",
                "agent": "Gemini CLI",
                "model": "gemini-2.5-pro",
                "turn_number": 0,
                "input_tokens": 50,
                "output_tokens": 10,
                "cache_creation_input_tokens": None,
                "tool_name": "read_file",
            },
        ),
    ]

    batch = Normalizer().normalize(
        rows, SWECHAT_MAPPING, source_id=source_id, import_run_id=import_run_id
    )

    assert len(batch.sessions) == 2
    assert len(batch.model_calls) == 3
    assert len(batch.tool_calls) == 2
    assert {t.tool_name for t in batch.tool_calls} == {"Read", "read_file"}

    first = [c for c in batch.model_calls if c.round_index == 0 and c.prompt_tokens == 100]
    assert len(first) == 1
    assert first[0].cache_creation_tokens == 40

    missing_tokens = [c for c in batch.model_calls if c.prompt_tokens is None]
    assert len(missing_tokens) == 1
    assert missing_tokens[0].completion_tokens is None


def test_normalizer_parses_iso_timestamps():
    source_id = uuid4()
    import_run_id = uuid4()
    mapping = {
        "session": {
            "external_session_id": "session_id",
            "started_at": "timestamp",
        },
        "model_call": {"occurred_at": "timestamp"},
        "tool_call": {},
    }
    rows = [
        RawRow(
            line_number=1,
            data={
                "session_id": "s-1",
                "timestamp": "2025-06-01T10:00:00Z",
            },
        )
    ]
    batch = Normalizer().normalize(
        rows, mapping, source_id=source_id, import_run_id=import_run_id
    )
    assert batch.sessions[0].started_at is not None
    assert batch.sessions[0].started_at.year == 2025
    assert batch.model_calls[0].occurred_at is not None
    assert batch.model_calls[0].occurred_at.tzinfo is not None
