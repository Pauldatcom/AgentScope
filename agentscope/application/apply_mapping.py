"""ApplyMappingUseCase — deterministic engine that applies a validated mapping.

The AI never executes this; the engine refuses invalid mappings with an
explicit explanation. No code produced by the model is ever executed.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..domain.contracts import FileReaderPort
from ..domain.services import Normalizer, Validator


@dataclass(frozen=True)
class ApplyResult:
    is_valid: bool
    errors: list[str]
    warnings: list[str]
    preview: list[dict] | None = None


class ApplyMappingUseCase:
    """Validate a mapping, then produce a preview of the normalized rows."""

    def __init__(
        self,
        *,
        reader: FileReaderPort,
        normalizer: Normalizer | None = None,
        validator: Validator | None = None,
    ) -> None:
        self._reader = reader
        self._normalizer = normalizer or Normalizer()
        self._validator = validator or Validator()

    def preview(
        self,
        path: str,
        mapping: dict,
        *,
        source_id,
        import_run_id,
        preview_rows: int = 5,
    ) -> ApplyResult:
        result = self._validator.validate(mapping)
        if not result.is_valid:
            return ApplyResult(
                is_valid=False,
                errors=result.errors,
                warnings=result.warnings,
                preview=None,
            )

        rows = list(self._reader.read(path))
        batch = self._normalizer.normalize(
            rows[:preview_rows],
            mapping,
            source_id=source_id,
            import_run_id=import_run_id,
        )
        preview = [
            {
                "session": s.__dict__,
                "model_calls": [
                    c.__dict__ for c in batch.model_calls if c.session_id == s.id
                ],
                "tool_calls": [
                    t.__dict__ for t in batch.tool_calls if t.session_id == s.id
                ],
            }
            for s in batch.sessions
        ]
        return ApplyResult(
            is_valid=True,
            errors=[],
            warnings=result.warnings,
            preview=preview,
        )
