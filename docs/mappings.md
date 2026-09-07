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

## SWE-chat (added in day 3)

Source: <https://huggingface.co/datasets/SALT-NLP/SWE-chat>.

(To be completed in issue #18 — the AI assistant proposes the mapping from
the UI; the validated version is recorded here.)
