"""In-memory UoW — replaces Postgres for API tests (no Docker needed).

Implements the same interfaces as `agentscope.domain.contracts.UoW`.
Used by `tests/integration/test_api.py` to test the full API flow
without a database.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import UUID

from agentscope.domain.contracts import (
    ImportRepository,
    MappingRepository,
    SessionRepository,
    SourceRepository,
    UoW,
)
from agentscope.domain.entities import (
    ImportRun,
    Mapping,
    ModelCall,
    Rejection,
    Session,
    Source,
    ToolCall,
)


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._sessions: dict[UUID, Session] = {}
        self._model_calls: dict[UUID, ModelCall] = {}
        self._tool_calls: dict[UUID, ToolCall] = {}

    def add_session(self, session: Session) -> Session:
        self._sessions[session.id] = session
        return session

    def get_session(self, session_id: UUID) -> Session | None:
        return self._sessions.get(session_id)

    def find_by_natural_key(self, source_id: UUID, external_session_id: str) -> Session | None:
        for s in self._sessions.values():
            if s.source_id == source_id and s.external_session_id == external_session_id:
                return s
        return None

    def add_model_call(self, call: ModelCall) -> ModelCall:
        self._model_calls[call.id] = call
        return call

    def add_tool_call(self, call: ToolCall) -> ToolCall:
        self._tool_calls[call.id] = call
        return call

    def list_sessions(
        self,
        *,
        source_id: UUID | None = None,
        agent: str | None = None,
        model: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Session]:
        result = list(self._sessions.values())
        if source_id is not None:
            result = [s for s in result if s.source_id == source_id]
        if agent is not None:
            result = [s for s in result if s.agent == agent]
        if model is not None:
            result = [s for s in result if s.model == model]
        return result[offset : offset + limit]

    def list_model_calls(self, session_ids: list) -> list[ModelCall]:
        return [c for c in self._model_calls.values() if c.session_id in session_ids]

    def list_tool_calls(self, session_ids: list) -> list[ToolCall]:
        return [t for t in self._tool_calls.values() if t.session_id in session_ids]

    def get_session_detail(self, session_id: UUID) -> dict[str, Any] | None:
        s = self._sessions.get(session_id)
        if s is None:
            return None
        calls = [c for c in self._model_calls.values() if c.session_id == session_id]
        tools = [t for t in self._tool_calls.values() if t.session_id == session_id]
        return {
            "session": s.__dict__,
            "model_calls": [c.__dict__ for c in calls],
            "tool_calls": [t.__dict__ for t in tools],
        }


class InMemoryImportRepository(ImportRepository):
    def __init__(self) -> None:
        self._imports: dict[UUID, ImportRun] = {}
        self._rejections: list[Rejection] = []

    def add_import(self, run: ImportRun) -> ImportRun:
        self._imports[run.id] = run
        return run

    def find_by_hash(self, file_hash: str) -> ImportRun | None:
        for r in self._imports.values():
            if r.file_hash == file_hash:
                return r
        return None

    def add_rejection(self, rejection: Rejection) -> Rejection:
        self._rejections.append(rejection)
        return rejection

    def list_imports(self, limit: int = 50) -> list[ImportRun]:
        return list(self._imports.values())[:limit]

    def get_import(self, import_id: UUID) -> ImportRun | None:
        return self._imports.get(import_id)


class InMemoryMappingRepository(MappingRepository):
    def __init__(self) -> None:
        self._mappings: dict[UUID, Mapping] = {}

    def add_mapping(self, mapping: Mapping) -> Mapping:
        self._mappings[mapping.id] = mapping
        return mapping

    def get_active_mapping(self, source_id: UUID) -> Mapping | None:
        for m in self._mappings.values():
            if m.source_id == source_id and m.is_active:
                return m
        return None

    def list_mappings(self, source_id: UUID | None = None) -> list[Mapping]:
        if source_id is not None:
            return [m for m in self._mappings.values() if m.source_id == source_id]
        return list(self._mappings.values())


class InMemorySourceRepository(SourceRepository):
    def __init__(self) -> None:
        self._sources: dict[UUID, Source] = {}

    def add_source(self, source: Source) -> Source:
        self._sources[source.id] = source
        return source

    def get_source(self, source_id: UUID) -> Source | None:
        return self._sources.get(source_id)

    def list_sources(self) -> list[Source]:
        return list(self._sources.values())


class InMemoryUoW(UoW):
    """Concrete UoW backed by plain dicts — no SQLAlchemy, no Postgres."""

    def __init__(self) -> None:
        self.sessions = InMemorySessionRepository()
        self.imports = InMemoryImportRepository()
        self.mappings = InMemoryMappingRepository()
        self.sources = InMemorySourceRepository()
        self._committed = False

    def commit(self) -> None:
        self._committed = True

    def rollback(self) -> None:
        pass


class InMemoryUoWFactory:
    """Factory that yields a fresh InMemoryUoW each call.

    Pass `shared=True` to share state across calls (for seeding + import
    in the same test).
    """

    def __init__(self, *, seed: bool = False) -> None:
        self._seed = seed
        self._shared: InMemoryUoW | None = None

    @contextmanager
    def __call__(self) -> Iterator[InMemoryUoW]:
        if self._shared is not None:
            yield self._shared
        else:
            uow = InMemoryUoW()
            if self._seed:
                from agentscope.domain.seed import seed_defaults

                seed_defaults(uow)
                uow.commit()
            yield uow

    def make_shared(self) -> InMemoryUoW:
        """Create a shared UoW that persists across calls."""

        self._shared = InMemoryUoW()
        if self._seed:
            from agentscope.domain.seed import seed_defaults

            seed_defaults(self._shared)
            self._shared.commit()
        return self._shared
