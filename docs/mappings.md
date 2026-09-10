# Mappings

A mapping is a JSON document that tells the deterministic import engine how to
turn a raw row into a normalized entity. The AI **proposes** a mapping; the
engine applies it. Mappings are saved per source, versioned, editable and
reusable.

## TraceLab JSONL

Source: <https://github.com/uw-syfi/TraceLab> — release `v0.0.1` JSONL.

Each row in the TraceLab JSONL represents one LLM round within a session.
Multiple rows share the same `session_id`; the Normalizer groups them into
one `Session` with many `ModelCall` entries.

```json
{
  "session": {
    "external_session_id": "session_id",
    "agent": "provider",
    "model": "model"
  },
  "model_call": {
    "round_index": "round_index",
    "model": "model",
    "prompt_tokens": "input_tokens_total",
    "completion_tokens": "output_tokens",
    "cache_creation_tokens": "claude_cache_creation_input_tokens"
  },
  "tool_call": {
    "tools_path": "tools",
    "tool_name": "tool_name",
    "input_chars": "input_chars",
    "result_chars": "result_chars",
    "wall_latency_ms": "tool_wall_latency_ms",
    "internal_latency_ms": "tool_internal_latency_ms",
    "is_error": "is_error",
    "occurred_at": "emitted_at"
  }
}
```

This mapping is seeded at API startup (see `agentscope/domain/seed.py`).
When `mapping_json` is empty in `POST /imports/upload`, the active mapping
for the source is loaded automatically.

## SWE-chat

Source: <https://huggingface.co/datasets/SALT-NLP/SWE-chat> (gated; accept
the dataset terms, then `huggingface-cli download`).

The extract used here is **conversations** (one row per transcript turn),
not a nested TraceLab-style tools array. Columns observed on 2026-09-10:

- `session_id`, `turn_id`, `turn_number`, `role`, `turn_type`, `model`
- `input_tokens`, `output_tokens`, `cache_creation_input_tokens`
- `tool_name` (set on `tool_use` / `tool_result` rows; null otherwise)
- `agent` (denormalized from the sessions table)
- `timestamp`

There is no SWE-chat connector in the Python code. Create a source from the
Imports page, upload a JSONL extract, edit the proposed mapping, validate,
then import. `tool_name` on the same row is enough: omit `tools_path`.

```json
{
  "session": {
    "external_session_id": "session_id",
    "agent": "agent",
    "model": "model"
  },
  "model_call": {
    "round_index": "turn_number",
    "model": "model",
    "prompt_tokens": "input_tokens",
    "completion_tokens": "output_tokens",
    "cache_creation_tokens": "cache_creation_input_tokens",
    "occurred_at": "timestamp"
  },
  "tool_call": {
    "tool_name": "tool_name"
  }
}
```

Grain: every conversation row becomes a `model_call`. Token fields are
null on user and tool rows — they stay null, they are not stored as 0.
A `tool_call` is created only when `tool_name` is present.

Covered by `tests/e2e/test_swechat_import.py` (synthetic rows, real column
names; Hugging Face records are not redistributed).

## Trace Commons (unknown structure)

Source: <https://huggingface.co/datasets/trace-commons/agent-traces>.

Trace Commons preserves sessions in the native formats of various agents.
The structure varies — no hand-coded connector is required. The AI assistant
profiles the fields and proposes a mapping; the user edits and validates
from the UI.

Example mapping for a `trace_commons` format (tested in
`tests/e2e/test_unknown_structure_import.py`):

```json
{
  "session": {
    "external_session_id": "trace_id",
    "agent": "agent_name",
    "model": "llm_model"
  },
  "model_call": {
    "round_index": "interaction_seq",
    "model": "llm_model",
    "prompt_tokens": "input_token_count",
    "completion_tokens": "output_token_count"
  },
  "tool_call": {
    "tools_path": "tool_invocations",
    "tool_name": "tool",
    "wall_latency_ms": "duration_ms",
    "is_error": "failed"
  }
}
```

The application reports unmapped fields as ambiguities. A correctly
explained partial import is preferred over an apparently successful import
that produces incorrect figures.
