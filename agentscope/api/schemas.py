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
    duration_ms: float | None = None
    total_tokens: int | None = None
    tool_calls: int = 0
    errors: int = 0
    status: str = "completed"
    quality: str = "complete"


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


# --- New schemas for the dashboard pages ---


class AgentOut(BaseModel):
    name: str
    sessions: int
    total_tokens: int | None = None
    tool_calls: int = 0
    errors: int = 0
    avg_duration_ms: float | None = None
    cache_rate: float | None = None
    error_rate: float | None = None
    last_active_iso: str | None = None


class ToolOut(BaseModel):
    name: str
    calls: int
    sessions: int
    errors: int
    error_rate: float | None = None
    p50_ms: int | None = None
    p95_ms: int | None = None
    p99_ms: int | None = None
    avg_input_chars: int | None = None
    avg_result_chars: int | None = None


class ModelOut(BaseModel):
    name: str
    sessions: int
    requests: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cache_tokens: int | None = None
    total_tokens: int | None = None
    avg_latency_ms: int | None = None
    error_rate: float | None = None
    cache_rate: float | None = None


class ImportRunOut(BaseModel):
    id: UUID
    source_id: UUID
    filename: str
    file_hash: str
    status: str
    rows_read: int = 0
    sessions_imported: int = 0
    model_calls_imported: int = 0
    tool_calls_imported: int = 0
    duplicates: int = 0
    created_at: datetime


class RejectionOut(BaseModel):
    id: UUID
    import_run_id: UUID
    line_number: int
    reason: str
    excerpt: str


class DataQualityOut(BaseModel):
    total_sessions: int
    with_tokens: int
    with_duration: int
    with_cache: int
    with_errors: int
    tokens_coverage: float | None = None
    duration_coverage: float | None = None
    cache_coverage: float | None = None
    error_coverage: float | None = None
    sources: list[dict[str, Any]] = Field(default_factory=list)
    imports: list[ImportRunOut] = Field(default_factory=list)
    rejections: list[RejectionOut] = Field(default_factory=list)


class SettingsOut(BaseModel):
    app_env: str
    app_host: str
    app_port: int
    cors_origins: str
    ia_provider: str
    ia_model: str
    ia_model_alt: str
    openrouter_base_url: str
    database_url: str = ""  # masked in the router


class ActivityBucketOut(BaseModel):
    bucket: str
    sessions: int
    prompt_tokens: int
    completion_tokens: int
    cache_tokens: int
    total_tokens: int
    tool_calls: int
    errors: int
