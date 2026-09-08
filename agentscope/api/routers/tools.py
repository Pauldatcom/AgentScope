"""Tools router — per-tool breakdown."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request

from ...application.dashboard.queries import DashboardUseCase
from ..schemas import ToolOut

router = APIRouter(prefix="/tools", tags=["tools"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=list[ToolOut])
def list_tools(
    source_id: UUID | None = None,
    agent: str | None = None,
    model: str | None = None,
    uow=Depends(_uow),
):
    uc = DashboardUseCase(sessions=uow.sessions)
    return [ToolOut(**r) for r in uc.tools(source_id=source_id, agent=agent, model=model)]
