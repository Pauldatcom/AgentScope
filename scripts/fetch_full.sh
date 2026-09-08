#!/bin/bash
# Fetch the full TraceLab dataset (~357k rounds) from the public release.
# The file is gitignored — never committed — and used only for local dev.
set -eu

DEST="${1:-trace/full.jsonl}"
mkdir -p "$(dirname "$DEST")"

echo "Downloading TraceLab v0.0.1 JSONL (full)..."
curl -L --fail -o /tmp/syfi_coding_trace_full.jsonl.gz \
  https://github.com/uw-syfi/TraceLab/releases/download/v0.0.1/syfi_coding_trace.jsonl.gz

echo "Decompressing to $DEST..."
gzip -cd /tmp/syfi_coding_trace_full.jsonl.gz > "$DEST"
rm -f /tmp/syfi_coding_trace_full.jsonl.gz

LINES=$(wc -l < "$DEST")
SIZE=$(du -h "$DEST" | cut -f1)
echo "Done: $LINES lines ($SIZE) in $DEST"
echo "SHA256: $(shasum -a 256 "$DEST" | cut -d' ' -f1)"
