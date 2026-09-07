"""Postgres repositories — implement the domain ports with SQLAlchemy."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session as SASession
from sqlalchemy.orm import sessionmaker

from ....domain.contracts import (
    ImportRepository,
    MappingRepository,
    SessionRepository,
    SourceRepository,
    UoW,
)
from ....domain.entities import (
    ImportRun,
    Mapping,
    ModelCall,
    Rejection,
    Session,
    Source,
    ToolCall,
)
from .models import (
    ImportRunORM,
    MappingORM,
    ModelCallORM,
    RejectionORM,
    SessionORM,
    SourceORM,
    ToolCallORM,
)


def build_engine(url: str):
    return create_engine(url, future=True)


class _PostgresUoW(UoW):
    """Concrete UoW holding a SQLAlchemy session."""

    def __init__(self, session: SASession) -> None:
        self._session = session
        self.sessions = PostgresSessionRepository(session)
        self.imports = PostgresImportRepository(session)
        self.mappings = PostgresMappingRepository(session)
        self.sources = PostgresSourceRepository(session)

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()


class PostgresUoWFactory:
    def __init__(self, factory: sessionmaker) -> None:
        self._factory = factory

    @contextmanager
    def __call__(self) -> Iterator[_PostgresUoW]:
        session = self._factory()
        try:
            yield _PostgresUoW(session)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


def _oid(value: UUID | str) -> str:
    return str(value)


class PostgresSourceRepository(SourceRepository):
    def __init__(self, session: SASession) -> None:
        self._session = session

    def add_source(self, source: Source) -> Source:
        orm = SourceORM(
            id=_oid(source.id),
            name=source.name,
            version=source.version,
            retrieved_at=source.retrieved_at,
            method=source.method,
            license=source.license,
        )
        self._session.add(orm)
        self._session.flush()
        return source

    def get_source(self, source_id) -> Source | None:
        orm = self._session.get(SourceORM, _oid(source_id))
        if orm is None:
            return None
        return _orm_to_source(orm)

    def list_sources(self) -> list[Source]:
        return [_orm_to_source(o) for o in self._session.scalars(select(SourceORM))]


class PostgresImportRepository(ImportRepository):
    def __init__(self, session: SASession) -> None:
        self._session = session

    def add_import(self, run: ImportRun) -> ImportRun:
        orm = ImportRunORM(
            id=_oid(run.id),
            source_id=_oid(run.source_id),
            filename=run.filename,
            file_hash=run.file_hash,
            status=run.status,
            summary=run.summary,
            created_at=run.created_at,
        )
        self._session.add(orm)
        self._session.flush()
        return run

    def find_by_hash(self, file_hash: str) -> ImportRun | None:
        orm = self._session.scalar(
            select(ImportRunORM).where(ImportRunORM.file_hash == file_hash)
        )
        if orm is None:
            return None
        return _orm_to_import_run(orm)

    def add_rejection(self, rejection: Rejection) -> Rejection:
        orm = RejectionORM(
            id=_oid(rejection.id),
            import_run_id=_oid(rejection.import_run_id),
            line_number=rejection.line_number,
            reason=rejection.reason,
            excerpt=rejection.excerpt,
        )
        self._session.add(orm)
        return rejection

    def list_imports(self, limit: int = 50) -> list[ImportRun]:
        rows = self._session.scalars(
            select(ImportRunORM).order_by(ImportRunORM.created_at.desc()).limit(limit)
        )
        return [_orm_to_import_run(o) for o in rows]

    def get_import(self, import_id) -> ImportRun | None:
        orm = self._session.get(ImportRunORM, _oid(import_id))
        return _orm_to_import_run(orm) if orm else None


class PostgresSessionRepository(SessionRepository):
    def __init__(self, session: SASession) -> None:
        self._session = session

    def add_session(self, session: Session) -> Session:
        orm = SessionORM(
            id=_oid(session.id),
            source_id=_oid(session.source_id),
            import_run_id=_oid(session.import_run_id),
            external_session_id=session.external_session_id,
            agent=session.agent,
            model=session.model,
            started_at=session.started_at,
            ended_at=session.ended_at,
            metadata_=session.metadata,
        )
        self._session.add(orm)
        return session

    def get_session(self, session_id) -> Session | None:
        orm = self._session.get(SessionORM, _oid(session_id))
        return _orm_to_session(orm) if orm else None

    def find_by_natural_key(self, source_id, external_session_id: str) -> Session | None:
        orm = self._session.scalar(
            select(SessionORM).where(
                SessionORM.source_id == _oid(source_id),
                SessionORM.external_session_id == external_session_id,
            )
        )
        return _orm_to_session(orm) if orm else None

    def add_model_call(self, call: ModelCall) -> ModelCall:
        orm = ModelCallORM(
            id=_oid(call.id),
            session_id=_oid(call.session_id),
            round_index=call.round_index,
            model=call.model,
            prompt_tokens=call.prompt_tokens,
            completion_tokens=call.completion_tokens,
            cache_creation_tokens=call.cache_creation_tokens,
            latency_ms=call.latency_ms,
            is_error=call.is_error,
            occurred_at=call.occurred_at,
            raw_payload=call.raw_payload,
        )
        self._session.add(orm)
        return call

    def add_tool_call(self, call: ToolCall) -> ToolCall:
        orm = ToolCallORM(
            id=_oid(call.id),
            session_id=_oid(call.session_id),
            model_call_id=_oid(call.model_call_id) if call.model_call_id else None,
            tool_name=call.tool_name,
            input_chars=call.input_chars,
            result_chars=call.result_chars,
            wall_latency_ms=call.wall_latency_ms,
            internal_latency_ms=call.internal_latency_ms,
            is_error=call.is_error,
            occurred_at=call.occurred_at,
        )
        self._session.add(orm)
        return call

    def list_sessions(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Session]:
        stmt = select(SessionORM)
        if source_id is not None:
            stmt = stmt.where(SessionORM.source_id == _oid(source_id))
        if agent is not None:
            stmt = stmt.where(SessionORM.agent == agent)
        if model is not None:
            stmt = stmt.where(SessionORM.model == model)
        stmt = stmt.order_by(SessionORM.started_at.desc()).limit(limit).offset(offset)
        return [_orm_to_session(o) for o in self._session.scalars(stmt)]

    def list_model_calls(self, session_ids: list) -> list[ModelCall]:
        if not session_ids:
            return []
        ids = [_oid(sid) for sid in session_ids]
        stmt = select(ModelCallORM).where(ModelCallORM.session_id.in_(ids))
        return [
            ModelCall(
                id=UUID(c.id),
                session_id=UUID(c.session_id),
                round_index=c.round_index,
                model=c.model,
                prompt_tokens=c.prompt_tokens,
                completion_tokens=c.completion_tokens,
                cache_creation_tokens=c.cache_creation_tokens,
                latency_ms=c.latency_ms,
                is_error=c.is_error,
                occurred_at=c.occurred_at,
                raw_payload=c.raw_payload,
            )
            for c in self._session.scalars(stmt)
        ]

    def list_tool_calls(self, session_ids: list) -> list[ToolCall]:
        if not session_ids:
            return []
        ids = [_oid(sid) for sid in session_ids]
        stmt = select(ToolCallORM).where(ToolCallORM.session_id.in_(ids))
        return [
            ToolCall(
                id=UUID(t.id),
                session_id=UUID(t.session_id),
                model_call_id=UUID(t.model_call_id) if t.model_call_id else None,
                tool_name=t.tool_name,
                input_chars=t.input_chars,
                result_chars=t.result_chars,
                wall_latency_ms=t.wall_latency_ms,
                internal_latency_ms=t.internal_latency_ms,
                is_error=t.is_error,
                occurred_at=t.occurred_at,
            )
            for t in self._session.scalars(stmt)
        ]

    def get_session_detail(self, session_id) -> dict | None:
        orm = self._session.get(SessionORM, _oid(session_id))
        if orm is None:
            return None
        calls = [
            ModelCall(
                id=UUID(c.id),
                session_id=UUID(c.session_id),
                round_index=c.round_index,
                model=c.model,
                prompt_tokens=c.prompt_tokens,
                completion_tokens=c.completion_tokens,
                cache_creation_tokens=c.cache_creation_tokens,
                latency_ms=c.latency_ms,
                is_error=c.is_error,
                occurred_at=c.occurred_at,
                raw_payload=c.raw_payload,
            )
            for c in orm.model_calls
        ]
        tools = [
            ToolCall(
                id=UUID(t.id),
                session_id=UUID(t.session_id),
                model_call_id=UUID(t.model_call_id) if t.model_call_id else None,
                tool_name=t.tool_name,
                input_chars=t.input_chars,
                result_chars=t.result_chars,
                wall_latency_ms=t.wall_latency_ms,
                internal_latency_ms=t.internal_latency_ms,
                is_error=t.is_error,
                occurred_at=t.occurred_at,
            )
            for t in orm.tool_calls
        ]
        s = _orm_to_session(orm)
        return {
            "session": s.__dict__,
            "model_calls": [c.__dict__ for c in calls],
            "tool_calls": [t.__dict__ for t in tools],
        }


class PostgresMappingRepository(MappingRepository):
    def __init__(self, session: SASession) -> None:
        self._session = session

    def add_mapping(self, mapping: Mapping) -> Mapping:
        orm = MappingORM(
            id=_oid(mapping.id),
            source_id=_oid(mapping.source_id),
            version=mapping.version,
            mapping=mapping.mapping,
            created_by=mapping.created_by,
            validated_at=mapping.validated_at,
            is_active=mapping.is_active,
        )
        self._session.add(orm)
        return mapping

    def get_active_mapping(self, source_id) -> Mapping | None:
        orm = self._session.scalar(
            select(MappingORM).where(
                MappingORM.source_id == _oid(source_id),
                MappingORM.is_active.is_(True),
            )
        )
        return _orm_to_mapping(orm) if orm else None

    def list_mappings(self, source_id=None) -> list[Mapping]:
        stmt = select(MappingORM)
        if source_id is not None:
            stmt = stmt.where(MappingORM.source_id == _oid(source_id))
        return [_orm_to_mapping(o) for o in self._session.scalars(stmt)]


def _orm_to_source(orm: SourceORM) -> Source:
    return Source(
        id=UUID(orm.id),
        name=orm.name,
        version=orm.version,
        retrieved_at=orm.retrieved_at,
        method=orm.method,
        license=orm.license,
    )


def _orm_to_import_run(orm: ImportRunORM) -> ImportRun:
    return ImportRun(
        id=UUID(orm.id),
        source_id=UUID(orm.source_id),
        filename=orm.filename,
        file_hash=orm.file_hash,
        status=orm.status,
        summary=orm.summary or {},
        created_at=orm.created_at,
    )


def _orm_to_session(orm: SessionORM) -> Session:
    return Session(
        id=UUID(orm.id),
        source_id=UUID(orm.source_id),
        import_run_id=UUID(orm.import_run_id),
        external_session_id=orm.external_session_id,
        agent=orm.agent,
        model=orm.model,
        started_at=orm.started_at,
        ended_at=orm.ended_at,
        metadata=orm.metadata_ or {},
    )


def _orm_to_mapping(orm: MappingORM) -> Mapping:
    return Mapping(
        id=UUID(orm.id),
        source_id=UUID(orm.source_id),
        version=orm.version,
        mapping=orm.mapping or {},
        created_by=orm.created_by,
        validated_at=orm.validated_at,
        is_active=orm.is_active,
    )
