"""Unit tests for file readers — JSONL, CSV, Parquet.

These tests generate their own temp files so no external data is needed.
"""

from __future__ import annotations

import json
from pathlib import Path

from agentscope.adapters.files.csv_reader import CsvReader
from agentscope.adapters.files.jsonl_reader import JsonlReader


def test_jsonl_reader_yields_one_row_per_line(tmp_path: Path):
    rows_data = [
        {"session_id": "s-1", "model": "claude", "tokens": 100},
        {"session_id": "s-2", "model": "codex", "tokens": 200},
    ]
    path = tmp_path / "test.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows_data))

    reader = JsonlReader()
    rows = list(reader.read(str(path)))
    assert len(rows) == 2
    assert rows[0].line_number == 1
    assert rows[0].data["session_id"] == "s-1"
    assert rows[1].data["tokens"] == 200


def test_jsonl_reader_skips_blank_lines(tmp_path: Path):
    path = tmp_path / "blank.jsonl"
    path.write_text('{"a":1}\n\n{"b":2}\n')

    reader = JsonlReader()
    rows = list(reader.read(str(path)))
    assert len(rows) == 2


def test_jsonl_reader_sample(tmp_path: Path):
    rows_data = [{"k": f"v{i}"} for i in range(10)]
    path = tmp_path / "sample.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows_data))

    reader = JsonlReader()
    sample = reader.sample(str(path), n=3)
    assert sample.row_count == 10
    assert len(sample.rows) == 3
    assert "k" in sample.fields


def test_jsonl_reader_supported_extensions():
    assert ".jsonl" in JsonlReader().supported_extensions()


def test_csv_reader_reads_rows(tmp_path: Path):
    import pandas as pd

    path = tmp_path / "test.csv"
    pd.DataFrame(
        {"session_id": ["s-1", "s-2"], "tokens": [100, 200]}
    ).to_csv(str(path), index=False)

    reader = CsvReader()
    rows = list(reader.read(str(path)))
    assert len(rows) == 2
    assert rows[0].data["session_id"] == "s-1"
    assert int(rows[0].data["tokens"]) == 100


def test_csv_reader_sample(tmp_path: Path):
    import pandas as pd

    path = tmp_path / "sample.csv"
    pd.DataFrame({"a": list(range(10)), "b": list(range(10, 20))}).to_csv(
        str(path), index=False
    )

    reader = CsvReader()
    sample = reader.sample(str(path), n=5)
    assert sample.row_count == 10
    assert len(sample.rows) == 5
    assert set(sample.fields) == {"a", "b"}


def test_parquet_reader_reads_rows(tmp_path: Path):
    import pandas as pd

    path = tmp_path / "test.parquet"
    pd.DataFrame(
        {"session_id": ["s-1", "s-2"], "tokens": [100, 200]}
    ).to_parquet(str(path))

    from agentscope.adapters.files.parquet_reader import ParquetReader

    reader = ParquetReader()
    rows = list(reader.read(str(path)))
    assert len(rows) == 2
    assert rows[0].data["session_id"] == "s-1"


def test_parquet_reader_sample(tmp_path: Path):
    import pandas as pd

    path = tmp_path / "sample.parquet"
    pd.DataFrame({"x": list(range(10))}).to_parquet(str(path))

    from agentscope.adapters.files.parquet_reader import ParquetReader

    reader = ParquetReader()
    sample = reader.sample(str(path), n=3)
    assert sample.row_count == 10
    assert len(sample.rows) == 3
    assert "x" in sample.fields
