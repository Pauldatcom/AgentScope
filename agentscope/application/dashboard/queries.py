"""Dashboard use cases — read indicators and session details.

Delegates to repository aggregate methods for performance.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from ...domain.contracts import SessionRepository
from ...domain.indicators import INDICATORS, IndicatorDefinition


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
        indicators = self._sessions.aggregate_dashboard(
            source_id=source_id, agent=agent, model=model
        )
        return Dashboard(indicators=indicators, definitions=INDICATORS)

    def session_detail(self, session_id: UUID) -> dict | None:
        return self._sessions.get_session_detail(session_id)

    def agents(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        return self._sessions.aggregate_agent_breakdown(
            source_id=source_id, agent=agent, model=model
        )

    def tools(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        return self._sessions.aggregate_tool_breakdown(
            source_id=source_id, agent=agent, model=model
        )

    def models(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        return self._sessions.aggregate_model_breakdown(
            source_id=source_id, agent=agent, model=model
        )

    def activity(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        return self._sessions.aggregate_activity_timeseries(
            source_id=source_id, agent=agent, model=model
        )

    def data_completeness(self, *, source_id=None, agent=None, model=None) -> dict:
        return self._sessions.aggregate_data_completeness(
            source_id=source_id, agent=agent, model=model
        )
