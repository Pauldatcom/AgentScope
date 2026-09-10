"""FakeAgent — deterministic stub for CI tests, no network, no API key.

It matches common column names onto the target schema. Reused by `tests/e2e`
to run analyse -> validate -> import without calling a real LLM.
"""

from __future__ import annotations

from ....domain.contracts import (
    FieldProfile,
    FileSample,
    MappingAgentPort,
    MappingProposal,
    ProposalField,
)

# First match wins for exclusive targets (session id, round, tokens, tools list).
_GUESSES: list[tuple[str, str]] = [
    ("session_id", "external_session_id"),
    ("trace_id", "external_session_id"),
    ("instance_id", "external_session_id"),
    ("agent", "agent"),
    ("agent_name", "agent"),
    ("provider", "model"),
    ("model", "model"),
    ("llm_model", "model"),
    ("started_at", "started_at"),
    ("ended_at", "ended_at"),
    ("timestamp", "occurred_at"),
    ("round_index", "round_index"),
    ("turn_number", "round_index"),
    ("round_id", "round_index"),
    ("turn_id", "round_index"),
    ("interaction_seq", "round_index"),
    ("input_tokens", "prompt_tokens"),
    ("input_tokens_total", "prompt_tokens"),
    ("input_token_count", "prompt_tokens"),
    ("newly_append_tokens", "prompt_tokens"),
    ("output_tokens", "completion_tokens"),
    ("output_token_count", "completion_tokens"),
    ("cache_creation_input_tokens", "cache_creation_tokens"),
    ("tools", "tools_path"),
    ("tool_calls", "tools_path"),
    ("tool_invocations", "tools_path"),
    ("tool_name", "tool_name"),
]

_EXCLUSIVE_TARGETS = {
    "external_session_id",
    "agent",
    "round_index",
    "prompt_tokens",
    "completion_tokens",
    "cache_creation_tokens",
    "tools_path",
    "occurred_at",
}


class FakeAgent(MappingAgentPort):
    """Deterministic mapping proposer for known JSONL shapes."""

    def __init__(self, model_name: str = "fake-local") -> None:
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def propose(
        self,
        sample: FileSample,
        profiles: list[FieldProfile],
        *,
        target_schema: dict[str, str],
    ) -> MappingProposal:
        fields = set(sample.fields)
        proposals: list[ProposalField] = []
        claimed: set[str] = set()

        for src, tgt in _GUESSES:
            if src not in fields:
                continue
            if tgt in _EXCLUSIVE_TARGETS and tgt in claimed:
                continue
            proposals.append(
                ProposalField(
                    source_field=src,
                    target_field=tgt,
                    confidence=0.9,
                    explanation=f"column name match: {src} -> {tgt}",
                )
            )
            claimed.add(tgt)

        ambiguities: list[str] = []
        if "newly_append_tokens" in fields and "input_tokens" in fields:
            ambiguities.append(
                "Both 'input_tokens' and 'newly_append_tokens' present; "
                "preferring 'input_tokens' as prompt_tokens."
            )
        if "tool_name" in fields and "tools_path" not in claimed:
            ambiguities.append(
                "tool_name is a column on the row, not a nested tools array. "
                "Rows without a tool name will not produce a tool_call."
            )

        if "turn_number" in fields:
            source_name = "conversation-jsonl"
            explanation = (
                "Matched conversation-style columns (session id, turn number, "
                "token counts). Review and edit before validating."
            )
        elif "trace_id" in fields or "tool_invocations" in fields:
            source_name = "unknown-jsonl"
            explanation = (
                "Matched uncommon column names onto the target schema. "
                "Review and edit before validating."
            )
        else:
            source_name = "tracelab-jsonl"
            explanation = (
                "Matched TraceLab-like column names onto the target schema. "
                "Review and edit before validating."
            )

        return MappingProposal(
            fields=proposals,
            source_name=source_name,
            explanation=explanation,
            ambiguities=ambiguities,
        )
