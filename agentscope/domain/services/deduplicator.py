"""Deduplicator — enforces idempotence by natural key.

Pure rule: given a set of incoming sessions and the set of natural keys already
present, return only the new sessions and count the duplicates. Re-importing
the same file MUST NOT create duplicates.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from ..entities import Session


@dataclass(frozen=True)
class DedupResult:
    new_sessions: list[Session]
    duplicate_count: int
    duplicates: list[Session]


class Deduplicator:
    """Deduplicate sessions by (source_id, external_session_id)."""

    def deduplicate(
        self,
        incoming: Iterable[Session],
        existing_keys: set[tuple],
    ) -> DedupResult:
        new: list[Session] = []
        duplicates: list[Session] = []
        seen_now: set[tuple] = set()

        for session in incoming:
            key = session.natural_key
            if key in existing_keys or key in seen_now:
                duplicates.append(session)
            else:
                new.append(session)
                seen_now.add(key)

        return DedupResult(
            new_sessions=new,
            duplicate_count=len(duplicates),
            duplicates=duplicates,
        )
