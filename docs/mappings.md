# Mappings

A mapping is a JSON document that tells the deterministic import engine how to
turn a raw row into a normalized entity. The AI **proposes** a mapping; the
engine applies it. Mappings are saved per source, versioned, editable and
reusable.

## TraceLab JSONL

Source: <https://github.com/uw-syfi/TraceLab> — release `v0.0.1` JSONL.

```json
{
  "session": {
    "external_session_id": "session_id",
    "agent": "provider",
    "model": "model"
  },
  "model_call": {
    "round_index": "round_id",
    "prompt_tokens": "input_tokens",
    "completion_tokens": "output_tokens",
    "cache_creation_tokens": "cache_creation_input_tokens",
    "occurred_at": "emitted_at"
  },
  "tool_call": {
    "tools_path": "tools",
    "tool_name": "tool_name",
    "wall_latency_ms": "tool_wall_latency_ms",
    "internal_latency_ms": "tool_internal_latency_ms",
    "is_error": "is_error",
    "occurred_at": "result_at"
  }
}
```

## SWE-chat (added in day 3)

Source: <https://huggingface.co/datasets/SALT-NLP/SWE-chat>.

(To be completed in issue #18 — the AI assistant proposes the mapping from
the UI; the validated version is recorded here.)
