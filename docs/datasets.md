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
- Used in issue #18 to exercise the AI import assistant on an unknown shape.

## Trace Commons — stress test
- Hugging Face: <https://huggingface.co/datasets/trace-commons/agent-traces>
- Used in issue #22 to test importing a structure the application does not yet know.

## Reproducibility
Document the retrieval date and the exact asset version in the release notes.
