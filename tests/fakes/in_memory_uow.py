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

    # --- Aggregate methods (reuse pure functions for in-memory tests) ---

    def _filtered_sessions(self, *, source_id=None, agent=None, model=None, limit=10**6, offset=0):
        result = list(self._sessions.values())
        if source_id is not None:
            result = [s for s in result if s.source_id == source_id]
        if agent is not None:
            result = [s for s in result if s.agent == agent]
        if model is not None:
            result = [s for s in result if s.model == model]
        return result[offset : offset + limit]

    def aggregate_dashboard(self, *, source_id=None, agent=None, model=None) -> dict:
        from agentscope.domain.indicators import (
            compute_avg_duration,
            compute_cache_rate,
            compute_error_rate,
            compute_sessions_by_agent,
            compute_tokens_by_model,
            compute_tool_distribution,
        )
        sessions = self._filtered_sessions(source_id=source_id, agent=agent, model=model)
        sids = [s.id for s in sessions]
        calls = [c for c in self._model_calls.values() if c.session_id in sids]
        tools = [t for t in self._tool_calls.values() if t.session_id in sids]
        return {
            "tokens_by_model": [r.__dict__ for r in compute_tokens_by_model(sessions, calls)],
            "sessions_by_agent": [r.__dict__ for r in compute_sessions_by_agent(sessions)],
            "tool_distribution": [r.__dict__ for r in compute_tool_distribution(tools)],
            "error_rate": compute_error_rate(sessions, calls).__dict__,
            "avg_duration": compute_avg_duration(sessions).__dict__,
            "cache_rate": compute_cache_rate(sessions, calls).__dict__,
        }

    def aggregate_agent_breakdown(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        from agentscope.domain.indicators import compute_agent_breakdown
        sessions = self._filtered_sessions(source_id=source_id, agent=agent, model=model)
        sids = [s.id for s in sessions]
        calls = [c for c in self._model_calls.values() if c.session_id in sids]
        tools = [t for t in self._tool_calls.values() if t.session_id in sids]
        return [r.__dict__ for r in compute_agent_breakdown(sessions, calls, tools)]

    def aggregate_tool_breakdown(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        from agentscope.domain.indicators import compute_tool_breakdown
        sessions = self._filtered_sessions(source_id=source_id, agent=agent, model=model)
        sids = [s.id for s in sessions]
        tools = [t for t in self._tool_calls.values() if t.session_id in sids]
        return [r.__dict__ for r in compute_tool_breakdown(sessions, tools)]

    def aggregate_model_breakdown(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        from agentscope.domain.indicators import compute_model_breakdown
        sessions = self._filtered_sessions(source_id=source_id, agent=agent, model=model)
        sids = [s.id for s in sessions]
        calls = [c for c in self._model_calls.values() if c.session_id in sids]
        return [r.__dict__ for r in compute_model_breakdown(sessions, calls)]

    def aggregate_activity_timeseries(self, *, source_id=None, agent=None, model=None) -> list[dict]:
        from agentscope.domain.indicators import compute_activity_timeseries
        sessions = self._filtered_sessions(source_id=source_id, agent=agent, model=model)
        sids = [s.id for s in sessions]
        calls = [c for c in self._model_calls.values() if c.session_id in sids]
        tools = [t for t in self._tool_calls.values() if t.session_id in sids]
        return [r.__dict__ for r in compute_activity_timeseries(sessions, calls, tools)]

    def aggregate_data_completeness(self, *, source_id=None, agent=None, model=None) -> dict:
        from agentscope.domain.indicators import compute_data_completeness
        sessions = self._filtered_sessions(source_id=source_id, agent=agent, model=model)
        sids = [s.id for s in sessions]
        calls = [c for c in self._model_calls.values() if c.session_id in sids]
        return compute_data_completeness(sessions, calls).__dict__

    def session_list_enriched(self, *, source_id=None, agent=None, model=None, limit=100, offset=0) -> list[dict]:
        sessions = self._filtered_sessions(
            source_id=source_id, agent=agent, model=model, limit=limit, offset=offset
        )
        results = []
        for s in sessions:
            calls = [c for c in self._model_calls.values() if c.session_id == s.id]
            tools = [t for t in self._tool_calls.values() if t.session_id == s.id]
            duration_ms = None
            if s.started_at is not None and s.ended_at is not None:
                duration_ms = (s.ended_at - s.started_at).total_seconds() * 1000
            total_tokens = None
            if any(c.metric_available for c in calls):
                total_tokens = sum(c.total_tokens or 0 for c in calls)
            errors = sum(1 for c in calls if c.is_error)
            if errors == 0:
                status = "completed"
            elif errors > 2:
                status = "error"
            else:
                status = "completed_with_errors"
            missing: list[str] = []
            if total_tokens is None:
                missing.append("tokens")
            if duration_ms is None:
                missing.append("duration")
            if not missing:
                quality = "complete"
            elif len(missing) <= 2:
                quality = "partial"
            else:
                quality = "incomplete"
            results.append({
                "id": str(s.id),
                "source_id": str(s.source_id),
                "external_session_id": s.external_session_id,
                "agent": s.agent,
                "model": s.model,
                "started_at": s.started_at,
                "ended_at": s.ended_at,
                "duration_ms": duration_ms,
                "total_tokens": total_tokens,
                "tool_calls": len(tools),
                "errors": errors,
                "status": status,
                "quality": quality,
            })
        return results


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

    def list_rejections(self, import_id=None, limit: int = 100) -> list[Rejection]:
        result = self._rejections
        if import_id is not None:
            result = [r for r in result if r.import_run_id == import_id]
        return result[:limit]


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
