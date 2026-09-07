"""ParquetReader — reads Parquet files via pandas/pyarrow."""

from __future__ import annotations

from collections.abc import Iterator

import pandas as pd

from ...domain.contracts import FileReaderPort, FileSample, RawRow


class ParquetReader(FileReaderPort):
    def read(self, path: str) -> Iterator[RawRow]:
        df = pd.read_parquet(path)
        for i, row in enumerate(df.itertuples(index=False), start=1):
            yield RawRow(line_number=i, data=row._asdict())

    def sample(self, path: str, n: int = 5) -> FileSample:
        df = pd.read_parquet(path)
        rows = df.head(n).to_dict(orient="records")
        return FileSample(rows=rows, fields=list(df.columns), row_count=len(df))

    def supported_extensions(self) -> tuple[str, ...]:
        return (".parquet",)
