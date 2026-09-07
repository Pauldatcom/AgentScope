"""Domain contracts (Ports).

Abstract interfaces that the application layer depends on.
Adapters in `agentscope.adapters` implement these ports.
The domain NEVER imports adapters — the reverse is true.
"""

from __future__ import annotations

from .file_reader import FileReaderPort, FileSample, RawRow
from .llm_client import LLMClientPort, LLMMessage, LLMResponse
from .mapping_agent import (
    FieldProfile,
    MappingAgentPort,
    MappingProposal,
    ProposalField,
)
from .repositories import (
    ImportRepository,
    MappingRepository,
    SessionRepository,
    SourceRepository,
    UoW,
    UoWFactory,
)

__all__ = [
    "FileReaderPort",
    "FileSample",
    "RawRow",
    "LLMClientPort",
    "LLMMessage",
    "LLMResponse",
    "MappingAgentPort",
    "FieldProfile",
    "MappingProposal",
    "ProposalField",
    "ImportRepository",
    "MappingRepository",
    "SessionRepository",
    "SourceRepository",
    "UoW",
    "UoWFactory",
]
