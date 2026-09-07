"""E2E — full analyse -> validate -> import pipeline using the FakeAgent."""

from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from agentscope.adapters.files.jsonl_reader import JsonlReader
from agentscope.adapters.ia.fake.agent import FakeAgent
from agentscope.application.analyze_unknown import AnalyzeUseCase
from agentscope.application.apply_mapping import ApplyMappingUseCase


def _write_jsonl(tmp_path: Path, rows: list[dict]) -> Path:
    p = tmp_path / "trace.jsonl"
    p.write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")
    return p


def test_analyze_then_apply_with_fake_agent(tmp_path: Path):
    rows = [
        {
            "session_id": "sess-1",
            "provider": "claude",
            "model": "claude-3-5-sonnet",
            "round_id": 0,
            "input_tokens": 1234,
            "output_tokens": 56,
            "tools": [{"tool_name": "bash", "tool_wall_latency_ms": 10}],
        },
        {
            "session_id": "sess-2",
            "provider": "codex",
            "model": "gpt-4o",
            "round_id": 0,
            "input_tokens": 500,
            "output_tokens": 12,
            "tools": [{"tool_name": "edit", "tool_wall_latency_ms": 5}],
        },
    ]
    path = _write_jsonl(tmp_path, rows)

    reader = JsonlReader()
    agent = FakeAgent()
    analyze = AnalyzeUseCase(reader=reader, agent=agent)
    result = analyze.execute(str(path), sample_size=5)
    assert result.proposal.fields, "FakeAgent must propose a mapping"

    mapping = {
        "session": {
            "external_session_id": "session_id",
            "model": "provider",
        },
        "model_call": {
            "round_index": "round_id",
            "prompt_tokens": "input_tokens",
            "completion_tokens": "output_tokens",
        },
        "tool_call": {
            "tools_path": "tools",
            "tool_name": "tool_name",
            "wall_latency_ms": "tool_wall_latency_ms",
        },
    }
    apply = ApplyMappingUseCase(reader=reader)
    apply_result = apply.preview(
        str(path), mapping,
        source_id=uuid4(), import_run_id=uuid4(), preview_rows=5,
    )
    assert apply_result.is_valid
    assert apply_result.preview is not None
    assert len(apply_result.preview) == 2


def test_invalid_mapping_is_refused_with_explanation(tmp_path: Path):
    rows = [{"session_id": "x"}]
    path = _write_jsonl(tmp_path, rows)
    reader = JsonlReader()
    apply = ApplyMappingUseCase(reader=reader)
    bad = {"session": {}}
    result = apply.preview(
        str(path), bad,
        source_id=uuid4(), import_run_id=uuid4(),
    )
    assert not result.is_valid
    assert result.errors
    assert any("external_session_id" in e for e in result.errors)
