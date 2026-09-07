"""Unit tests for domain indicators — pure, no I/O."""

from __future__ import annotations

from uuid import uuid4

from agentscope.domain.entities import ModelCall, Session, ToolCall, new_id
from agentscope.domain.indicators import (
    compute_error_rate,
    compute_sessions_by_agent,
    compute_tokens_by_model,
    compute_tool_distribution,
)


def _sess(agent: str | None = "claude", model: str | None = "claude-3-5") -> Session:
    return Session(
        id=new_id(),
        source_id=new_id(),
        import_run_id=new_id(),
        external_session_id=uuid4().hex,
        agent=agent,
        model=model,
    )


def test_tokens_by_model_excludes_null_tokens():
    s1, s2 = _sess(), _sess()
    calls = [
        ModelCall(
            id=new_id(), session_id=s1.id, round_index=0,
            model="claude-3-5", prompt_tokens=100, completion_tokens=50,
        ),
        ModelCall(
            id=new_id(), session_id=s2.id, round_index=0,
            model="claude-3-5", prompt_tokens=None, completion_tokens=None,
        ),
    ]
    result = compute_tokens_by_model([s1, s2], calls)
    assert len(result) == 1
    r = result[0]
    assert r.prompt_tokens == 100
    assert r.completion_tokens == 50
    assert r.total_tokens == 150
    assert r.sessions_counted == 1


def test_sessions_by_agent_groups_unknown():
    s1 = _sess(agent="claude")
    s2 = _sess(agent=None)
    s3 = _sess(agent="codex")
    result = compute_sessions_by_agent([s1, s2, s3])
    by_name = {r.agent: r.count for r in result}
    assert by_name == {"claude": 1, "unknown": 1, "codex": 1}


def test_tool_distribution_shares_sum_to_one():
    s = _sess()
    tools = [
        ToolCall(
            id=new_id(), session_id=s.id, model_call_id=None,
            tool_name="bash", input_chars=10, result_chars=20,
        ),
        ToolCall(
            id=new_id(), session_id=s.id, model_call_id=None,
            tool_name="bash", input_chars=10, result_chars=20,
        ),
        ToolCall(
            id=new_id(), session_id=s.id, model_call_id=None,
            tool_name="edit", input_chars=10, result_chars=20,
        ),
    ]
    result = compute_tool_distribution(tools)
    assert sum(r.share for r in result) == 1.0
    by_name = {r.tool_name: r.count for r in result}
    assert by_name == {"bash": 2, "edit": 1}


def test_error_rate_none_when_no_sessions():
    assert compute_error_rate([], []).rate is None


def test_error_rate_counts_only_known_errors():
    s1, s2 = _sess(), _sess()
    calls = [
        ModelCall(
            id=new_id(), session_id=s1.id, round_index=0,
            model="claude", is_error=True,
        ),
        ModelCall(
            id=new_id(), session_id=s2.id, round_index=0,
            model="claude", is_error=False,
        ),
    ]
    result = compute_error_rate([s1, s2], calls)
    assert result.total == 2
    assert result.with_error == 1
    assert result.rate == 0.5


def test_empty_tool_distribution_returns_empty_list():
    assert compute_tool_distribution([]) == []
