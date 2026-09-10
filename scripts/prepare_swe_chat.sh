#!/usr/bin/env bash
# Download the SWE-chat conversations asset and create a small local JSONL sample.
# All outputs live under trace/, which is intentionally gitignored.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="${1:-$ROOT_DIR/trace/swe-chat}"
ROWS="${2:-200}"
PARQUET="$DEST_DIR/conversations.parquet"
JSONL="$DEST_DIR/conversations.head.jsonl"

if ! command -v hf >/dev/null 2>&1; then
  printf '%s\n' "Missing the Hugging Face CLI. Install it with: uv tool install huggingface_hub"
  exit 1
fi

mkdir -p "$DEST_DIR"

if [[ ! -f "$PARQUET" ]]; then
  echo "Downloading SALT-NLP/SWE-chat conversations.parquet..."
  hf download SALT-NLP/SWE-chat conversations.parquet \
    --repo-type dataset \
    --local-dir "$DEST_DIR"
else
  echo "Using existing $PARQUET"
fi

echo "Writing the first $ROWS rows to $JSONL..."
uv run python - "$PARQUET" "$JSONL" "$ROWS" <<'PY'
from pathlib import Path
import sys

import pyarrow.parquet as pq

parquet_path = Path(sys.argv[1])
jsonl_path = Path(sys.argv[2])
rows = int(sys.argv[3])

if rows < 1:
    raise SystemExit("ROWS must be a positive integer")

parquet = pq.ParquetFile(parquet_path)
batch = next(parquet.iter_batches(batch_size=rows))
batch.to_pandas().head(rows).to_json(jsonl_path, orient="records", lines=True)
print(f"Wrote {min(rows, parquet.metadata.num_rows)} of {parquet.metadata.num_rows} rows")
print(f"Fields: {', '.join(parquet.schema_arrow.names)}")
PY

echo "Sample: $JSONL"
echo "SHA256: $(shasum -a 256 "$JSONL" | cut -d' ' -f1)"
