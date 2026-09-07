"""SQLAlchemy ORM models for Postgres.

These are infrastructure details — the domain never imports them.
The relational schema follows the model described in `docs/data_model.md`.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class SourceORM(Base):
    __tablename__ = "source"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    method: Mapped[str] = mapped_column(Text, nullable=False)
    license: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ImportRunORM(Base):
    __tablename__ = "import_run"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("source.id"), nullable=False
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="started")
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class SessionORM(Base):
    __tablename__ = "session"
    __table_args__ = (
        UniqueConstraint("source_id", "external_session_id", name="uq_session_natural_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("source.id"), nullable=False
    )
    import_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("import_run.id"), nullable=False
    )
    external_session_id: Mapped[str] = mapped_column(Text, nullable=False)
    agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)

    model_calls: Mapped[list[ModelCallORM]] = relationship(back_populates="session")
    tool_calls: Mapped[list[ToolCallORM]] = relationship(back_populates="session")


class ModelCallORM(Base):
    __tablename__ = "model_call"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("session.id"), nullable=False
    )
    round_index: Mapped[int] = mapped_column(Integer, default=0)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_creation_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_error: Mapped[bool] = mapped_column(Boolean, default=False)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    session: Mapped[SessionORM] = relationship(back_populates="model_calls")


class ToolCallORM(Base):
    __tablename__ = "tool_call"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("session.id"), nullable=False
    )
    model_call_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("model_call.id"), nullable=True
    )
    tool_name: Mapped[str] = mapped_column(String(255), nullable=False)
    input_chars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_chars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wall_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    internal_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_error: Mapped[bool] = mapped_column(Boolean, default=False)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    session: Mapped[SessionORM] = relationship(back_populates="tool_calls")


class MappingORM(Base):
    __tablename__ = "mapping"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("source.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    mapping: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class RejectionORM(Base):
    __tablename__ = "rejection"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    import_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("import_run.id"), nullable=False
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False, default="")


def _to_uuid_str(value: UUID | str) -> str:
    return str(value)


def _loads(data: Any) -> Any:
    if isinstance(data, str):
        return json.loads(data)
    return data
