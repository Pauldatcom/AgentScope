"""JsonlReader — reads one JSON object per line, or a JSON array of objects."""

from __future__ import annotations

import json
from collections.abc import Iterator

from ...domain.contracts import FileReaderPort, FileSample, RawRow


class JsonlReader(FileReaderPort):
    def read(self, path: str) -> Iterator[RawRow]:
        with open(path, encoding="utf-8-sig") as f:
            prefix = f.read(2048)
            stripped = prefix.lstrip()
            f.seek(0)
            if stripped.startswith("["):
                payload = json.load(f)
                if not isinstance(payload, list):
                    raise ValueError("JSON root must be an array of objects")
                for i, item in enumerate(payload, start=1):
                    if isinstance(item, dict):
                        yield RawRow(line_number=i, data=item)
                return
            for i, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                yield RawRow(line_number=i, data=json.loads(line))

    def sample(self, path: str, n: int = 5) -> FileSample:
        rows: list[dict] = []
        fields: list[str] = []
        count = 0
        for row in self.read(path):
            count += 1
            if len(rows) < n:
                rows.append(row.data)
                for k in row.data:
                    if k not in fields:
                        fields.append(k)
        return FileSample(rows=rows, fields=fields, row_count=count)

    def supported_extensions(self) -> tuple[str, ...]:
        return (".jsonl", ".json")
