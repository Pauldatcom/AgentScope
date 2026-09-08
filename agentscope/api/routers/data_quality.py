"""Data quality router — completeness, imports, rejections, comparability."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request

from ...application.dashboard.queries import DashboardUseCase
from ..schemas import DataQualityOut, ImportRunOut, RejectionOut

router = APIRouter(prefix="/data-quality", tags=["data-quality"])


def _uow(request: Request):
    with request.app.state.uow_factory() as uow:
        yield uow


def _to_import_run_out(run) -> ImportRunOut:
    summary = run.summary or {}
    return ImportRunOut(
        id=run.id,
        source_id=run.source_id,
        filename=run.filename,
        file_hash=run.file_hash,
        status=run.status,
        rows_read=summary.get("rows_read", 0),
        sessions_imported=summary.get("sessions_imported", 0),
        model_calls_imported=summary.get("model_calls_imported", 0),
        tool_calls_imported=summary.get("tool_calls_imported", 0),
        duplicates=summary.get("duplicates", 0),
        created_at=run.created_at,
    )


@router.get("", response_model=DataQualityOut)
def data_quality(
    source_id: UUID | None = None,
    agent: str | None = None,
    model: str | None = None,
    uow=Depends(_uow),
):
    uc = DashboardUseCase(sessions=uow.sessions)
    completeness = uc.data_completeness(
        source_id=source_id, agent=agent, model=model
    )
    sources = [
        {
            "id": str(s.id),
            "name": s.name,
            "version": s.version,
            "license": s.license,
            "method": s.method,
        }
        for s in uow.sources.list_sources()
    ]
    imports = [_to_import_run_out(r) for r in uow.imports.list_imports(limit=20)]
    rejections = [
        RejectionOut(
            id=r.id,
            import_run_id=r.import_run_id,
            line_number=r.line_number,
            reason=r.reason,
            excerpt=r.excerpt,
        )
        for r in uow.imports.list_rejections(limit=50)
    ]
    return DataQualityOut(
        total_sessions=completeness["total"],
        with_tokens=completeness["with_tokens"],
        with_duration=completeness["with_duration"],
        with_cache=completeness["with_cache"],
        with_errors=completeness["with_errors"],
        tokens_coverage=completeness["tokens_coverage"],
        duration_coverage=completeness["duration_coverage"],
        cache_coverage=completeness["cache_coverage"],
        error_coverage=completeness["error_coverage"],
        sources=sources,
        imports=imports,
        rejections=rejections,
    )
