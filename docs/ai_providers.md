# AI providers

The mapping agent is **interchangeable**. The model is chosen by configuration;
no model identifier is hardcoded.

## Configuration

`.env`:

```
IA_PROVIDER=openrouter        # or "fake" for the deterministic stub
IA_MODEL=openai/gpt-4o-mini   # primary model
IA_MODEL_ALT=z-ai/glm-5.2     # documented second model
OPENROUTER_API_KEY=...        # one key, multiple models
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

## Tested configurations

1. **`z-ai/glm-5.2`** via OpenRouter — primary.
2. **`openai/gpt-4o-mini`** via OpenRouter — documented second.

`FakeAgent` is the CI substitute: it returns a canonical mapping for
TraceLab-like JSONL without any network or API key. The full
analyse → validate → import pipeline is exercised in `tests/e2e`.

## Switching models

To change the active model:

1. Edit `.env`, set `IA_MODEL` to the new model id.
2. Restart the API. `main.py` rebuilds the adapter from `Settings`.
3. Re-run the import assistant. Existing saved mappings remain usable; the
   AI may propose a different mapping for an unknown file, but the engine
   applies whatever you validate.

## Adding a new provider

1. Implement `MappingAgentPort` in a new module under `agentscope/adapters/ia/`.
2. Wire it in `agentscope/api/main.py::_build_mapping_agent` via a new branch.
3. No changes to `domain` or `application` are required.
