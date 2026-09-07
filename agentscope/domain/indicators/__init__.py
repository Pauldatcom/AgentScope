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
    ErrorRateResult,
    SessionsByAgentResult,
    TokensByModelResult,
    ToolDistributionResult,
    compute_error_rate,
    compute_sessions_by_agent,
    compute_tokens_by_model,
    compute_tool_distribution,
)

__all__ = [
    "INDICATORS",
    "IndicatorDefinition",
    "compute_tokens_by_model",
    "compute_sessions_by_agent",
    "compute_tool_distribution",
    "compute_error_rate",
    "TokensByModelResult",
    "SessionsByAgentResult",
    "ToolDistributionResult",
    "ErrorRateResult",
]
