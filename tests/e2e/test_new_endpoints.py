"""E2E tests for the new dashboard endpoints — agents, tools, models, etc.

Uses the same InMemoryUoW + FastAPI TestClient pattern as test_api_pipeline.
No Postgres, no network, no real AI.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from agentscope.api.main import create_app
from fastapi.testclient import TestClient

from tests.fakes.in_memory_uow import InMemoryUoWFactory

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
        "session_id": "agg-sess-1",
        "provider": "claude",
        "model": "claude-3-5-sonnet",
        "round_index": 0,
        "input_tokens_total": 1500,
        "output_tokens": 200,
        "tools": [{"tool_name": "Bash", "tool_wall_latency_ms": 100}],
    },
    {
        "session_id": "agg-sess-1",
        "provider": "claude",
        "model": "claude-3-5-sonnet",
        "round_index": 1,
        "input_tokens_total": 3000,
        "output_tokens": 50,
        "tools": [],
    },
    {
        "session_id": "agg-sess-2",
        "provider": "codex",
        "model": "gpt-4o",
        "round_index": 0,
        "input_tokens_total": 500,
        "output_tokens": 10,
        "tools": [{"tool_name": "Edit", "tool_wall_latency_ms": 50}],
    },
]


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

    # Set app.state.settings for the settings router (lifespan doesn't run
    # outside a `with TestClient` context, but the fixture returns the client
    # for all tests — set it manually here).
    from agentscope.config import get_settings

    app.state.settings = get_settings()

    client = TestClient(app)

    # Import data via the HTTP endpoint (same pattern as test_api_pipeline).
    import tempfile

    fd, tmp_path = tempfile.mkstemp(suffix=".jsonl")
    os.write(fd, "\n".join(json.dumps(r) for r in _TRACELAB_ROWS).encode())
    os.close(fd)
    source_id = "00000000-0000-0000-0000-000000000001"
    with open(tmp_path, "rb") as f:
        client.post(
            "/imports/upload",
            data={
                "source_id": source_id,
                "mapping_json": json.dumps(_TRACELAB_MAPPING),
            },
            files={"file": ("trace.jsonl", f, "application/octet-stream")},
        )
    os.unlink(tmp_path)

    return client


def test_agents_endpoint_returns_breakdown(client):
    r = client.get("/agents")
    assert r.status_code == 200
    agents = r.json()
    assert len(agents) >= 2
    names = {a["name"] for a in agents}
    assert "claude" in names
    assert "codex" in names
    claude = next(a for a in agents if a["name"] == "claude")
    assert claude["sessions"] == 1
    assert claude["total_tokens"] is not None
    assert claude["total_tokens"] > 0
    assert claude["tool_calls"] >= 1


def test_tools_endpoint_returns_breakdown(client):
    r = client.get("/tools")
    assert r.status_code == 200
    tools = r.json()
    assert len(tools) >= 2
    names = {t["name"] for t in tools}
    assert "Bash" in names
    assert "Edit" in names
    bash = next(t for t in tools if t["name"] == "Bash")
    assert bash["calls"] == 1
    assert bash["sessions"] == 1
    assert bash["p50_ms"] is not None


def test_models_endpoint_returns_breakdown(client):
    r = client.get("/models")
    assert r.status_code == 200
    models = r.json()
    assert len(models) >= 2
    names = {m["name"] for m in models}
    assert "claude-3-5-sonnet" in names
    assert "gpt-4o" in names
    claude = next(m for m in models if m["name"] == "claude-3-5-sonnet")
    assert claude["total_tokens"] == 1500 + 200 + 3000 + 50
    assert claude["sessions"] == 1
    assert claude["requests"] == 2


def test_imports_list_returns_runs(client):
    r = client.get("/imports")
    assert r.status_code == 200
    imports = r.json()
    assert len(imports) >= 1
    imp = imports[0]
    assert "filename" in imp
    assert "status" in imp
    assert "created_at" in imp


def test_data_quality_endpoint(client):
    r = client.get("/data-quality")
    assert r.status_code == 200
    dq = r.json()
    assert dq["total_sessions"] >= 2
    assert dq["with_tokens"] >= 2
    assert dq["tokens_coverage"] is not None
    assert dq["tokens_coverage"] > 0
    assert "sources" in dq
    assert "imports" in dq
    assert "rejections" in dq
    assert len(dq["sources"]) >= 1


def test_settings_endpoint(client):
    r = client.get("/settings")
    assert r.status_code == 200
    s = r.json()
    assert "app_env" in s
    assert "ia_provider" in s
    assert "ia_model" in s
    assert s["database_url"] == ""  # masked


def test_activity_endpoint(client):
    r = client.get("/activity")
    assert r.status_code == 200
    buckets = r.json()
    # The TraceLab test data doesn't map started_at/occurred_at, so the
    # activity timeseries may be empty. The endpoint itself must still return 200.
    assert isinstance(buckets, list)
    if buckets:
        bucket = buckets[0]
        assert "bucket" in bucket
        assert "sessions" in bucket
        assert "total_tokens" in bucket
        assert bucket["sessions"] >= 1


def test_dashboard_has_avg_duration_and_cache_rate(client):
    r = client.get("/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "avg_duration" in data["indicators"]
    assert "cache_rate" in data["indicators"]
    assert data["indicators"]["avg_duration"]["total"] >= 2
    assert data["indicators"]["cache_rate"]["total"] >= 2


def test_sessions_list_has_enriched_fields(client):
    r = client.get("/sessions")
    assert r.status_code == 200
    sessions = r.json()
    assert len(sessions) >= 2
    s = sessions[0]
    assert "duration_ms" in s
    assert "total_tokens" in s
    assert "tool_calls" in s
    assert "errors" in s
    assert "status" in s
    assert "quality" in s
    assert s["total_tokens"] is not None
    assert s["total_tokens"] > 0
    assert s["status"] in ("completed", "completed_with_errors", "error")
    assert s["quality"] in ("complete", "partial", "incomplete")
