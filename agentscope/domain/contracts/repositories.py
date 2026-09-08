"""Repository ports — storage-agnostic interfaces for persistence.

Implemented by `adapters.storage.postgres`. The domain and application layers
depend on these ABCs only, never on SQLAlchemy.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import AbstractContextManager
from typing import Protocol

from ..entities import (
    ImportRun,
    Mapping,
    ModelCall,
    Rejection,
    Session,
    Source,
    ToolCall,
)


class SessionRepository(ABC):
    """Read/write sessions, model calls and tool calls."""

    @abstractmethod
    def add_session(self, session: Session) -> Session: ...

    @abstractmethod
    def get_session(self, session_id) -> Session | None: ...

    @abstractmethod
    def find_by_natural_key(self, source_id, external_session_id: str) -> Session | None: ...

    @abstractmethod
    def add_model_call(self, call: ModelCall) -> ModelCall: ...

    @abstractmethod
    def add_tool_call(self, call: ToolCall) -> ToolCall: ...

    @abstractmethod
    def list_sessions(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Session]: ...

    @abstractmethod
    def list_model_calls(self, session_ids: list) -> list[ModelCall]: ...

    @abstractmethod
    def list_tool_calls(self, session_ids: list) -> list[ToolCall]: ...

    @abstractmethod
    def get_session_detail(self, session_id) -> dict | None: ...

    @abstractmethod
    def aggregate_dashboard(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
    ) -> dict: ...

    @abstractmethod
    def aggregate_agent_breakdown(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
    ) -> list[dict]: ...

    @abstractmethod
    def aggregate_tool_breakdown(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
    ) -> list[dict]: ...

    @abstractmethod
    def aggregate_model_breakdown(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
    ) -> list[dict]: ...

    @abstractmethod
    def aggregate_activity_timeseries(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
    ) -> list[dict]: ...

    @abstractmethod
    def aggregate_data_completeness(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
    ) -> dict: ...

    @abstractmethod
    def session_list_enriched(
        self,
        *,
        source_id=None,
        agent: str | None = None,
        model: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]: ...


class ImportRepository(ABC):
    """Read/write import runs and rejections."""

    @abstractmethod
    def add_import(self, run: ImportRun) -> ImportRun: ...

    @abstractmethod
    def find_by_hash(self, file_hash: str) -> ImportRun | None: ...

    @abstractmethod
    def add_rejection(self, rejection: Rejection) -> Rejection: ...

    @abstractmethod
    def list_imports(self, limit: int = 50) -> list[ImportRun]: ...

    @abstractmethod
    def get_import(self, import_id) -> ImportRun | None: ...

    @abstractmethod
    def list_rejections(self, import_id=None, limit: int = 100) -> list[Rejection]: ...


class MappingRepository(ABC):
    """Read/write reusable, versioned mappings."""

    @abstractmethod
    def add_mapping(self, mapping: Mapping) -> Mapping: ...

    @abstractmethod
    def get_active_mapping(self, source_id) -> Mapping | None: ...

    @abstractmethod
    def list_mappings(self, source_id=None) -> list[Mapping]: ...


class SourceRepository(ABC):
    """Read/write dataset provenances."""

    @abstractmethod
    def add_source(self, source: Source) -> Source: ...

    @abstractmethod
    def get_source(self, source_id) -> Source | None: ...

    @abstractmethod
    def list_sources(self) -> list[Source]: ...


class UoWFactory(Protocol):
    """Factory that yields a unit-of-work context manager bundling repos."""

    def __call__(self) -> AbstractContextManager[
        UoW
    ]: ...  # pragma: no cover


class UoW(Protocol):
    """Unit of Work: groups repositories with a transaction boundary."""

    sessions: SessionRepository
    imports: ImportRepository
    mappings: MappingRepository
    sources: SourceRepository

    def commit(self) -> None: ...  # pragma: no cover
    def rollback(self) -> None: ...  # pragma: no cover
