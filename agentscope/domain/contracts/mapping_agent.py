"""MappingAgentPort — the AI that PROPOSES a mapping; never writes to the DB.

The application's deterministic engine (`application.apply_mapping`) applies
the validated mapping. The AI only proposes + explains + signals ambiguities.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from .file_reader import FileSample


@dataclass(frozen=True)
class FieldProfile:
    """Profile of one field in the unknown file."""

    name: str
    inferred_type: str
    non_null_ratio: float
    distinct_values: int
    examples: list[Any]


@dataclass(frozen=True)
class ProposalField:
    """One proposed correspondence: source field -> model field."""

    source_field: str
    target_field: str
    confidence: float
    transform: str | None = None
    explanation: str = ""
    ambiguity: str | None = None


@dataclass(frozen=True)
class MappingProposal:
    """The AI's full proposal for a file."""

    fields: list[ProposalField]
    source_name: str | None
    explanation: str
    ambiguities: list[str]


class MappingAgentPort(ABC):
    """An AI that proposes a field mapping from a file sample to our model."""

    @abstractmethod
    def propose(
        self,
        sample: FileSample,
        profiles: list[FieldProfile],
        *,
        target_schema: dict[str, str],
    ) -> MappingProposal:
        """Return a MappingProposal. Does NOT persist anything."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """The model identifier currently in use (from config)."""
