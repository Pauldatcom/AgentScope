"""Postgres repositories — implement the domain ports with SQLAlchemy."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from sqlalchemy import create_engine, func, select
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

    def list_rejections(self, import_id=None, limit: int = 100) -> list[Rejection]:
        stmt = select(RejectionORM)
        if import_id is not None:
            stmt = stmt.where(RejectionORM.import_run_id == _oid(import_id))
        stmt = stmt.order_by(RejectionORM.line_number.asc()).limit(limit)
        return [_orm_to_rejection(o) for o in self._session.scalars(stmt)]


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

    # --- SQL-side aggregate methods (avoid hydrating hundreds of k rows) ---

    def _session_filter(self, source_id, agent, model):
        """Build a WHERE clause list for session-level filters."""
        clauses = []
        if source_id is not None:
            clauses.append(SessionORM.source_id == _oid(source_id))
        if agent is not None:
            clauses.append(SessionORM.agent == agent)
        if model is not None:
            clauses.append(SessionORM.model == model)
        return clauses

    def aggregate_dashboard(
        self, *, source_id=None, agent=None, model=None
    ) -> dict:
        clauses = self._session_filter(source_id, agent, model)

        # tokens_by_model — JOIN model_call → session (faster than IN subquery)
        tokens_q = (
            select(
                ModelCallORM.model,
                func.coalesce(func.sum(ModelCallORM.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(ModelCallORM.completion_tokens), 0).label("completion_tokens"),
                func.count(ModelCallORM.id).label("sessions_counted"),
            )
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(*clauses)
            .group_by(ModelCallORM.model)
        )
        tokens_by_model = []
        for row in self._session.execute(tokens_q):
            pt, ct = (row.prompt_tokens or 0), (row.completion_tokens or 0)
            tokens_by_model.append({
                "model": row.model,
                "prompt_tokens": pt,
                "completion_tokens": ct,
                "total_tokens": pt + ct,
                "sessions_counted": row.sessions_counted,
            })
        tokens_by_model.sort(key=lambda r: r["model"] or "")

        # sessions_by_agent
        agent_q = (
            select(
                SessionORM.agent.label("agent"),
                func.count(SessionORM.id).label("count"),
            )
            .where(*clauses)
            .group_by(SessionORM.agent)
        )
        sessions_by_agent = [
            {"agent": r.agent or "unknown", "count": r.count}
            for r in self._session.execute(agent_q)
        ]
        sessions_by_agent.sort(key=lambda r: (-r["count"], r["agent"]))

        # tool_distribution — JOIN tool_call → session
        tool_q = (
            select(
                ToolCallORM.tool_name.label("tool_name"),
                func.count(ToolCallORM.id).label("count"),
            )
            .join(SessionORM, SessionORM.id == ToolCallORM.session_id)
            .where(*clauses)
            .group_by(ToolCallORM.tool_name)
        )
        tool_rows = list(self._session.execute(tool_q))
        total_tools = sum(r.count for r in tool_rows) or 1
        tool_distribution = [
            {"tool_name": r.tool_name or "unknown", "count": r.count, "share": r.count / total_tools}
            for r in sorted(tool_rows, key=lambda x: (-x.count, x.tool_name or ""))
        ]

        # error_rate (sessions with any error model call)
        total_sessions = self._session.scalar(
            select(func.count(SessionORM.id)).where(*clauses)
        ) or 0
        err_sessions_q = (
            select(func.count(func.distinct(ModelCallORM.session_id)))
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(*clauses, ModelCallORM.is_error.is_(True))
        )
        with_error = self._session.scalar(err_sessions_q) or 0
        error_rate = {
            "total": total_sessions,
            "with_error": with_error,
            "rate": (with_error / total_sessions) if total_sessions else None,
        }

        # avg_duration
        dur_q = select(
            func.avg(
                func.extract("epoch", (SessionORM.ended_at - SessionORM.started_at)) * 1000
            )
        ).where(
            *clauses,
            SessionORM.started_at.is_not(None),
            SessionORM.ended_at.is_not(None),
        )
        avg_ms = self._session.scalar(dur_q)
        with_duration = self._session.scalar(
            select(func.count(SessionORM.id)).where(
                *clauses,
                SessionORM.started_at.is_not(None),
                SessionORM.ended_at.is_not(None),
            )
        ) or 0
        avg_duration = {
            "total": total_sessions,
            "with_duration": with_duration,
            "avg_ms": float(avg_ms) if avg_ms is not None else None,
        }

        # cache_rate — JOIN model_call → session
        cache_reported_q = (
            select(func.count(ModelCallORM.id))
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(*clauses, ModelCallORM.cache_creation_tokens.is_not(None))
        )
        with_cache = self._session.scalar(cache_reported_q) or 0
        cached_q = (
            select(func.count(ModelCallORM.id))
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(
                *clauses,
                ModelCallORM.cache_creation_tokens.is_not(None),
                ModelCallORM.cache_creation_tokens > 0,
            )
        )
        cached_count = self._session.scalar(cached_q) or 0
        cache_rate = {
            "total": total_sessions,
            "with_cache": with_cache,
            "rate": (cached_count / with_cache) if with_cache else None,
        }

        return {
            "tokens_by_model": tokens_by_model,
            "sessions_by_agent": sessions_by_agent,
            "tool_distribution": tool_distribution,
            "error_rate": error_rate,
            "avg_duration": avg_duration,
            "cache_rate": cache_rate,
        }

    def aggregate_agent_breakdown(
        self, *, source_id=None, agent=None, model=None
    ) -> list[dict]:
        clauses = self._session_filter(source_id, agent, model)

        # Base: sessions per agent + avg duration + last active
        base_q = (
            select(
                SessionORM.agent.label("agent"),
                func.count(SessionORM.id).label("sessions"),
                func.avg(
                    func.extract("epoch", (SessionORM.ended_at - SessionORM.started_at)) * 1000
                ).label("avg_duration_ms"),
                func.max(SessionORM.started_at).label("last_active"),
            )
            .where(*clauses)
            .group_by(SessionORM.agent)
        )
        base_map: dict[str, dict] = {}
        for row in self._session.execute(base_q):
            base_map[row.agent or "unknown"] = {
                "sessions": row.sessions,
                "avg_duration_ms": float(row.avg_duration_ms) if row.avg_duration_ms else None,
                "last_active": row.last_active,
            }

        # Tokens per agent (join model_call → session → group by agent)
        session_ids_subq = select(SessionORM.id)
        for c in clauses:
            session_ids_subq = session_ids_subq.where(c)

        tokens_q = (
            select(
                SessionORM.agent.label("agent"),
                func.coalesce(
                    func.sum(ModelCallORM.prompt_tokens) + func.sum(ModelCallORM.completion_tokens),
                    0,
                ).label("total_tokens"),
                func.count(ModelCallORM.id).filter(ModelCallORM.is_error.is_(True)).label("errors"),
            )
            .join(ModelCallORM, ModelCallORM.session_id == SessionORM.id)
            .where(*clauses)
            .group_by(SessionORM.agent)
        )
        tokens_map: dict[str, dict] = {}
        for row in self._session.execute(tokens_q):
            tokens_map[row.agent or "unknown"] = {
                "total_tokens": int(row.total_tokens) if row.total_tokens else None,
                "errors": row.errors or 0,
            }

        # Tool calls per agent
        tools_q = (
            select(
                SessionORM.agent.label("agent"),
                func.count(ToolCallORM.id).label("tool_calls"),
            )
            .join(ToolCallORM, ToolCallORM.session_id == SessionORM.id)
            .where(*clauses)
            .group_by(SessionORM.agent)
        )
        tools_map: dict[str, int] = {}
        for row in self._session.execute(tools_q):
            tools_map[row.agent or "unknown"] = row.tool_calls or 0

        # Merge
        all_agents = set(base_map) | set(tokens_map) | set(tools_map)
        results = []
        for ag in all_agents:
            b = base_map.get(ag, {})
            t = tokens_map.get(ag, {})
            sessions = b.get("sessions", 0)
            errors = t.get("errors", 0)
            results.append({
                "agent": ag,
                "sessions": sessions,
                "total_tokens": t.get("total_tokens"),
                "tool_calls": tools_map.get(ag, 0),
                "errors": errors,
                "avg_duration_ms": b.get("avg_duration_ms"),
                "cache_rate": None,
                "error_rate": (errors / sessions) if sessions and errors else None,
                "last_active_iso": b["last_active"].isoformat() if b.get("last_active") else None,
            })
        results.sort(key=lambda r: (-r["sessions"], r["agent"]))
        return results

    def aggregate_tool_breakdown(
        self, *, source_id=None, agent=None, model=None
    ) -> list[dict]:
        clauses = self._session_filter(source_id, agent, model)
        session_ids_subq = select(SessionORM.id)
        for c in clauses:
            session_ids_subq = session_ids_subq.where(c)

        q = (
            select(
                ToolCallORM.tool_name.label("name"),
                func.count(ToolCallORM.id).label("calls"),
                func.count(func.distinct(ToolCallORM.session_id)).label("sessions"),
                func.count(ToolCallORM.id).filter(ToolCallORM.is_error.is_(True)).label("errors"),
                func.avg(ToolCallORM.input_chars).label("avg_input_chars"),
                func.avg(ToolCallORM.result_chars).label("avg_result_chars"),
            )
            .join(SessionORM, SessionORM.id == ToolCallORM.session_id)
            .where(*clauses)
            .group_by(ToolCallORM.tool_name)
            .order_by(func.count(ToolCallORM.id).desc())
        )
        rows = list(self._session.execute(q))
        results = []
        for row in rows:
            calls = row.calls or 0
            errors = row.errors or 0
            results.append({
                "name": row.name or "unknown",
                "calls": calls,
                "sessions": row.sessions,
                "errors": errors,
                "error_rate": (errors / calls) if calls else None,
                "p50_ms": None,
                "p95_ms": None,
                "p99_ms": None,
                "avg_input_chars": int(row.avg_input_chars) if row.avg_input_chars else None,
                "avg_result_chars": int(row.avg_result_chars) if row.avg_result_chars else None,
            })
        return results

    def aggregate_model_breakdown(
        self, *, source_id=None, agent=None, model=None
    ) -> list[dict]:
        clauses = self._session_filter(source_id, agent, model)
        session_ids_subq = select(SessionORM.id)
        for c in clauses:
            session_ids_subq = session_ids_subq.where(c)

        q = (
            select(
                ModelCallORM.model.label("name"),
                func.count(func.distinct(ModelCallORM.session_id)).label("sessions"),
                func.count(ModelCallORM.id).label("requests"),
                func.coalesce(func.sum(ModelCallORM.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(ModelCallORM.completion_tokens), 0).label("completion_tokens"),
                func.coalesce(func.sum(ModelCallORM.cache_creation_tokens), 0).label("cache_tokens"),
                func.avg(ModelCallORM.latency_ms).label("avg_latency_ms"),
                func.count(ModelCallORM.id).filter(ModelCallORM.is_error.is_(True)).label("errors"),
                func.count(ModelCallORM.id).filter(
                    ModelCallORM.cache_creation_tokens.is_not(None)
                ).label("cache_reported"),
                func.count(ModelCallORM.id).filter(
                    ModelCallORM.cache_creation_tokens.is_not(None),
                    ModelCallORM.cache_creation_tokens > 0,
                ).label("cached"),
            )
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(*clauses)
            .group_by(ModelCallORM.model)
        )
        rows = list(self._session.execute(q))
        results = []
        for row in rows:
            req = row.requests or 0
            err = row.errors or 0
            cr = row.cache_reported or 0
            cached = row.cached or 0
            has_tokens = (row.prompt_tokens or 0) > 0 or (row.completion_tokens or 0) > 0
            results.append({
                "name": row.name or "unknown",
                "sessions": row.sessions,
                "requests": req,
                "prompt_tokens": int(row.prompt_tokens) if has_tokens else None,
                "completion_tokens": int(row.completion_tokens) if has_tokens else None,
                "cache_tokens": int(row.cache_tokens) if cr > 0 else None,
                "total_tokens": int(row.prompt_tokens + row.completion_tokens) if has_tokens else None,
                "avg_latency_ms": int(row.avg_latency_ms) if row.avg_latency_ms else None,
                "error_rate": (err / req) if req else None,
                "cache_rate": (cached / cr) if cr else None,
            })
        results.sort(key=lambda r: (-(r["total_tokens"] or 0), r["name"]))
        return results

    def aggregate_activity_timeseries(
        self, *, source_id=None, agent=None, model=None
    ) -> list[dict]:
        clauses = self._session_filter(source_id, agent, model)
        date_col = func.date(SessionORM.started_at)

        # Sessions per day
        sess_q = (
            select(
                date_col.label("bucket"),
                func.count(SessionORM.id).label("sessions"),
            )
            .where(*clauses, SessionORM.started_at.is_not(None))
            .group_by(date_col)
        )
        sess_map: dict[str, int] = {}
        for row in self._session.execute(sess_q):
            sess_map[str(row.bucket)] = row.sessions

        # Tokens per day (join model_call → session, group by date)
        tokens_q = (
            select(
                date_col.label("bucket"),
                func.coalesce(func.sum(ModelCallORM.prompt_tokens), 0).label("pt"),
                func.coalesce(func.sum(ModelCallORM.completion_tokens), 0).label("ct"),
                func.coalesce(func.sum(ModelCallORM.cache_creation_tokens), 0).label("cache"),
                func.count(ModelCallORM.id).filter(ModelCallORM.is_error.is_(True)).label("err"),
            )
            .join(ModelCallORM, ModelCallORM.session_id == SessionORM.id)
            .where(*clauses, SessionORM.started_at.is_not(None))
            .group_by(date_col)
        )
        tokens_map: dict[str, dict] = {}
        for row in self._session.execute(tokens_q):
            tokens_map[str(row.bucket)] = {
                "prompt_tokens": int(row.pt or 0),
                "completion_tokens": int(row.ct or 0),
                "cache_tokens": int(row.cache or 0),
                "errors": int(row.err or 0),
            }

        # Tool calls per day
        tools_q = (
            select(
                date_col.label("bucket"),
                func.count(ToolCallORM.id).label("tool_calls"),
            )
            .join(ToolCallORM, ToolCallORM.session_id == SessionORM.id)
            .where(*clauses, SessionORM.started_at.is_not(None))
            .group_by(date_col)
        )
        tools_map: dict[str, int] = {}
        for row in self._session.execute(tools_q):
            tools_map[str(row.bucket)] = row.tool_calls or 0

        # Merge all buckets
        all_buckets = sorted(set(sess_map) | set(tokens_map) | set(tools_map))
        results = []
        for b in all_buckets:
            t = tokens_map.get(b, {})
            pt = t.get("prompt_tokens", 0)
            ct = t.get("completion_tokens", 0)
            results.append({
                "bucket": b,
                "sessions": sess_map.get(b, 0),
                "prompt_tokens": pt,
                "completion_tokens": ct,
                "cache_tokens": t.get("cache_tokens", 0),
                "total_tokens": pt + ct,
                "tool_calls": tools_map.get(b, 0),
                "errors": t.get("errors", 0),
            })
        return results

    def aggregate_data_completeness(
        self, *, source_id=None, agent=None, model=None
    ) -> dict:
        clauses = self._session_filter(source_id, agent, model)
        total = self._session.scalar(
            select(func.count(SessionORM.id)).where(*clauses)
        ) or 0
        if total == 0:
            return {
                "total": 0, "with_tokens": 0, "with_duration": 0,
                "with_cache": 0, "with_errors": 0,
                "tokens_coverage": None, "duration_coverage": None,
                "cache_coverage": None, "error_coverage": None,
            }

        # with_tokens: sessions that have at least one model call with non-null tokens
        with_tokens_q = (
            select(func.count(func.distinct(ModelCallORM.session_id)))
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(
                *clauses,
                (ModelCallORM.prompt_tokens.is_not(None) | ModelCallORM.completion_tokens.is_not(None)),
            )
        )
        with_tokens = self._session.scalar(with_tokens_q) or 0

        with_duration = self._session.scalar(
            select(func.count(SessionORM.id)).where(
                *clauses,
                SessionORM.started_at.is_not(None),
                SessionORM.ended_at.is_not(None),
            )
        ) or 0

        with_cache_q = (
            select(func.count(func.distinct(ModelCallORM.session_id)))
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(*clauses, ModelCallORM.cache_creation_tokens.is_not(None))
        )
        with_cache = self._session.scalar(with_cache_q) or 0

        with_errors_q = (
            select(func.count(func.distinct(ModelCallORM.session_id)))
            .join(SessionORM, SessionORM.id == ModelCallORM.session_id)
            .where(*clauses, ModelCallORM.is_error.is_(True))
        )
        with_errors = self._session.scalar(with_errors_q) or 0

        return {
            "total": total,
            "with_tokens": with_tokens,
            "with_duration": with_duration,
            "with_cache": with_cache,
            "with_errors": with_errors,
            "tokens_coverage": with_tokens / total,
            "duration_coverage": with_duration / total,
            "cache_coverage": with_cache / total,
            "error_coverage": with_errors / total,
        }

    def session_list_enriched(
        self, *, source_id=None, agent=None, model=None, limit=100, offset=0
    ) -> list[dict]:
        """List sessions with computed duration, tokens, tool_calls, errors, status, quality — all in SQL."""
        clauses = self._session_filter(source_id, agent, model)

        # Fetch the session rows for this page
        sess_q = (
            select(SessionORM)
            .where(*clauses)
            .order_by(SessionORM.started_at.desc())
            .limit(limit)
            .offset(offset)
        )
        sess_orms = list(self._session.scalars(sess_q))
        if not sess_orms:
            return []

        sess_ids = [o.id for o in sess_orms]

        # Aggregate model calls per session
        mc_q = (
            select(
                ModelCallORM.session_id.label("sid"),
                func.coalesce(func.sum(ModelCallORM.prompt_tokens), 0).label("pt"),
                func.coalesce(func.sum(ModelCallORM.completion_tokens), 0).label("ct"),
                func.count(ModelCallORM.id).filter(ModelCallORM.is_error.is_(True)).label("err"),
                func.count(ModelCallORM.id).filter(
                    ModelCallORM.prompt_tokens.is_not(None)
                    | ModelCallORM.completion_tokens.is_not(None)
                ).label("has_tokens"),
            )
            .where(ModelCallORM.session_id.in_(sess_ids))
            .group_by(ModelCallORM.session_id)
        )
        mc_map: dict[str, dict] = {}
        for row in self._session.execute(mc_q):
            mc_map[row.sid] = {
                "total_tokens": int(row.pt + row.ct) if row.has_tokens else None,
                "errors": int(row.err or 0),
            }

        # Aggregate tool calls per session
        tc_q = (
            select(
                ToolCallORM.session_id.label("sid"),
                func.count(ToolCallORM.id).label("tool_calls"),
            )
            .where(ToolCallORM.session_id.in_(sess_ids))
            .group_by(ToolCallORM.session_id)
        )
        tc_map: dict[str, int] = {}
        for row in self._session.execute(tc_q):
            tc_map[row.sid] = int(row.tool_calls)

        results = []
        for orm in sess_orms:
            mc = mc_map.get(orm.id, {})
            total_tokens = mc.get("total_tokens")
            errors = mc.get("errors", 0)
            tool_calls = tc_map.get(orm.id, 0)
            duration_ms = None
            if orm.started_at is not None and orm.ended_at is not None:
                duration_ms = (orm.ended_at - orm.started_at).total_seconds() * 1000

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
                "id": orm.id,
                "source_id": orm.source_id,
                "external_session_id": orm.external_session_id,
                "agent": orm.agent,
                "model": orm.model,
                "started_at": orm.started_at,
                "ended_at": orm.ended_at,
                "duration_ms": duration_ms,
                "total_tokens": total_tokens,
                "tool_calls": tool_calls,
                "errors": errors,
                "status": status,
                "quality": quality,
            })
        return results


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


def _orm_to_rejection(orm: RejectionORM) -> Rejection:
    return Rejection(
        id=UUID(orm.id),
        import_run_id=UUID(orm.import_run_id),
        line_number=orm.line_number,
        reason=orm.reason,
        excerpt=orm.excerpt,
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
