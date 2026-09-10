"""Unit tests for the deterministic FakeAgent column matcher."""

from __future__ import annotations

from agentscope.adapters.ia.fake.agent import FakeAgent
from agentscope.domain.contracts import FieldProfile, FileSample


def _sample(fields: list[str]) -> tuple[FileSample, list[FieldProfile]]:
    row = {name: 1 for name in fields}
    sample = FileSample(fields=fields, rows=[row], row_count=1)
    profiles = [
        FieldProfile(
            name=name,
            inferred_type="str",
            non_null_ratio=1.0,
            distinct_values=1,
            examples=[row[name]],
        )
        for name in fields
    ]
    return sample, profiles


def test_fake_agent_matches_swechat_conversation_columns():
    sample, profiles = _sample(
        [
            "session_id",
            "agent",
            "model",
            "turn_number",
            "input_tokens",
            "output_tokens",
            "cache_creation_input_tokens",
            "tool_name",
            "timestamp",
        ]
    )
    proposal = FakeAgent().propose(sample, profiles, target_schema={})
    by_target = {f.target_field: f.source_field for f in proposal.fields}

    assert by_target["external_session_id"] == "session_id"
    assert by_target["agent"] == "agent"
    assert by_target["round_index"] == "turn_number"
    assert by_target["prompt_tokens"] == "input_tokens"
    assert by_target["completion_tokens"] == "output_tokens"
    assert by_target["cache_creation_tokens"] == "cache_creation_input_tokens"
    assert by_target["tool_name"] == "tool_name"
    assert "tools_path" not in by_target
    assert proposal.source_name == "conversation-jsonl"


def test_fake_agent_prefers_nested_tools_over_flat_name():
    sample, profiles = _sample(["session_id", "tools", "tool_name", "round_id"])
    proposal = FakeAgent().propose(sample, profiles, target_schema={})
    by_target = {f.target_field: f.source_field for f in proposal.fields}
    assert by_target["tools_path"] == "tools"
    assert by_target["tool_name"] == "tool_name"
    assert by_target["round_index"] == "round_id"


def test_fake_agent_maps_provider_to_agent():
    sample, profiles = _sample(["session_id", "provider", "model"])
    proposal = FakeAgent().propose(sample, profiles, target_schema={})
    by_target = {f.target_field: f.source_field for f in proposal.fields}
    assert by_target["agent"] == "provider"
    assert by_target["model"] == "model"
