"""Indicator definitions — the metadata shown in the dashboard.

Each indicator documents its calculation, unit, scope and how missing values
are treated. A missing value MUST NOT become a zero.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IndicatorDefinition:
    id: str
    name: str
    calc: str
    unit: str
    scope: str
    missing: str


INDICATORS: dict[str, IndicatorDefinition] = {
    "tokens_by_model": IndicatorDefinition(
        id="tokens_by_model",
        name="Tokens consumed by model",
        calc="SUM(prompt_tokens + completion_tokens) GROUP BY model",
        unit="tokens",
        scope="model_call rows; per session filter applied",
        missing="Sessions with NULL token counts are excluded from sums; "
                "the row is counted but its tokens do not contribute.",
    ),
    "sessions_by_agent": IndicatorDefinition(
        id="sessions_by_agent",
        name="Sessions by agent",
        calc="COUNT(*) GROUP BY agent",
        unit="sessions",
        scope="session rows; agents with no sessions do not appear",
        missing="Sessions with agent=NULL are grouped under 'unknown'.",
    ),
    "tool_distribution": IndicatorDefinition(
        id="tool_distribution",
        name="Tool call distribution",
        calc="COUNT(*) GROUP BY tool_name; share = count / total",
        unit="count + percent",
        scope="tool_call rows; sessions without tool calls excluded",
        missing="Sessions with no tool calls contribute 0 to the total but "
                "do not appear as a tool name.",
    ),
    "error_rate": IndicatorDefinition(
        id="error_rate",
        name="Session error rate",
        calc="COUNT(sessions with any is_error) / COUNT(sessions)",
        unit="percent",
        scope="session rows",
        missing="Sessions where error status is unknown are excluded from both "
                "numerator and denominator, never counted as 0%.",
    ),
    "avg_duration": IndicatorDefinition(
        id="avg_duration",
        name="Average session duration",
        calc="AVG(ended_at - started_at)",
        unit="ms",
        scope="session rows with non-null start & end",
        missing="Sessions with null start/end are excluded — "
                "N/A when none qualify, never 0.",
    ),
    "cache_rate": IndicatorDefinition(
        id="cache_rate",
        name="Cache hit rate",
        calc="COUNT(cached_calls) / COUNT(calls_with_cache_field)",
        unit="percent",
        scope="model_call rows with cache tokens reported",
        missing="Providers without a cache field are excluded. "
                "N/A when none report cache — never 0.",
    ),
}
