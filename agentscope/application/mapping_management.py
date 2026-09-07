"""MappingManagementUseCase — CRUD for reusable, versioned mappings."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from ..domain.contracts import MappingRepository
from ..domain.entities import Mapping, new_id


class MappingManagementUseCase:
    def __init__(self, *, mappings: MappingRepository) -> None:
        self._mappings = mappings

    def save(
        self,
        *,
        source_id: UUID,
        mapping: dict[str, Any],
        created_by: str,
        version: int = 1,
    ) -> Mapping:
        m = Mapping(
            id=new_id(),
            source_id=source_id,
            version=version,
            mapping=mapping,
            created_by=created_by,
            is_active=True,
        )
        return self._mappings.add_mapping(m)

    def list(self, source_id: UUID | None = None) -> list[Mapping]:
        return self._mappings.list_mappings(source_id)

    def get_active(self, source_id: UUID) -> Mapping | None:
        return self._mappings.get_active_mapping(source_id)
