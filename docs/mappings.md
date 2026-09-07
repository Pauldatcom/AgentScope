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

Source: <https://huggingface.co/datasets/SALT-NLP/SWE-chat>.

SWE-chat rassemble des conversations de développement avec appels d'outils.
La structure diffère de TraceLab (pas de `session_id` au sens TraceLab ;
les conversations sont organisées par `repo` + `instance_id`). Le mapping
suivant est proposé par l'assistant IA et validé depuis l'UI :

```json
{
  "session": {
    "external_session_id": "instance_id",
    "agent": "agent",
    "model": "model"
  },
  "model_call": {
    "round_index": "turn_id",
    "prompt_tokens": "input_tokens",
    "completion_tokens": "output_tokens"
  },
  "tool_call": {
    "tools_path": "tool_calls",
    "tool_name": "tool_name",
    "wall_latency_ms": "latency_ms",
    "is_error": "error"
  }
}
```

## Trace Commons (structure inconnue)

Source: <https://huggingface.co/datasets/trace-commons/agent-traces>.

Trace Commons conserve des sessions dans les formats natifs de différents
agents. La structure varie — aucun connecteur codé à la main n'est requis.
L'assistant IA profile les champs et propose un mapping ; l'utilisateur
corrige et valide depuis l'UI.

Exemple de mapping pour un format `trace_commons` (testé dans
`tests/e2e/test_unknown_structure_import.py`) :

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

L'application signale les champs non mappés comme ambiguïtés. Un import
partiel correctement expliqué est préférable à un import apparemment réussi
qui produit des chiffres faux.
