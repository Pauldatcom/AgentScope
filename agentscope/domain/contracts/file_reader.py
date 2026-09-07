"""FileReaderPort — reads raw rows from JSONL / CSV / Parquet files."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RawRow:
    """One raw row read from a file, before any normalization."""

    line_number: int
    data: dict[str, Any]


@dataclass(frozen=True)
class FileSample:
    """A small sample + field profile used to ask the AI for a mapping."""

    rows: list[dict[str, Any]]
    fields: list[str]
    row_count: int


class FileReaderPort(ABC):
    """Reads a file lazily and yields RawRow objects."""

    @abstractmethod
    def read(self, path: str) -> Iterator[RawRow]:
        """Yield RawRow objects, one per line/record."""

    @abstractmethod
    def sample(self, path: str, n: int = 5) -> FileSample:
        """Return a small sample + field list for AI profiling."""

    @abstractmethod
    def supported_extensions(self) -> tuple[str, ...]:
        """File extensions this reader handles (e.g. ('.jsonl',))."""
