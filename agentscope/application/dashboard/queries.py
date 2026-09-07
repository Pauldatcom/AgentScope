"""Dashboard use cases — read indicators and session details.

Pure orchestration over repositories; indicators themselves are pure functions
in `domain.indicators`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from ...domain.contracts import SessionRepository
from ...domain.indicators import (
    INDICATORS,
    IndicatorDefinition,
    compute_error_rate,
    compute_sessions_by_agent,
    compute_tokens_by_model,
    compute_tool_distribution,
)


@dataclass(frozen=True)
class Dashboard:
    indicators: dict[str, Any]
    definitions: dict[str, IndicatorDefinition]


class DashboardUseCase:
    def __init__(self, *, sessions: SessionRepository) -> None:
        self._sessions = sessions

    def build(
        self,
        *,
        source_id: UUID | None = None,
        agent: str | None = None,
        model: str | None = None,
    ) -> Dashboard:
        sessions = self._sessions.list_sessions(
            source_id=source_id, agent=agent, model=model, limit=10**6
        )
        session_ids = [s.id for s in sessions]
        calls = self._sessions.list_model_calls(session_ids)
        tools = self._sessions.list_tool_calls(session_ids)

        indicators = {
            "tokens_by_model": [
                r.__dict__ for r in compute_tokens_by_model(sessions, calls)
            ],
            "sessions_by_agent": [
                r.__dict__ for r in compute_sessions_by_agent(sessions)
            ],
            "tool_distribution": [
                r.__dict__ for r in compute_tool_distribution(tools)
            ],
            "error_rate": compute_error_rate(sessions, calls).__dict__,
        }
        return Dashboard(indicators=indicators, definitions=INDICATORS)

    def session_detail(self, session_id: UUID) -> dict | None:
        return self._sessions.get_session_detail(session_id)
