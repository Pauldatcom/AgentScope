"""ImportUseCase — upload -> hash -> parse -> normalize -> validate -> persist + report.

Idempotence: the file hash is checked first; re-importing the same file
returns the existing ImportRun instead of duplicating data.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import UUID

from ..domain.contracts import (
    FileReaderPort,
    UoWFactory,
)
from ..domain.entities import ImportRun, Rejection, Source, new_id
from ..domain.services import Deduplicator, Normalizer, Validator


@dataclass(frozen=True)
class ImportReport:
    import_id: UUID
    source_id: UUID
    filename: str
    file_hash: str
    status: str
    rows_read: int
    sessions_imported: int
    model_calls_imported: int
    tool_calls_imported: int
    duplicates: int
    rejections: list[dict[str, Any]] = field(default_factory=list)
    missing_info: list[str] = field(default_factory=list)
    is_duplicate_run: bool = False


class ImportUseCase:
    """Orchestrates the import pipeline.

    Dependencies are injected ports; this class has NO knowledge of SQLAlchemy,
    FastAPI or the AI provider.
    """

    def __init__(
        self,
        *,
        reader: FileReaderPort,
        uow_factory: UoWFactory,
        normalizer: Normalizer | None = None,
        validator: Validator | None = None,
        deduplicator: Deduplicator | None = None,
    ) -> None:
        self._reader = reader
        self._uow_factory = uow_factory
        self._normalizer = normalizer or Normalizer()
        self._validator = validator or Validator()
        self._deduplicator = deduplicator or Deduplicator()

    def execute(
        self,
        path: str,
        *,
        source: Source,
        mapping: dict[str, Any],
    ) -> ImportReport:
        file_hash = _sha256(path)

        with self._uow_factory() as uow:
            existing = uow.imports.find_by_hash(file_hash)
            if existing is not None:
                return _report_from_existing(existing, source)

            import_run = ImportRun(
                id=new_id(),
                source_id=source.id,
                filename=Path(path).name,
                file_hash=file_hash,
                status="started",
            )
            uow.imports.add_import(import_run)

            rows = list(self._reader.read(path))

            validation = self._validator.validate(mapping)
            if not validation.is_valid:
                for e in validation.errors:
                    uow.imports.add_rejection(
                        Rejection(
                            id=new_id(),
                            import_run_id=import_run.id,
                            line_number=0,
                            reason=f"invalid mapping: {e}",
                            excerpt="",
                        )
                    )
                uow.commit()
                return ImportReport(
                    import_id=import_run.id,
                    source_id=source.id,
                    filename=import_run.filename,
                    file_hash=file_hash,
                    status="rejected",
                    rows_read=len(rows),
                    sessions_imported=0,
                    model_calls_imported=0,
                    tool_calls_imported=0,
                    duplicates=0,
                    rejections=[
                        {"line": 0, "reason": e, "excerpt": ""}
                        for e in validation.errors
                    ],
                )

            normalized = self._normalizer.normalize(
                rows,
                mapping,
                source_id=source.id,
                import_run_id=import_run.id,
            )

            existing_keys = {
                s.natural_key
                for s in uow.sessions.list_sessions(
                    source_id=source.id, limit=10**6
                )
            }
            dedup = self._deduplicator.deduplicate(normalized.sessions, existing_keys)

            new_session_ids = {s.id for s in dedup.new_sessions}
            new_model_calls = [
                c for c in normalized.model_calls if c.session_id in new_session_ids
            ]
            new_tool_calls = [
                t for t in normalized.tool_calls if t.session_id in new_session_ids
            ]

            for s in dedup.new_sessions:
                uow.sessions.add_session(s)
            for c in new_model_calls:
                uow.sessions.add_model_call(c)
            for t in new_tool_calls:
                uow.sessions.add_tool_call(t)

            rejections_data: list[dict[str, Any]] = []
            for row in rows:
                ext = row.data.get(
                    mapping.get("session", {}).get("external_session_id")
                )
                if ext is None:
                    reason = "missing external_session_id"
                    excerpt = str(row.data)[:200]
                    uow.imports.add_rejection(
                        Rejection(
                            id=new_id(),
                            import_run_id=import_run.id,
                            line_number=row.line_number,
                            reason=reason,
                            excerpt=excerpt,
                        )
                    )
                    rejections_data.append(
                        {
                            "line": row.line_number,
                            "reason": reason,
                            "excerpt": excerpt,
                        }
                    )

            report = ImportReport(
                import_id=import_run.id,
                source_id=source.id,
                filename=import_run.filename,
                file_hash=file_hash,
                status="ok",
                rows_read=len(rows),
                sessions_imported=len(dedup.new_sessions),
                model_calls_imported=len(new_model_calls),
                tool_calls_imported=len(new_tool_calls),
                duplicates=dedup.duplicate_count,
                rejections=rejections_data,
                is_duplicate_run=False,
            )
            uow.commit()
            return report


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _report_from_existing(existing: ImportRun, source: Source) -> ImportReport:
    return ImportReport(
        import_id=existing.id,
        source_id=source.id,
        filename=existing.filename,
        file_hash=existing.file_hash,
        status="duplicate",
        rows_read=0,
        sessions_imported=0,
        model_calls_imported=0,
        tool_calls_imported=0,
        duplicates=0,
        is_duplicate_run=True,
    )
