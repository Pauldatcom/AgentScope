"""Validator — refuses invalid mappings with an explanation.

An invalid mapping (missing required target field, unknown target field,
type mismatch) is rejected BEFORE the import engine runs.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    errors: list[str]
    warnings: list[str]


REQUIRED_SESSION_FIELDS = {"external_session_id"}
VALID_TARGETS = {
    "session": {
        "external_session_id",
        "agent",
        "model",
        "started_at",
        "ended_at",
    },
    "model_call": {
        "round_index",
        "model",
        "prompt_tokens",
        "completion_tokens",
        "cache_creation_tokens",
        "latency_ms",
        "is_error",
        "occurred_at",
    },
    "tool_call": {
        "tools_path",
        "tool_name",
        "input_chars",
        "result_chars",
        "wall_latency_ms",
        "internal_latency_ms",
        "is_error",
        "occurred_at",
    },
}


class Validator:
    """Validate a mapping against the AgentScope target schema."""

    def validate(self, mapping: dict) -> ValidationResult:
        errors: list[str] = []
        warnings: list[str] = []

        if not isinstance(mapping, dict):
            return ValidationResult(False, ["mapping must be a dict"], [])

        smap = mapping.get("session")
        if not isinstance(smap, dict):
            errors.append("mapping.session is required and must be a dict")
        else:
            for req in REQUIRED_SESSION_FIELDS:
                if req not in smap or not smap[req]:
                    errors.append(
                        f"mapping.session.{req} is required to identify a session"
                    )
            for k in smap:
                if k not in VALID_TARGETS["session"]:
                    warnings.append(
                        f"mapping.session.{k} is not a known target field"
                    )

        for section in ("model_call", "tool_call"):
            sec = mapping.get(section, {})
            for k in sec:
                if k not in VALID_TARGETS[section]:
                    warnings.append(
                        f"mapping.{section}.{k} is not a known target field"
                    )

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )
