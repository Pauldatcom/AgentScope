"""E2E API tests — full pipeline using FastAPI TestClient + InMemoryUoW.

No Postgres, no network, no real AI. Tests the complete flow:
sources -> imports -> dashboard -> sessions -> detail.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from agentscope.api.main import create_app
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
    app.state.mapping_agent = __import__(
        "agentscope.adapters.ia.fake.agent", fromlist=["FakeAgent"]
    ).FakeAgent()

    def file_reader_for(path: str):
        ext = Path(path).suffix.lower()
        if ext == ".jsonl":
            from agentscope.adapters.files.jsonl_reader import JsonlReader
            return JsonlReader()
        raise ValueError(f"Unsupported: {ext}")

    app.state.file_reader_for = file_reader_for
    return TestClient(app)


_TRACELAB_MAPPING = {
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

_TRACELAB_ROWS = [
    {
        "session_id": "api-sess-1",
        "provider": "claude",
        "model": "claude-3-5-sonnet",
        "round_index": 0,
        "input_tokens_total": 1500,
        "output_tokens": 200,
        "tools": [{"tool_name": "Bash", "tool_wall_latency_ms": 100}],
    },
    {
        "session_id": "api-sess-1",
        "provider": "claude",
        "model": "claude-3-5-sonnet",
        "round_index": 1,
        "input_tokens_total": 3000,
        "output_tokens": 50,
        "tools": [],
    },
    {
        "session_id": "api-sess-2",
        "provider": "codex",
        "model": "gpt-4o",
        "round_index": 0,
        "input_tokens_total": 500,
        "output_tokens": 10,
        "tools": [{"tool_name": "Edit", "tool_wall_latency_ms": 50}],
    },
]


def _write_jsonl(tmp_path: Path) -> str:
    p = tmp_path / "trace.jsonl"
    p.write_text("\n".join(json.dumps(r) for r in _TRACELAB_ROWS), encoding="utf-8")
    return str(p)


def test_sources_list_returns_seed(client):
    r = client.get("/sources")
    assert r.status_code == 200
    sources = r.json()
    assert any(s["name"] == "tracelab" for s in sources)


def test_import_then_dashboard_shows_real_data(client, tmp_path):
    path = _write_jsonl(tmp_path)

    source_id = "00000000-0000-0000-0000-000000000001"
    with open(path, "rb") as f:
        r = client.post(
            "/imports/upload",
            data={"source_id": source_id, "mapping_json": json.dumps(_TRACELAB_MAPPING)},
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["status"] == "ok"
    assert report["sessions_imported"] == 2
    assert report["model_calls_imported"] == 3
    assert report["tool_calls_imported"] == 2
    assert report["is_duplicate_run"] is False


def test_reimport_is_idempotent(client, tmp_path):
    path = _write_jsonl(tmp_path)
    source_id = "00000000-0000-0000-0000-000000000001"

    with open(path, "rb") as f:
        r1 = client.post(
            "/imports/upload",
            data={"source_id": source_id, "mapping_json": json.dumps(_TRACELAB_MAPPING)},
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )
    assert r1.status_code == 200
    assert r1.json()["is_duplicate_run"] is False

    with open(path, "rb") as f:
        r2 = client.post(
            "/imports/upload",
            data={"source_id": source_id, "mapping_json": json.dumps(_TRACELAB_MAPPING)},
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )
    assert r2.status_code == 200
    assert r2.json()["is_duplicate_run"] is True
    assert r2.json()["sessions_imported"] == 0


def test_dashboard_returns_indicators_with_real_data(client, tmp_path):
    path = _write_jsonl(tmp_path)
    source_id = "00000000-0000-0000-0000-000000000001"

    with open(path, "rb") as f:
        client.post(
            "/imports/upload",
            data={"source_id": source_id, "mapping_json": json.dumps(_TRACELAB_MAPPING)},
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )

    r = client.get("/dashboard")
    assert r.status_code == 200
    data = r.json()

    assert "tokens_by_model" in data["indicators"]
    tokens = data["indicators"]["tokens_by_model"]
    assert len(tokens) > 0
    by_model = {t["model"]: t for t in tokens}
    assert "claude-3-5-sonnet" in by_model
    assert by_model["claude-3-5-sonnet"]["total_tokens"] == 1500 + 200 + 3000 + 50

    assert "sessions_by_agent" in data["indicators"]
    agents = {a["agent"]: a["count"] for a in data["indicators"]["sessions_by_agent"]}
    assert agents.get("claude") == 1
    assert agents.get("codex") == 1

    assert "tool_distribution" in data["indicators"]
    tools = data["indicators"]["tool_distribution"]
    assert len(tools) >= 1

    assert "error_rate" in data["indicators"]
    assert data["indicators"]["error_rate"]["total"] == 2

    assert "definitions" in data
    assert len(data["definitions"]) >= 4


def test_session_detail_returns_calls_and_tools(client, tmp_path):
    path = _write_jsonl(tmp_path)
    source_id = "00000000-0000-0000-0000-000000000001"

    with open(path, "rb") as f:
        client.post(
            "/imports/upload",
            data={"source_id": source_id, "mapping_json": json.dumps(_TRACELAB_MAPPING)},
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )

    r = client.get("/sessions")
    assert r.status_code == 200
    sessions = r.json()
    assert len(sessions) == 2

    first_id = sessions[0]["id"]
    r2 = client.get(f"/sessions/{first_id}")
    assert r2.status_code == 200
    detail = r2.json()
    assert "session" in detail
    assert "model_calls" in detail
    assert "tool_calls" in detail
    assert len(detail["model_calls"]) >= 1


def test_invalid_mapping_is_rejected(client, tmp_path):
    path = tmp_path / "bad.jsonl"
    path.write_text('{"session_id": "x"}', encoding="utf-8")
    source_id = "00000000-0000-0000-0000-000000000001"

    bad_mapping = {"session": {}}
    with open(str(path), "rb") as f:
        r = client.post(
            "/imports/upload",
            data={"source_id": source_id, "mapping_json": json.dumps(bad_mapping)},
            files={"file": ("bad.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200
    report = r.json()
    assert report["status"] == "rejected"
