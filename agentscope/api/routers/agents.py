"""Agents router — per-agent breakdown."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request

from ...application.dashboard.queries import DashboardUseCase
from ..schemas import AgentOut

router = APIRouter(prefix="/agents", tags=["agents"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=list[AgentOut])
def list_agents(
    source_id: UUID | None = None,
    agent: str | None = None,
    model: str | None = None,
    uow=Depends(_uow),
):
    uc = DashboardUseCase(sessions=uow.sessions)
    results = uc.agents(source_id=source_id, agent=agent, model=model)
    return [AgentOut(name=r["agent"], **{k: v for k, v in r.items() if k != "agent"}) for r in results]
