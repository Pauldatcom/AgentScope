"""Unit tests — pure domain/application rules, no DB, no AI, no network."""

from __future__ import annotations

from uuid import uuid4

from agentscope.domain.entities import Session
from agentscope.domain.services import Deduplicator


def _make_session(source_id, ext: str) -> Session:
    return Session(
        id=uuid4(),
        source_id=source_id,
        import_run_id=uuid4(),
        external_session_id=ext,
    )


def test_reimporting_the_same_session_does_not_create_duplicates():
    """Idempotence: a re-import with an already-known natural key is a duplicate."""

    source_id = uuid4()
    dedup = Deduplicator()

    first = [_make_session(source_id, "s-1")]
    result = dedup.deduplicate(first, existing_keys=set())
    assert result.duplicate_count == 0
    assert len(result.new_sessions) == 1

    existing = {s.natural_key for s in result.new_sessions}
    second = [_make_session(source_id, "s-1")]
    result2 = dedup.deduplicate(second, existing_keys=existing)
    assert result2.duplicate_count == 1
    assert len(result2.new_sessions) == 0


def test_different_sessions_are_all_imported():
    source_id = uuid4()
    dedup = Deduplicator()
    incoming = [_make_session(source_id, f"s-{i}") for i in range(3)]
    result = dedup.deduplicate(incoming, existing_keys=set())
    assert result.duplicate_count == 0
    assert len(result.new_sessions) == 3


def test_mix_of_new_and_duplicate_sessions():
    source_id = uuid4()
    dedup = Deduplicator()
    existing = {(source_id, "s-1")}
    incoming = [
        _make_session(source_id, "s-1"),
        _make_session(source_id, "s-2"),
        _make_session(source_id, "s-3"),
    ]
    result = dedup.deduplicate(incoming, existing_keys=existing)
    assert result.duplicate_count == 1
    assert len(result.new_sessions) == 2


def test_intra_batch_dedup_is_also_handled():
    source_id = uuid4()
    dedup = Deduplicator()
    incoming = [_make_session(source_id, "s-1"), _make_session(source_id, "s-1")]
    result = dedup.deduplicate(incoming, existing_keys=set())
    assert result.duplicate_count == 1
    assert len(result.new_sessions) == 1
