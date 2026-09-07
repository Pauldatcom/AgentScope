"""Dashboard router — indicators + session detail for the frontend."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request

from ...application.dashboard.queries import DashboardUseCase
from ..schemas import DashboardOut, IndicatorDefOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=DashboardOut)
def dashboard(
    source_id: UUID | None = None,
    agent: str | None = None,
    model: str | None = None,
    uow=Depends(_uow),
):
    uc = DashboardUseCase(sessions=uow.sessions)
    result = uc.build(source_id=source_id, agent=agent, model=model)
    return DashboardOut(
        indicators=result.indicators,
        definitions={
            k: IndicatorDefOut(**v.__dict__) for k, v in result.definitions.items()
        },
    )
