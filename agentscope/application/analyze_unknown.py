"""AnalyzeUseCase — profile an unknown file and ask the AI for a mapping.

The AI PROPOSES; it never writes to the DB. The proposal is returned to the
caller (the API) for the user to review, edit and validate.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..domain.contracts import (
    FieldProfile,
    FileReaderPort,
    FileSample,
    MappingAgentPort,
    MappingProposal,
)

TARGET_SCHEMA: dict[str, str] = {
    "external_session_id": "str — unique id of the session within the source",
    "agent": "str|null — agent name (claude, codex, ...)",
    "model": "str|null — model name (gpt-4o, claude-3-5-sonnet, ...)",
    "started_at": "datetime|null — session start",
    "ended_at": "datetime|null — session end",
    "round_index": "int — round number within session",
    "prompt_tokens": "int|null",
    "completion_tokens": "int|null",
    "cache_creation_tokens": "int|null",
    "latency_ms": "int|null",
    "is_error": "bool",
    "occurred_at": "datetime|null",
    "tools_path": "str — dotted path to the tools array within the row",
    "tool_name": "str",
    "input_chars": "int|null",
    "result_chars": "int|null",
    "wall_latency_ms": "int|null",
    "internal_latency_ms": "int|null",
}


@dataclass(frozen=True)
class AnalysisResult:
    sample: FileSample
    profiles: list[FieldProfile]
    proposal: MappingProposal


class AnalyzeUseCase:
    """Profile a file and ask the AI for a mapping proposal."""

    def __init__(
        self,
        *,
        reader: FileReaderPort,
        agent: MappingAgentPort,
    ) -> None:
        self._reader = reader
        self._agent = agent

    def execute(self, path: str, sample_size: int = 5) -> AnalysisResult:
        sample = self._reader.sample(path, n=sample_size)
        profiles = _profile_fields(sample)
        proposal = self._agent.propose(
            sample, profiles, target_schema=TARGET_SCHEMA
        )
        return AnalysisResult(
            sample=sample,
            profiles=profiles,
            proposal=proposal,
        )


def _profile_fields(sample: FileSample) -> list[FieldProfile]:
    profiles: list[FieldProfile] = []
    for field in sample.fields:
        values = [r.get(field) for r in sample.rows if r.get(field) is not None]
        non_null = len(values)
        distinct = len({str(v) for v in values})
        inferred = _infer_type(values)
        profiles.append(
            FieldProfile(
                name=field,
                inferred_type=inferred,
                non_null_ratio=non_null / sample.row_count if sample.row_count else 0.0,
                distinct_values=distinct,
                examples=[v for v in values[:3]],
            )
        )
    return profiles


def _infer_type(values: list) -> str:
    if not values:
        return "null"
    sample = values[0]
    if isinstance(sample, bool):
        return "bool"
    if isinstance(sample, int):
        return "int"
    if isinstance(sample, float):
        return "float"
    if isinstance(sample, str):
        return "str"
    if isinstance(sample, list):
        return "list"
    if isinstance(sample, dict):
        return "dict"
    return type(sample).__name__
