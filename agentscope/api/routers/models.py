"""Models router — per-model breakdown."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request

from ...application.dashboard.queries import DashboardUseCase
from ..schemas import ModelOut

router = APIRouter(prefix="/models", tags=["models"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=list[ModelOut])
def list_models(
    source_id: UUID | None = None,
    agent: str | None = None,
    model: str | None = None,
    uow=Depends(_uow),
):
    uc = DashboardUseCase(sessions=uow.sessions)
    return [ModelOut(**r) for r in uc.models(source_id=source_id, agent=agent, model=model)]
