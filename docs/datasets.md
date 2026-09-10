# Datasets

We use three public datasets. We commit only references and retrieval method;
no data file is committed unless its license explicitly permits redistribution.

## TraceLab — primary source
- Repo: <https://github.com/uw-syfi/TraceLab>
- Release: `v0.0.1`
- License (code): Apache 2.0
- License (data): CC BY 4.0
- Asset used: `syfi_coding_trace.jsonl.gz` (JSONL, 357 161 LLM rounds, 432 510 tool records)
- Retrieval:
  ```bash
  curl -L --fail -o trace/syfi_coding_trace.jsonl.gz \
    https://github.com/uw-syfi/TraceLab/releases/download/v0.0.1/syfi_coding_trace.jsonl.gz
  gzip -d trace/syfi_coding_trace.jsonl.gz
  ```
- Selection: first 1 000 lines for development; full dataset for final tests.

## SWE-chat — second source
- Hugging Face: <https://huggingface.co/datasets/SALT-NLP/SWE-chat>
- Retrieved: 2026-09-10 (schema from the dataset card; the Hub copy is gated)
- Assets: `conversations.parquet` (turns) and `sessions.parquet` (session rollup)
- License: dataset terms on the Hub — accept them before download; we do not
  commit Hub rows
- Install the CLI and authenticate once:
  ```bash
  uv tool install huggingface_hub
  hf auth login
  ```
- Retrieval (after accepting the terms on the dataset page):
  ```bash
  hf download SALT-NLP/SWE-chat conversations.parquet \
    --repo-type dataset \
    --local-dir trace/swe-chat
  ```
  Export a JSONL slice for the Imports page (the engine reads JSONL/CSV/Parquet;
  the helper reads only the first Parquet batch):
  ```bash
  scripts/prepare_swe_chat.sh
  ```
- Import path: UI → New source (`swe-chat`) → upload JSONL → edit mapping →
  validate → import. No SWE-chat connector is checked in.
- Mapping: see `docs/mappings.md`. Tests use synthetic rows with the real
  column names (`tests/e2e/test_swechat_import.py`).
- Real-stack validation: start Postgres and the API with OpenRouter, then run
  `uv run python scripts/validate_swe_chat.py`. For the configured model:
  `IA_PROVIDER=openrouter IA_MODEL=z-ai/glm-5.2 uv run uvicorn agentscope.api.main:app --port 8000`.
  The script calls the same analyze, apply, import and dashboard endpoints as
  the Imports page. It refuses to continue when the API is using the
  FakeAgent.

## Trace Commons — stress test
- Hugging Face: <https://huggingface.co/datasets/trace-commons/agent-traces>
- Used in issue #22 to test importing a structure the application does not yet know.

## Reproducibility
Document the retrieval date and the exact asset version in the release notes.
