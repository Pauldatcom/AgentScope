"""Imports router — upload a file and run the import pipeline."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from ...application import ImportUseCase
from ..schemas import ImportReportOut

router = APIRouter(prefix="/imports", tags=["imports"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


@router.post("/upload", response_model=ImportReportOut)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    source_id: UUID = Form(...),
    mapping_json: str = Form("{}"),
):
    import json

    try:
        mapping = json.loads(mapping_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"invalid mapping_json: {exc}") from exc

    # If the mapping is empty, try to load the active mapping for the source.
    if not mapping:
        with request.app.state.uow_factory() as uow:
            active = uow.mappings.get_active_mapping(source_id)
            if active is not None:
                mapping = active.mapping

    suffix = Path(file.filename or "").suffix
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, await file.read())
        os.close(fd)
        reader = request.app.state.file_reader_for(tmp_path)
        source = None
        with request.app.state.uow_factory() as uow:
            source = uow.sources.get_source(source_id)
        if source is None:
            raise HTTPException(404, "source not found")
        uc = ImportUseCase(
            reader=reader,
            uow_factory=request.app.state.uow_factory,
        )
        report = uc.execute(tmp_path, source=source, mapping=mapping)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return ImportReportOut(
        import_id=report.import_id,
        source_id=report.source_id,
        filename=report.filename,
        file_hash=report.file_hash,
        status=report.status,
        rows_read=report.rows_read,
        sessions_imported=report.sessions_imported,
        model_calls_imported=report.model_calls_imported,
        tool_calls_imported=report.tool_calls_imported,
        duplicates=report.duplicates,
        is_duplicate_run=report.is_duplicate_run,
    )
