"""Indicator computations — pure functions over domain entities.

No DB, no AI, no I/O. Tested directly in `tests/unit/test_indicators.py`.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
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


@dataclass(frozen=True)
class AvgDurationResult:
    total: int
    with_duration: int
    avg_ms: float | None


@dataclass(frozen=True)
class CacheRateResult:
    total: int
    with_cache: int
    rate: float | None


@dataclass(frozen=True)
class AgentBreakdownResult:
    agent: str
    sessions: int
    total_tokens: int | None
    tool_calls: int
    errors: int
    avg_duration_ms: float | None
    cache_rate: float | None
    error_rate: float | None
    last_active_iso: str | None


@dataclass(frozen=True)
class ToolBreakdownResult:
    name: str
    calls: int
    sessions: int
    errors: int
    error_rate: float | None
    p50_ms: int | None
    p95_ms: int | None
    p99_ms: int | None
    avg_input_chars: int | None
    avg_result_chars: int | None


@dataclass(frozen=True)
class ModelBreakdownResult:
    name: str
    sessions: int
    requests: int
    prompt_tokens: int | None
    completion_tokens: int | None
    cache_tokens: int | None
    total_tokens: int | None
    avg_latency_ms: int | None
    error_rate: float | None
    cache_rate: float | None


@dataclass(frozen=True)
class ActivityBucketResult:
    bucket: str
    sessions: int
    prompt_tokens: int
    completion_tokens: int
    cache_tokens: int
    total_tokens: int
    tool_calls: int
    errors: int


@dataclass(frozen=True)
class DataCompletenessResult:
    total: int
    with_tokens: int
    with_duration: int
    with_cache: int
    with_errors: int
    tokens_coverage: float | None
    duration_coverage: float | None
    cache_coverage: float | None
    error_coverage: float | None


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


def compute_avg_duration(sessions: Iterable[Session]) -> AvgDurationResult:
    """Average session duration. Sessions with null start/end are excluded."""

    durations: list[float] = []
    for s in sessions:
        if s.started_at is not None and s.ended_at is not None:
            durations.append(
                (s.ended_at - s.started_at).total_seconds() * 1000
            )
    if not durations:
        return AvgDurationResult(
            total=sum(1 for _ in sessions),
            with_duration=0,
            avg_ms=None,
        )
    return AvgDurationResult(
        total=sum(1 for _ in sessions),
        with_duration=len(durations),
        avg_ms=sum(durations) / len(durations),
    )


def compute_cache_rate(
    sessions: Iterable[Session],
    calls: Iterable[ModelCall],
) -> CacheRateResult:
    """Cache hit rate. Only calls where cache is reported are counted."""

    session_ids = {s.id for s in sessions}
    reported = [c for c in calls if c.cache_creation_tokens is not None]
    if not reported:
        return CacheRateResult(
            total=sum(1 for _ in sessions),
            with_cache=0,
            rate=None,
        )
    cached = sum(
        1 for c in reported
        if c.cache_creation_tokens is not None
        and c.cache_creation_tokens > 0
        and c.session_id in session_ids
    )
    return CacheRateResult(
        total=sum(1 for _ in sessions),
        with_cache=len(reported),
        rate=cached / len(reported) if reported else None,
    )


def _percentile(sorted_vals: Sequence[float], p: float) -> int | None:
    if not sorted_vals:
        return None
    idx = int(len(sorted_vals) * p)
    if idx >= len(sorted_vals):
        idx = len(sorted_vals) - 1
    return int(sorted_vals[idx])


def compute_agent_breakdown(
    sessions: Iterable[Session],
    calls: Iterable[ModelCall],
    tools: Iterable[ToolCall],
) -> list[AgentBreakdownResult]:
    """Per-agent breakdown: sessions, tokens, tool calls, errors, duration, cache."""

    sessions_list = list(sessions)
    calls_list = list(calls)
    tools_list = list(tools)
    by_agent: dict[str, list[Session]] = defaultdict(list)
    for s in sessions_list:
        by_agent[s.agent or "unknown"].append(s)

    results: list[AgentBreakdownResult] = []
    for agent, agent_sessions in by_agent.items():
        agent_session_ids = {s.id for s in agent_sessions}
        agent_calls = [c for c in calls_list if c.session_id in agent_session_ids]
        agent_tools = [t for t in tools_list if t.session_id in agent_session_ids]
        tokens = sum(c.total_tokens or 0 for c in agent_calls)
        has_tokens = any(c.metric_available for c in agent_calls)
        durations = [
            (s.ended_at - s.started_at).total_seconds() * 1000
            for s in agent_sessions
            if s.started_at is not None and s.ended_at is not None
        ]
        errors = sum(1 for c in agent_calls if c.is_error)
        cache_reported = [
            c for c in agent_calls if c.cache_creation_tokens is not None
        ]
        last_active = max(
            (s.started_at for s in agent_sessions if s.started_at is not None),
            default=None,
        )
        results.append(
            AgentBreakdownResult(
                agent=agent,
                sessions=len(agent_sessions),
                total_tokens=tokens if has_tokens else None,
                tool_calls=len(agent_tools),
                errors=errors,
                avg_duration_ms=(
                    sum(durations) / len(durations) if durations else None
                ),
                cache_rate=(
                    sum(
                        1
                        for c in cache_reported
                        if (c.cache_creation_tokens or 0) > 0
                    )
                    / len(cache_reported)
                    if cache_reported
                    else None
                ),
                error_rate=errors / len(agent_sessions) if agent_sessions else None,
                last_active_iso=last_active.isoformat() if last_active else None,
            )
        )
    results.sort(key=lambda r: (-r.sessions, r.agent))
    return results


def compute_tool_breakdown(
    sessions: Iterable[Session],
    tools: Iterable[ToolCall],
) -> list[ToolBreakdownResult]:
    """Per-tool breakdown: calls, sessions, errors, latency percentiles, avg sizes."""

    sessions_list = list(sessions)
    session_ids = {s.id for s in sessions_list}
    relevant_tools = [t for t in tools if t.session_id in session_ids]
    by_tool: dict[str, list[ToolCall]] = defaultdict(list)
    for t in relevant_tools:
        by_tool[t.tool_name or "unknown"].append(t)

    results: list[ToolBreakdownResult] = []
    for name, calls_list in by_tool.items():
        calls_sorted = sorted(
            c.wall_latency_ms for c in calls_list if c.wall_latency_ms is not None
        )
        errors = sum(1 for c in calls_list if c.is_error)
        inputs = [c.input_chars for c in calls_list if c.input_chars is not None]
        results_chars = [c.result_chars for c in calls_list if c.result_chars is not None]
        results.append(
            ToolBreakdownResult(
                name=name,
                calls=len(calls_list),
                sessions=len({c.session_id for c in calls_list}),
                errors=errors,
                error_rate=errors / len(calls_list) if calls_list else None,
                p50_ms=_percentile(calls_sorted, 0.5),
                p95_ms=_percentile(calls_sorted, 0.95),
                p99_ms=_percentile(calls_sorted, 0.99),
                avg_input_chars=int(sum(inputs) / len(inputs)) if inputs else None,
                avg_result_chars=(
                    int(sum(results_chars) / len(results_chars))
                    if results_chars
                    else None
                ),
            )
        )
    results.sort(key=lambda r: (-r.calls, r.name))
    return results


def compute_model_breakdown(
    sessions: Iterable[Session],
    calls: Iterable[ModelCall],
) -> list[ModelBreakdownResult]:
    """Per-model breakdown: tokens, requests, cache, latency, errors."""

    sessions_list = list(sessions)
    session_ids = {s.id for s in sessions_list}
    relevant_calls = [c for c in calls if c.session_id in session_ids]
    by_model: dict[str, list[ModelCall]] = defaultdict(list)
    for c in relevant_calls:
        by_model[c.model or "unknown"].append(c)

    results: list[ModelBreakdownResult] = []
    for model, model_calls in by_model.items():
        model_session_ids = {c.session_id for c in model_calls}
        prompt = sum(c.prompt_tokens or 0 for c in model_calls)
        completion = sum(c.completion_tokens or 0 for c in model_calls)
        cache = sum(c.cache_creation_tokens or 0 for c in model_calls)
        has_tokens = any(c.metric_available for c in model_calls)
        latencies = sorted(
            c.latency_ms for c in model_calls if c.latency_ms is not None
        )
        errors = sum(1 for c in model_calls if c.is_error)
        cache_reported = [
            c for c in model_calls if c.cache_creation_tokens is not None
        ]
        results.append(
            ModelBreakdownResult(
                name=model,
                sessions=len(model_session_ids),
                requests=len(model_calls),
                prompt_tokens=prompt if has_tokens else None,
                completion_tokens=completion if has_tokens else None,
                cache_tokens=cache if cache_reported else None,
                total_tokens=(prompt + completion) if has_tokens else None,
                avg_latency_ms=_percentile(latencies, 0.5),
                error_rate=errors / len(model_calls) if model_calls else None,
                cache_rate=(
                    sum(
                        1
                        for c in cache_reported
                        if (c.cache_creation_tokens or 0) > 0
                    )
                    / len(cache_reported)
                    if cache_reported
                    else None
                ),
            )
        )
    results.sort(key=lambda r: (-(r.total_tokens or 0), r.name))
    return results


def compute_activity_timeseries(
    sessions: Iterable[Session],
    calls: Iterable[ModelCall],
    tools: Iterable[ToolCall],
) -> list[ActivityBucketResult]:
    """Bucket sessions by started_at day. Returns sorted by bucket asc."""

    sessions_list = list(sessions)
    session_ids = {s.id for s in sessions_list}
    calls_list = [c for c in calls if c.session_id in session_ids]
    tools_list = [t for t in tools if t.session_id in session_ids]

    by_bucket: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "sessions": 0,
            "prompt": 0,
            "completion": 0,
            "cache": 0,
            "tool_calls": 0,
            "errors": 0,
        }
    )
    for s in sessions_list:
        if s.started_at is None:
            continue
        bucket = s.started_at.strftime("%Y-%m-%d")
        by_bucket[bucket]["sessions"] += 1

    for c in calls_list:
        if c.occurred_at is None:
            continue
        bucket = c.occurred_at.strftime("%Y-%m-%d")
        if c.prompt_tokens is not None:
            by_bucket[bucket]["prompt"] += c.prompt_tokens
        if c.completion_tokens is not None:
            by_bucket[bucket]["completion"] += c.completion_tokens
        if c.cache_creation_tokens is not None:
            by_bucket[bucket]["cache"] += c.cache_creation_tokens
        if c.is_error:
            by_bucket[bucket]["errors"] += 1

    for t in tools_list:
        if t.occurred_at is None:
            continue
        bucket = t.occurred_at.strftime("%Y-%m-%d")
        by_bucket[bucket]["tool_calls"] += 1
        if t.is_error:
            by_bucket[bucket]["errors"] += 1

    return [
        ActivityBucketResult(
            bucket=b,
            sessions=v["sessions"],
            prompt_tokens=v["prompt"],
            completion_tokens=v["completion"],
            cache_tokens=v["cache"],
            total_tokens=v["prompt"] + v["completion"],
            tool_calls=v["tool_calls"],
            errors=v["errors"],
        )
        for b, v in sorted(by_bucket.items())
    ]


def compute_data_completeness(
    sessions: Iterable[Session],
    calls: Iterable[ModelCall],
) -> DataCompletenessResult:
    """Coverage of tokens / duration / cache / errors across sessions."""

    sessions_list = list(sessions)
    total = len(sessions_list)
    if total == 0:
        return DataCompletenessResult(
            total=0,
            with_tokens=0,
            with_duration=0,
            with_cache=0,
            with_errors=0,
            tokens_coverage=None,
            duration_coverage=None,
            cache_coverage=None,
            error_coverage=None,
        )
    calls_by_session: dict = defaultdict(list)
    for c in calls:
        calls_by_session[c.session_id].append(c)

    with_tokens = 0
    with_duration = 0
    with_cache = 0
    with_errors = 0
    for s in sessions_list:
        session_calls = calls_by_session.get(s.id, [])
        if any(c.metric_available for c in session_calls):
            with_tokens += 1
        if s.started_at is not None and s.ended_at is not None:
            with_duration += 1
        if any(c.cache_creation_tokens is not None for c in session_calls):
            with_cache += 1
        if any(c.is_error for c in session_calls):
            with_errors += 1

    return DataCompletenessResult(
        total=total,
        with_tokens=with_tokens,
        with_duration=with_duration,
        with_cache=with_cache,
        with_errors=with_errors,
        tokens_coverage=with_tokens / total,
        duration_coverage=with_duration / total,
        cache_coverage=with_cache / total,
        error_coverage=with_errors / total,
    )
