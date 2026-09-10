"""E2E tests for the mapping assistant endpoints — analyze + apply + save."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from agentscope.api.main import create_app
from agentscope.domain.seed import TRACELAB_SOURCE_ID
from fastapi.testclient import TestClient

from tests.fakes.in_memory_uow import InMemoryUoWFactory


@pytest.fixture
def client():
    os.environ["IA_PROVIDER"] = "fake"
    os.environ["OPENROUTER_API_KEY"] = ""
    app = create_app()
    uow_factory = InMemoryUoWFactory(seed=True)
    uow_factory.make_shared()
    app.state.uow_factory = uow_factory
    from agentscope.adapters.ia.fake.agent import FakeAgent

    app.state.mapping_agent = FakeAgent()

    def file_reader_for(path: str):
        ext = Path(path).suffix.lower()
        if ext in {".jsonl", ".json"}:
            from agentscope.adapters.files.jsonl_reader import JsonlReader

            return JsonlReader()
        raise ValueError(f"Unsupported: {ext}")

    app.state.file_reader_for = file_reader_for
    return TestClient(app)


_SAMPLE_ROWS = [
    {
        "session_id": "analyze-1",
        "provider": "claude",
        "model": "claude-3-5",
        "round_index": 0,
        "input_tokens_total": 100,
        "output_tokens": 20,
        "tools": [{"tool_name": "Bash", "tool_wall_latency_ms": 50}],
    },
    {
        "session_id": "analyze-2",
        "provider": "codex",
        "model": "gpt-4o",
        "round_index": 0,
        "input_tokens_total": 200,
        "output_tokens": 30,
        "tools": [],
    },
]


def test_analyze_unknown_file_returns_proposal(client, tmp_path):
    path = tmp_path / "unknown.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in _SAMPLE_ROWS), encoding="utf-8")

    with open(str(path), "rb") as f:
        r = client.post(
            "/mappings/analyze",
            data={"sample_size": "5"},
            files={"file": ("unknown.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["row_count"] == 2
    assert len(data["fields"]) > 0
    assert "proposal" in data
    assert "fields" in data["proposal"]
    assert len(data["proposal"]["fields"]) > 0


def test_apply_valid_mapping_returns_preview(client, tmp_path):
    path = tmp_path / "trace.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in _SAMPLE_ROWS), encoding="utf-8")

    mapping = {
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
        },
        "tool_call": {
            "tools_path": "tools",
            "tool_name": "tool_name",
            "wall_latency_ms": "tool_wall_latency_ms",
        },
    }

    with open(str(path), "rb") as f:
        r = client.post(
            "/mappings/apply",
            data={
                "source_id": str(TRACELAB_SOURCE_ID),
                "mapping_json": json.dumps(mapping),
                "preview_rows": "5",
            },
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_valid"] is True
    assert data["preview"] is not None
    assert len(data["preview"]) == 2


def test_apply_invalid_mapping_is_rejected(client, tmp_path):
    path = tmp_path / "trace.jsonl"
    path.write_text(json.dumps(_SAMPLE_ROWS[0]), encoding="utf-8")

    bad = {"session": {}}
    with open(str(path), "rb") as f:
        r = client.post(
            "/mappings/apply",
            data={
                "source_id": str(TRACELAB_SOURCE_ID),
                "mapping_json": json.dumps(bad),
                "preview_rows": "5",
            },
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["is_valid"] is False
    assert any("external_session_id" in e for e in data["errors"])


def test_save_and_list_mapping(client):
    mapping = {
        "session": {"external_session_id": "session_id"},
        "model_call": {"round_index": "round_index"},
        "tool_call": {"tools_path": "tools"},
    }
    r = client.post(
        "/mappings",
        json={
            "source_id": str(TRACELAB_SOURCE_ID),
            "mapping": mapping,
            "created_by": "test",
        },
    )
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["mapping"] == mapping

    r2 = client.get("/mappings", params={"source_id": str(TRACELAB_SOURCE_ID)})
    assert r2.status_code == 200
    mappings = r2.json()
    assert len(mappings) >= 1


def test_list_mappings_without_source(client):
    r = client.get("/mappings")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
