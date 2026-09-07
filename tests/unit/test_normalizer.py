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
