# AI import report — two-model test

The brief requires testing the identification and import workflow with at
least two distinct models. This document describes the tested configurations,
the workflow, and the results — without publishing any secrets.

## Tested configurations

### Configuration 1 — `z-ai/glm-5.2` via OpenRouter

```env
IA_PROVIDER=openrouter
IA_MODEL=z-ai/glm-5.2
OPENROUTER_API_KEY=...    # personal key, never committed
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

**Workflow**:
1. Upload an unknown JSONL file via `POST /mappings/analyze`.
2. The `OpenRouterAdapter` sends the field profile + a sample (3 rows,
   truncated to 4000 characters) to the OpenRouter API.
3. The `z-ai/glm-5.2` model returns a JSON mapping proposal.
4. The proposal is validated by `Validator` (required fields present).
5. The user edits the mapping in the UI, previews, and validates.
6. The deterministic engine `ApplyMappingUseCase` applies the validated mapping.
7. The data is imported into the database.

**Result**: the full workflow works. The model proposes coherent
correspondences for TraceLab fields (`session_id` → `external_session_id`,
`provider` → `agent`, `input_tokens_total` → `prompt_tokens`, etc.). The
mapping is saved and reusable.

### Configuration 2 — `openai/gpt-4o-mini` via OpenRouter

```env
IA_PROVIDER=openrouter
IA_MODEL=openai/gpt-4o-mini
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

**Workflow**: identical to configuration 1. The `gpt-4o-mini` model
proposes a slightly different mapping (for example, it maps `model` →
`model` instead of `provider` → `agent`), but the validation, preview, and
import workflow works the same way.

**Result**: the full workflow works. Saved mappings remain usable after
changing the model — only the initial proposal for a new unknown file may
differ.

### Configuration 3 (CI) — `FakeAgent` without network

```env
IA_PROVIDER=fake
IA_MODEL=fake-local
OPENROUTER_API_KEY=     # empty
```

**Workflow**: `FakeAgent` returns a canonical mapping for a TraceLab-like
JSONL, without any network call or API key. The full workflow (analyze →
validate → import) is exercised by `tests/e2e` on every PR.

**Result**: 41 tests pass without network. The stub guarantees that CI
works on any environment.

## How to change the model

1. Edit `.env`: change the `IA_MODEL` value.
2. Restart the API: `uv run uvicorn agentscope.api.main:app --reload`.
3. `main.py` rebuilds the adapter from `Settings` — no code change needed.
4. Saved mappings remain usable; only the initial proposal for a new
   unknown file may differ.

## AI tools used

- **OpenRouter** (`https://openrouter.ai`) — LLM API router; a single
  adapter covers all available models.
- **FakeAgent** — deterministic stub coded in
  `agentscope/adapters/ia/fake/agent.py`, with no external dependency.

## External components reused

- **FastAPI** — Python web framework for the API.
- **SQLAlchemy + Alembic** — ORM and migrations for PostgreSQL.
- **pandas + pyarrow** — CSV and Parquet reading.
- **React + Vite + Recharts + Tailwind CSS** — frontend.
- **PostgreSQL 16** — relational storage (via Docker Compose).
- **uv** — Python dependency manager.
