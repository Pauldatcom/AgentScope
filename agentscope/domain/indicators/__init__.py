"""Indicators — pure functions computing dashboard metrics.

Each indicator has a definition exposed via `IndicatorDefinition`:
- calc:    formula
- unit:    unit of measurement
- scope:   what it covers
- missing: how missing values are treated (never silently turned into zero)

Computed in Python/SQL — NEVER by the AI.
"""

from .definitions import INDICATORS, IndicatorDefinition
from .metrics import (
    ActivityBucketResult,
    AgentBreakdownResult,
    AvgDurationResult,
    CacheRateResult,
    DataCompletenessResult,
    ErrorRateResult,
    ModelBreakdownResult,
    SessionsByAgentResult,
    TokensByModelResult,
    ToolBreakdownResult,
    ToolDistributionResult,
    compute_activity_timeseries,
    compute_agent_breakdown,
    compute_avg_duration,
    compute_cache_rate,
    compute_data_completeness,
    compute_error_rate,
    compute_model_breakdown,
    compute_sessions_by_agent,
    compute_tokens_by_model,
    compute_tool_breakdown,
    compute_tool_distribution,
)

__all__ = [
    "INDICATORS",
    "IndicatorDefinition",
    "compute_tokens_by_model",
    "compute_sessions_by_agent",
    "compute_tool_distribution",
    "compute_error_rate",
    "compute_avg_duration",
    "compute_cache_rate",
    "compute_agent_breakdown",
    "compute_tool_breakdown",
    "compute_model_breakdown",
    "compute_activity_timeseries",
    "compute_data_completeness",
    "TokensByModelResult",
    "SessionsByAgentResult",
    "ToolDistributionResult",
    "ErrorRateResult",
    "AvgDurationResult",
    "CacheRateResult",
    "AgentBreakdownResult",
    "ToolBreakdownResult",
    "ModelBreakdownResult",
    "ActivityBucketResult",
    "DataCompletenessResult",
]
