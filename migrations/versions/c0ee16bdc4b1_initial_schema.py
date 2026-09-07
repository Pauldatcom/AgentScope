"""initial schema

Revision ID: c0ee16bdc4b1
Revises:
Create Date: 2026-09-07 10:34:11.344515
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c0ee16bdc4b1"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the 7 tables of the AgentScope relational model (3NF)."""
    op.create_table(
        "source",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("retrieved_at", sa.DateTime, nullable=False),
        sa.Column("method", sa.Text, nullable=False),
        sa.Column("license", sa.String(255), nullable=True),
    )

    op.create_table(
        "import_run",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "source_id",
            sa.String(36),
            sa.ForeignKey("source.id"),
            nullable=False,
        ),
        sa.Column("filename", sa.Text, nullable=False),
        sa.Column("file_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="started"),
        sa.Column("summary", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "mapping",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "source_id",
            sa.String(36),
            sa.ForeignKey("source.id"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer, server_default="1"),
        sa.Column("mapping", postgresql.JSONB, nullable=False),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("validated_at", sa.DateTime, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
    )

    op.create_table(
        "session",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "source_id",
            sa.String(36),
            sa.ForeignKey("source.id"),
            nullable=False,
        ),
        sa.Column(
            "import_run_id",
            sa.String(36),
            sa.ForeignKey("import_run.id"),
            nullable=False,
        ),
        sa.Column("external_session_id", sa.Text, nullable=False),
        sa.Column("agent", sa.String(255), nullable=True),
        sa.Column("model", sa.String(255), nullable=True),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("ended_at", sa.DateTime, nullable=True),
        sa.Column("metadata", postgresql.JSONB, server_default="{}"),
        sa.UniqueConstraint(
            "source_id",
            "external_session_id",
            name="uq_session_natural_key",
        ),
    )

    op.create_table(
        "model_call",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("session.id"),
            nullable=False,
        ),
        sa.Column("round_index", sa.Integer, server_default="0"),
        sa.Column("model", sa.String(255), nullable=True),
        sa.Column("prompt_tokens", sa.Integer, nullable=True),
        sa.Column("completion_tokens", sa.Integer, nullable=True),
        sa.Column("cache_creation_tokens", sa.Integer, nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("is_error", sa.Boolean, server_default="false"),
        sa.Column("occurred_at", sa.DateTime, nullable=True),
        sa.Column("raw_payload", postgresql.JSONB, server_default="{}"),
    )

    op.create_table(
        "tool_call",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("session.id"),
            nullable=False,
        ),
        sa.Column(
            "model_call_id",
            sa.String(36),
            sa.ForeignKey("model_call.id"),
            nullable=True,
        ),
        sa.Column("tool_name", sa.String(255), nullable=False),
        sa.Column("input_chars", sa.Integer, nullable=True),
        sa.Column("result_chars", sa.Integer, nullable=True),
        sa.Column("wall_latency_ms", sa.Integer, nullable=True),
        sa.Column("internal_latency_ms", sa.Integer, nullable=True),
        sa.Column("is_error", sa.Boolean, server_default="false"),
        sa.Column("occurred_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "rejection",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "import_run_id",
            sa.String(36),
            sa.ForeignKey("import_run.id"),
            nullable=False,
        ),
        sa.Column("line_number", sa.Integer, nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("excerpt", sa.Text, nullable=False, server_default=""),
    )

    op.create_index("ix_session_source_id", "session", ["source_id"])
    op.create_index("ix_model_call_session_id", "model_call", ["session_id"])
    op.create_index("ix_tool_call_session_id", "tool_call", ["session_id"])
    op.create_index("ix_mapping_source_id", "mapping", ["source_id"])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_index("ix_mapping_source_id", table_name="mapping")
    op.drop_index("ix_tool_call_session_id", table_name="tool_call")
    op.drop_index("ix_model_call_session_id", table_name="model_call")
    op.drop_index("ix_session_source_id", table_name="session")
    op.drop_table("rejection")
    op.drop_table("tool_call")
    op.drop_table("model_call")
    op.drop_table("session")
    op.drop_table("mapping")
    op.drop_table("import_run")
    op.drop_table("source")
