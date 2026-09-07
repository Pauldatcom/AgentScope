"""Mappings router — list, save, and use mappings to import/analyze."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from ...application import (
    AnalyzeUseCase,
    ApplyMappingUseCase,
    MappingManagementUseCase,
)
from ..schemas import AnalysisOut, ApplyMappingIn, ApplyMappingOut, MappingIn, MappingOut

router = APIRouter(prefix="/mappings", tags=["mappings"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.get("", response_model=list[MappingOut])
def list_mappings(source_id: UUID | None = None, uow=Depends(_uow)):
    return [
        MappingOut(
            id=m.id,
            source_id=m.source_id,
            version=m.version,
            mapping=m.mapping,
            created_by=m.created_by,
            is_active=m.is_active,
        )
        for m in uow.mappings.list_mappings(source_id)
    ]


@router.post("", response_model=MappingOut)
def save_mapping(payload: MappingIn, uow=Depends(_uow)):
    uc = MappingManagementUseCase(mappings=uow.mappings)
    m = uc.save(
        source_id=payload.source_id,
        mapping=payload.mapping,
        created_by=payload.created_by,
    )
    uow.commit()
    return MappingOut(
        id=m.id,
        source_id=m.source_id,
        version=m.version,
        mapping=m.mapping,
        created_by=m.created_by,
        is_active=m.is_active,
    )


@router.post("/analyze", response_model=AnalysisOut)
async def analyze_unknown(
    request: Request,
    file: UploadFile = File(...),
    sample_size: int = Form(5),
):
    suffix = Path(file.filename or "").suffix
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, await file.read())
        os.close(fd)
        reader = request.app.state.file_reader_for(tmp_path)
        uc = AnalyzeUseCase(reader=reader, agent=request.app.state.mapping_agent)
        result = uc.execute(tmp_path, sample_size=sample_size)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return AnalysisOut(
        sample_rows=result.sample.rows,
        fields=result.sample.fields,
        row_count=result.sample.row_count,
        profiles=[p.__dict__ for p in result.profiles],
        proposal={
            "fields": [f.__dict__ for f in result.proposal.fields],
            "source_name": result.proposal.source_name,
            "explanation": result.proposal.explanation,
            "ambiguities": result.proposal.ambiguities,
        },
    )


@router.post("/apply", response_model=ApplyMappingOut)
async def apply_mapping(
    request: Request,
    payload: ApplyMappingIn,
    file: UploadFile = File(...),
):
    suffix = Path(file.filename or "").suffix
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, await file.read())
        os.close(fd)
        reader = request.app.state.file_reader_for(tmp_path)
        uc = ApplyMappingUseCase(reader=reader)
        result = uc.preview(
            tmp_path,
            payload.mapping,
            source_id=payload.source_id,
            import_run_id=payload.source_id,
            preview_rows=payload.preview_rows,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return ApplyMappingOut(
        is_valid=result.is_valid,
        errors=list(result.errors),
        warnings=list(result.warnings),
        preview=result.preview,
    )
