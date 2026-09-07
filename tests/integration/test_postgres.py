"""Integration tests — require Postgres via docker-compose.

Run with: pytest -m integration
Skipped automatically if DATABASE_URL is not reachable.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from agentscope.adapters.files.jsonl_reader import JsonlReader
from agentscope.adapters.storage.postgres import build_engine
from agentscope.adapters.storage.postgres.models import Base
from agentscope.adapters.storage.postgres.repositories import (
    PostgresUoWFactory,
)
from agentscope.application.import_file import ImportUseCase
from agentscope.config import get_settings
from agentscope.domain.entities import Source
from sqlalchemy.orm import sessionmaker


def _can_connect(url: str) -> bool:
    try:
        engine = build_engine(url)
        with engine.connect() as _:
            return True
    except Exception:
        return False


pytestmark = pytest.mark.integration


@pytest.fixture
def postgres_uow_factory():
    settings = get_settings()
    if not _can_connect(settings.database_url):
        pytest.skip("Postgres not available; start it with `docker compose up -d postgres`.")
    engine = build_engine(settings.database_url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, future=True)
    return PostgresUoWFactory(factory)


_TRACELAB_MAPPING = {
    "session": {
        "external_session_id": "session_id",
        "agent": "provider",
        "model": "model",
    },
    "model_call": {
        "round_index": "round_index",
        "model": "model",
        "prompt_tokens": "input_tokens_total",
        "completion_tokens": "output_tokens",
    },
    "tool_call": {
        "tools_path": "tools",
        "tool_name": "tool_name",
        "wall_latency_ms": "tool_wall_latency_ms",
    },
}


def test_import_tracelab_jsonl_then_reimport_is_idempotent(postgres_uow_factory, tmp_path: Path):
    source = Source(
        id=uuid4(), name="tracelab", version="v0.0.1",
        retrieved_at=datetime.now(UTC),
        method="manual download", license="CC-BY-4.0",
    )
    with postgres_uow_factory() as uow:
        uow.sources.add_source(source)
        uow.commit()

    rows = [
        {"session_id": "s-1", "provider": "claude", "model": "claude-3-5",
         "round_index": 0, "input_tokens_total": 10, "output_tokens": 5, "tools": []},
        {"session_id": "s-1", "provider": "claude", "model": "claude-3-5",
         "round_index": 1, "input_tokens_total": 20, "output_tokens": 8, "tools": []},
        {"session_id": "s-2", "provider": "codex", "model": "gpt-4o",
         "round_index": 0, "input_tokens_total": 30, "output_tokens": 3, "tools": []},
    ]
    path = tmp_path / "trace.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")

    uc = ImportUseCase(reader=JsonlReader(), uow_factory=postgres_uow_factory)
    report = uc.execute(str(path), source=source, mapping=_TRACELAB_MAPPING)
    assert report.is_duplicate_run is False
    assert report.sessions_imported == 2
    assert report.model_calls_imported == 3

    report2 = uc.execute(str(path), source=source, mapping=_TRACELAB_MAPPING)
    assert report2.is_duplicate_run is True
    assert report2.sessions_imported == 0


def test_indicator_stays_correct_after_join_and_filter(postgres_uow_factory, tmp_path: Path):
    source = Source(
        id=uuid4(), name="tracelab", version="v0.0.1",
        retrieved_at=datetime.now(UTC),
        method="manual download", license="CC-BY-4.0",
    )
    with postgres_uow_factory() as uow:
        uow.sources.add_source(source)
        uow.commit()

    rows = [
        {"session_id": "s-1", "provider": "claude", "model": "claude-3-5",
         "round_index": 0, "input_tokens_total": 100, "output_tokens": 50, "tools": []},
        {"session_id": "s-2", "provider": "codex", "model": "gpt-4o",
         "round_index": 0, "input_tokens_total": 200, "output_tokens": 100, "tools": []},
    ]
    path = tmp_path / "trace2.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")

    uc = ImportUseCase(reader=JsonlReader(), uow_factory=postgres_uow_factory)
    uc.execute(str(path), source=source, mapping=_TRACELAB_MAPPING)

    with postgres_uow_factory() as uow:
        sessions = uow.sessions.list_sessions(source_id=source.id)
        assert len(sessions) == 2
        detail = uow.sessions.get_session_detail(sessions[0].id)
        assert detail is not None
        assert len(detail["model_calls"]) == 1
        assert detail["model_calls"][0]["prompt_tokens"] == 100
