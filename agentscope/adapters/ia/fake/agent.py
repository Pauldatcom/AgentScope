"""FakeAgent — deterministic stub for CI tests, no network, no API key.

It proposes a canonical mapping for TraceLab-like JSONL. Reused by
`tests/e2e` to run the full analyse -> validate -> import pipeline without
calling a real LLM.
"""

from __future__ import annotations

from ....domain.contracts import (
    FieldProfile,
    FileSample,
    MappingAgentPort,
    MappingProposal,
    ProposalField,
)


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

        guesses = [
            ("session_id", "external_session_id"),
            ("provider", "model"),
            ("agent", "agent"),
            ("model", "model"),
            ("started_at", "started_at"),
            ("ended_at", "ended_at"),
            ("round_id", "round_index"),
            ("input_tokens", "prompt_tokens"),
            ("output_tokens", "completion_tokens"),
            ("cache_creation_input_tokens", "cache_creation_tokens"),
            ("newly_append_tokens", "prompt_tokens"),
            ("tools", "tools_path"),
        ]
        for src, tgt in guesses:
            if src in fields:
                proposals.append(
                    ProposalField(
                        source_field=src,
                        target_field=tgt,
                        confidence=0.9,
                        explanation=f"FakeAgent canonical match: {src} -> {tgt}",
                    )
                )

        ambiguities: list[str] = []
        if "newly_append_tokens" in fields and "input_tokens" in fields:
            ambiguities.append(
                "Both 'input_tokens' and 'newly_append_tokens' present; "
                "preferring 'input_tokens' as prompt_tokens."
            )

        return MappingProposal(
            fields=proposals,
            source_name="tracelab-jsonl",
            explanation=(
                "FakeAgent produced a canonical TraceLab-like mapping. "
                "This is a deterministic stub; review before validating."
            ),
            ambiguities=ambiguities,
        )
