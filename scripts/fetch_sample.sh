#!/bin/bash
# Fetch a small TraceLab sample (1000 lines) from the public release.
# The file is gitignored — never committed — and used only for local dev.
set -eu

DEST="${1:-trace/sample.jsonl}"
mkdir -p "$(dirname "$DEST")"

echo "Downloading TraceLab v0.0.1 JSONL..."
curl -L --fail -o /tmp/syfi_coding_trace.jsonl.gz \
  https://github.com/uw-syfi/TraceLab/releases/download/v0.0.1/syfi_coding_trace.jsonl.gz

echo "Extracting first 1000 lines to $DEST..."
gzip -cd /tmp/syfi_coding_trace.jsonl.gz | head -1000 > "$DEST"
rm -f /tmp/syfi_coding_trace.jsonl.gz

LINES=$(wc -l < "$DEST")
echo "Done: $LINES lines in $DEST"
echo "SHA256: $(shasum -a 256 "$DEST" | cut -d' ' -f1)"
