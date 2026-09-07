"""E2E test — import an unknown structure (Trace Commons-like) without code changes.

The mapping assistant handles any JSONL shape: the AI proposes a mapping,
the user edits it, the deterministic engine applies it. No connector is
coded for this source — everything goes through configuration.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from agentscope.adapters.ia.fake.agent import FakeAgent
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
    app.state.mapping_agent = FakeAgent()

    def file_reader_for(path: str):
        ext = Path(path).suffix.lower()
        if ext == ".jsonl":
            from agentscope.adapters.files.jsonl_reader import JsonlReader

            return JsonlReader()
        raise ValueError(f"Unsupported: {ext}")

    app.state.file_reader_for = file_reader_for
    return TestClient(app)


# A Trace Commons-like structure — completely different field names and nesting.
# No "session_id", no "provider", no "tools" array. The mapping assistant must
# figure out the correspondences.
_UNKNOWN_ROWS = [
    {
        "trace_id": "tc-001",
        "agent_name": "aider",
        "llm_model": "gpt-4o",
        "interaction_seq": 0,
        "input_token_count": 1200,
        "output_token_count": 45,
        "tool_invocations": [
            {"tool": "replace_in_file", "duration_ms": 230, "failed": False}
        ],
    },
    {
        "trace_id": "tc-002",
        "agent_name": "cline",
        "llm_model": "claude-3-5-sonnet",
        "interaction_seq": 0,
        "input_token_count": 800,
        "output_token_count": 200,
        "tool_invocations": [
            {"tool": "execute_command", "duration_ms": 1500, "failed": True}
        ],
    },
]


def test_analyze_unknown_structure_profiles_fields(client, tmp_path):
    """The mapping assistant profiles an unknown structure and proposes a mapping."""

    path = tmp_path / "trace_commons.jsonl"
    path.write_text(
        "\n".join(json.dumps(r) for r in _UNKNOWN_ROWS), encoding="utf-8"
    )

    with open(str(path), "rb") as f:
        r = client.post(
            "/mappings/analyze",
            data={"sample_size": "5"},
            files={"file": ("trace_commons.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["row_count"] == 2
    assert "trace_id" in data["fields"]
    assert "agent_name" in data["fields"]
    assert "llm_model" in data["fields"]
    assert len(data["profiles"]) >= 5


def test_apply_custom_mapping_to_unknown_structure(client, tmp_path):
    """A user-defined mapping is applied to the unknown structure and produces normalized entities."""

    path = tmp_path / "trace_commons.jsonl"
    path.write_text(
        "\n".join(json.dumps(r) for r in _UNKNOWN_ROWS), encoding="utf-8"
    )

    custom_mapping = {
        "session": {
            "external_session_id": "trace_id",
            "agent": "agent_name",
            "model": "llm_model",
        },
        "model_call": {
            "round_index": "interaction_seq",
            "model": "llm_model",
            "prompt_tokens": "input_token_count",
            "completion_tokens": "output_token_count",
        },
        "tool_call": {
            "tools_path": "tool_invocations",
            "tool_name": "tool",
            "wall_latency_ms": "duration_ms",
            "is_error": "failed",
        },
    }

    with open(str(path), "rb") as f:
        r = client.post(
            "/mappings/apply",
            data={
                "source_id": "00000000-0000-0000-0000-000000000001",
                "mapping_json": json.dumps(custom_mapping),
                "preview_rows": "5",
            },
            files={"file": ("trace_commons.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_valid"] is True
    assert data["preview"] is not None
    assert len(data["preview"]) == 2
    # The first session should map trace_id -> external_session_id
    assert data["preview"][0]["session"]["external_session_id"] == "tc-001"
    assert data["preview"][0]["session"]["agent"] == "aider"


def test_import_unknown_structure_with_custom_mapping(client, tmp_path):
    """Full import: unknown file -> custom mapping -> import -> dashboard shows real data."""

    # Create a new source for this unknown dataset
    source_resp = client.post(
        "/sources",
        json={
            "name": "trace-commons",
            "version": "v0.1",
            "method": "huggingface download",
        },
    )
    assert source_resp.status_code == 200
    source_id = source_resp.json()["id"]

    path = tmp_path / "trace_commons.jsonl"
    path.write_text(
        "\n".join(json.dumps(r) for r in _UNKNOWN_ROWS), encoding="utf-8"
    )

    custom_mapping = {
        "session": {
            "external_session_id": "trace_id",
            "agent": "agent_name",
            "model": "llm_model",
        },
        "model_call": {
            "round_index": "interaction_seq",
            "model": "llm_model",
            "prompt_tokens": "input_token_count",
            "completion_tokens": "output_token_count",
        },
        "tool_call": {
            "tools_path": "tool_invocations",
            "tool_name": "tool",
            "wall_latency_ms": "duration_ms",
            "is_error": "failed",
        },
    }

    with open(str(path), "rb") as f:
        r = client.post(
            "/imports/upload",
            data={
                "source_id": source_id,
                "mapping_json": json.dumps(custom_mapping),
            },
            files={"file": ("trace_commons.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["status"] == "ok"
    assert report["sessions_imported"] == 2
    assert report["model_calls_imported"] == 2
    assert report["tool_calls_imported"] == 2

    # Dashboard should now show data from this source
    r2 = client.get("/dashboard", params={"source_id": source_id})
    assert r2.status_code == 200
    dashboard = r2.json()
    assert len(dashboard["indicators"]["sessions_by_agent"]) >= 1
