"""E2E — import a SWE-chat conversations extract from the API (no connector).

The conversations table is flat: one row per turn, tool_name on the same
record. The UI path is source -> analyze -> edited mapping -> import.
This test covers the same HTTP calls the Imports page makes.
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

# Schema-faithful fixture. Column names match SALT-NLP/SWE-chat conversations.
# Values are synthetic and are not Hugging Face rows.
_SWECHAT_ROWS = [
    {
        "turn_id": "t-1",
        "session_id": "s-aaa",
        "turn_number": 0,
        "role": "user",
        "turn_type": "user_prompt",
        "model": None,
        "input_tokens": None,
        "output_tokens": None,
        "cache_creation_input_tokens": None,
        "tool_name": None,
        "agent": "Claude Code",
        "timestamp": "2025-06-01T10:00:00Z",
    },
    {
        "turn_id": "t-2",
        "session_id": "s-aaa",
        "turn_number": 1,
        "role": "assistant",
        "turn_type": "assistant_response",
        "model": "claude-sonnet-4",
        "input_tokens": 1820,
        "output_tokens": 240,
        "cache_creation_input_tokens": 400,
        "tool_name": None,
        "agent": "Claude Code",
        "timestamp": "2025-06-01T10:00:02Z",
    },
    {
        "turn_id": "t-3",
        "session_id": "s-aaa",
        "turn_number": 2,
        "role": "tool_use",
        "turn_type": "tool_use",
        "model": "claude-sonnet-4",
        "input_tokens": None,
        "output_tokens": None,
        "cache_creation_input_tokens": None,
        "tool_name": "Read",
        "agent": "Claude Code",
        "timestamp": "2025-06-01T10:00:03Z",
    },
    {
        "turn_id": "t-4",
        "session_id": "s-bbb",
        "turn_number": 0,
        "role": "assistant",
        "turn_type": "assistant_response",
        "model": "gemini-2.5-pro",
        "input_tokens": 900,
        "output_tokens": 120,
        "cache_creation_input_tokens": None,
        "tool_name": None,
        "agent": "Gemini CLI",
        "timestamp": "2025-06-02T08:00:01Z",
    },
    {
        "turn_id": "t-5",
        "session_id": "s-bbb",
        "turn_number": 1,
        "role": "tool_use",
        "turn_type": "tool_use",
        "model": "gemini-2.5-pro",
        "input_tokens": None,
        "output_tokens": None,
        "cache_creation_input_tokens": None,
        "tool_name": "read_file",
        "agent": "Gemini CLI",
        "timestamp": "2025-06-02T08:00:02Z",
    },
]

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
        "occurred_at": "timestamp",
    },
    "tool_call": {
        "tool_name": "tool_name",
    },
}


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


def _write(tmp_path: Path) -> Path:
    path = tmp_path / "swechat_conversations.jsonl"
    path.write_text(
        "\n".join(json.dumps(r) for r in _SWECHAT_ROWS), encoding="utf-8"
    )
    return path


def test_analyze_swechat_proposes_conversation_mapping(client, tmp_path):
    path = _write(tmp_path)
    with open(path, "rb") as f:
        r = client.post(
            "/mappings/analyze",
            data={"sample_size": "10"},
            files={"file": ("swechat_conversations.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["row_count"] == 5
    assert "session_id" in data["fields"]
    assert "turn_number" in data["fields"]
    assert "tool_name" in data["fields"]
    targets = {f["target_field"]: f["source_field"] for f in data["proposal"]["fields"]}
    assert targets["external_session_id"] == "session_id"
    assert targets["round_index"] == "turn_number"
    assert targets["tool_name"] == "tool_name"
    assert "tools_path" not in targets


def test_apply_swechat_mapping_preview(client, tmp_path):
    path = _write(tmp_path)
    with open(path, "rb") as f:
        r = client.post(
            "/mappings/apply",
            data={
                "source_id": "00000000-0000-0000-0000-000000000001",
                "mapping_json": json.dumps(SWECHAT_MAPPING),
                "preview_rows": "10",
            },
            files={"file": ("swechat_conversations.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_valid"] is True
    assert data["preview"] is not None
    assert len(data["preview"]) == 2
    by_id = {p["session"]["external_session_id"]: p for p in data["preview"]}
    assert by_id["s-aaa"]["session"]["agent"] == "Claude Code"
    assert {t["tool_name"] for t in by_id["s-aaa"]["tool_calls"]} == {"Read"}
    tokens = [
        c["prompt_tokens"]
        for c in by_id["s-aaa"]["model_calls"]
        if c["prompt_tokens"] is not None
    ]
    assert tokens == [1820]


def test_import_swechat_via_new_source(client, tmp_path):
    source_resp = client.post(
        "/sources",
        json={
            "name": "swe-chat",
            "version": "hf-2026-09-10",
            "method": "huggingface SALT-NLP/SWE-chat conversations extract",
            "license": "dataset terms",
        },
    )
    assert source_resp.status_code == 200, source_resp.text
    source_id = source_resp.json()["id"]

    save = client.post(
        "/mappings",
        json={
            "source_id": source_id,
            "mapping": SWECHAT_MAPPING,
            "created_by": "ui",
        },
    )
    assert save.status_code == 200, save.text

    path = _write(tmp_path)
    with open(path, "rb") as f:
        r = client.post(
            "/imports/upload",
            data={
                "source_id": source_id,
                "mapping_json": json.dumps(SWECHAT_MAPPING),
            },
            files={"file": ("swechat_conversations.jsonl", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["status"] == "ok"
    assert report["sessions_imported"] == 2
    assert report["model_calls_imported"] == 5
    assert report["tool_calls_imported"] == 2

    dash = client.get("/dashboard", params={"source_id": source_id})
    assert dash.status_code == 200
    agents = {a["agent"] for a in dash.json()["indicators"]["sessions_by_agent"]}
    assert "Claude Code" in agents
    assert "Gemini CLI" in agents

    sessions = client.get("/sessions", params={"source_id": source_id})
    assert sessions.status_code == 200
    body = sessions.json()
    assert len(body) == 2
    claude = next(s for s in body if s["external_session_id"] == "s-aaa")
    assert claude["total_tokens"] == 1820 + 240
