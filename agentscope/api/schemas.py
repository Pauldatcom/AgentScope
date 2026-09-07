"""DTO schemas for the API (Pydantic v2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ImportReportOut(BaseModel):
    import_id: UUID
    source_id: UUID
    filename: str
    file_hash: str
    status: str
    rows_read: int
    sessions_imported: int
    model_calls_imported: int
    tool_calls_imported: int
    duplicates: int
    is_duplicate_run: bool = False


class SourceOut(BaseModel):
    id: UUID
    name: str
    version: str
    retrieved_at: datetime
    method: str
    license: str | None = None


class SourceIn(BaseModel):
    name: str
    version: str
    method: str
    license: str | None = None


class MappingOut(BaseModel):
    id: UUID
    source_id: UUID
    version: int
    mapping: dict[str, Any]
    created_by: str
    is_active: bool = True


class MappingIn(BaseModel):
    source_id: UUID
    mapping: dict[str, Any]
    created_by: str = "api"


class SessionOut(BaseModel):
    id: UUID
    source_id: UUID
    external_session_id: str
    agent: str | None = None
    model: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None


class SessionDetail(BaseModel):
    session: dict[str, Any]
    model_calls: list[dict[str, Any]]
    tool_calls: list[dict[str, Any]]


class IndicatorDefOut(BaseModel):
    id: str
    name: str
    calc: str
    unit: str
    scope: str
    missing: str


class DashboardOut(BaseModel):
    indicators: dict[str, Any]
    definitions: dict[str, IndicatorDefOut]


class AnalysisOut(BaseModel):
    sample_rows: list[dict[str, Any]]
    fields: list[str]
    row_count: int
    profiles: list[dict[str, Any]]
    proposal: dict[str, Any]


class ApplyMappingIn(BaseModel):
    mapping: dict[str, Any]
    source_id: UUID
    preview_rows: int = 5


class ApplyMappingOut(BaseModel):
    is_valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    preview: list[dict[str, Any]] | None = None
