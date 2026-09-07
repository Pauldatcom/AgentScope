"""Sources router — CRUD for dataset provenances."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from ...domain.entities import Source, new_id
from ..schemas import SourceIn, SourceOut

router = APIRouter(prefix="/sources", tags=["sources"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=list[SourceOut])
def list_sources(uow=Depends(_uow)):
    return [SourceOut(**s.__dict__) for s in uow.sources.list_sources()]


@router.post("", response_model=SourceOut)
def create_source(payload: SourceIn, uow=Depends(_uow)):
    source = Source(
        id=new_id(),
        name=payload.name,
        version=payload.version,
        retrieved_at=datetime.utcnow(),
        method=payload.method,
        license=payload.license,
    )
    uow.sources.add_source(source)
    uow.commit()
    return SourceOut(**source.__dict__)


@router.get("/{source_id}", response_model=SourceOut)
def get_source(source_id: UUID, uow=Depends(_uow)):
    s = uow.sources.get_source(source_id)
    if s is None:
        raise HTTPException(404, "source not found")
    return SourceOut(**s.__dict__)
