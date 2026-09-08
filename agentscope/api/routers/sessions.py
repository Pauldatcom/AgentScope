"""Sessions router — list + detail."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..schemas import SessionDetail, SessionOut

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=list[SessionOut])
def list_sessions(
    source_id: UUID | None = None,
    agent: str | None = None,
    model: str | None = None,
    limit: int = Query(100, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    uow=Depends(_uow),
):
    rows = uow.sessions.session_list_enriched(
        source_id=source_id, agent=agent, model=model, limit=limit, offset=offset
    )
    return [SessionOut(**r) for r in rows]


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: UUID, uow=Depends(_uow)):
    detail = uow.sessions.get_session_detail(session_id)
    if detail is None:
        raise HTTPException(404, "session not found")
    return SessionDetail(**detail)
