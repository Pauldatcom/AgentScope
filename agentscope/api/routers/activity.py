"""Activity router — time-bucketed session activity for the activity grid."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request

from ...application.dashboard.queries import DashboardUseCase
from ..schemas import ActivityBucketOut

router = APIRouter(prefix="/activity", tags=["activity"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=list[ActivityBucketOut])
def activity(
    source_id: UUID | None = None,
    agent: str | None = None,
    model: str | None = None,
    uow=Depends(_uow),
):
    uc = DashboardUseCase(sessions=uow.sessions)
    return [
        ActivityBucketOut(**r)
        for r in uc.activity(source_id=source_id, agent=agent, model=model)
    ]
