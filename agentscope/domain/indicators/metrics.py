"""Indicator computations — pure functions over domain entities.

No DB, no AI, no I/O. Tested directly in `tests/unit/test_indicators.py`.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from ..entities import ModelCall, Session, ToolCall


@dataclass(frozen=True)
class TokensByModelResult:
    model: str | None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    sessions_counted: int


@dataclass(frozen=True)
class SessionsByAgentResult:
    agent: str
    count: int


@dataclass(frozen=True)
class ToolDistributionResult:
    tool_name: str
    count: int
    share: float


@dataclass(frozen=True)
class ErrorRateResult:
    total: int
    with_error: int
    rate: float | None


def compute_tokens_by_model(
    sessions: Iterable[Session],
    calls: Iterable[ModelCall],
) -> list[TokensByModelResult]:
    """Sum prompt + completion tokens per model.

    Sessions/calls with NULL tokens are excluded from sums but remain
    represented (sessions_counted only counts those that contributed).
    """

    by_model: dict[str | None, dict[str, int]] = defaultdict(
        lambda: {"prompt": 0, "completion": 0, "sessions": 0}
    )
    session_ids = {s.id for s in sessions}

    for c in calls:
        if c.session_id not in session_ids:
            continue
        key = c.model
        bucket = by_model[key]
        if c.prompt_tokens is not None:
            bucket["prompt"] += c.prompt_tokens
        if c.completion_tokens is not None:
            bucket["completion"] += c.completion_tokens
        if c.metric_available:
            bucket["sessions"] += 1

    return [
        TokensByModelResult(
            model=m,
            prompt_tokens=b["prompt"],
            completion_tokens=b["completion"],
            total_tokens=b["prompt"] + b["completion"],
            sessions_counted=b["sessions"],
        )
        for m, b in sorted(by_model.items(), key=lambda kv: kv[0] or "")
    ]


def compute_sessions_by_agent(sessions: Iterable[Session]) -> list[SessionsByAgentResult]:
    counts: dict[str, int] = defaultdict(int)
    for s in sessions:
        counts[s.agent or "unknown"] += 1
    return [
        SessionsByAgentResult(agent=a, count=c)
        for a, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def compute_tool_distribution(tool_calls: Iterable[ToolCall]) -> list[ToolDistributionResult]:
    counts: dict[str, int] = defaultdict(int)
    total = 0
    for t in tool_calls:
        counts[t.tool_name or "unknown"] += 1
        total += 1
    if total == 0:
        return []
    return [
        ToolDistributionResult(tool_name=n, count=c, share=c / total)
        for n, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def compute_error_rate(
    sessions: Iterable[Session],
    calls: Iterable[ModelCall],
) -> ErrorRateResult:
    """Sessions with unknown error status are excluded from both num and den."""

    session_ids = list(s.id for s in sessions)
    total = len(session_ids)
    if total == 0:
        return ErrorRateResult(total=0, with_error=0, rate=None)

    err_sessions: set = set()
    for c in calls:
        if c.session_id in session_ids and c.is_error:
            err_sessions.add(c.session_id)

    return ErrorRateResult(
        total=total,
        with_error=len(err_sessions),
        rate=len(err_sessions) / total,
    )
