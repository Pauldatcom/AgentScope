# AgentScope

**Explore and normalize traces from coding AI agents (Claude Code, Codex, …).**

AgentScope ingests agent trace files (JSONL / CSV / Parquet), normalizes them
into a common relational model, lets an AI assistant propose field mappings for
unknown sources, and exposes dashboards to understand what agents do, which
tools they call, how many tokens they consume and where they spend their time.

## Quickstart

```bash
git clone https://github.com/Pauldatcom/AgentScope.git
cd AgentScope

# 1. Configure
cp .env.example .env       # fill in OPENROUTER_API_KEY if you want the AI import helper

# 2. Start Postgres
docker compose up -d postgres

# 3. Install Python deps
uv sync --extra dev

# 4. Run migrations (creates the 7 tables + seed source/mapping)
uv run alembic upgrade head

# 5. (Optional) Fetch a TraceLab sample for local dev
bash scripts/fetch_sample.sh    # downloads 1000 lines to trace/sample.jsonl (gitignored)

# 6. Run the API
uv run uvicorn agentscope.api.main:app --reload --port 8000

# 7. Run the frontend
cd web && npm install && npm run dev   # http://localhost:5173
```

## Features

- **Import** JSONL, CSV and Parquet files with idempotence (sha256 + natural key)
- **Normalize** into a 3NF relational model (sessions → model calls → tool calls)
- **AI import assistant** — drop an unknown file, the AI proposes a field mapping,
  you edit and preview before validating. The AI never writes to the database.
- **Dashboard** — 4 indicators (tokens by model, sessions by agent, tool
  distribution, error rate), 3 visualizations, detailed session timeline.
- **Interchangeable AI** — one OpenRouter key, any model via `.env`. `FakeAgent`
  runs the full pipeline in CI without a network or API key.
- **Import report** — rows read, sessions imported, duplicates, rejections with
  explanations.

## Architecture

Clean Architecture, modular monolith. The domain depends on nothing but the
standard library; adapters implement the domain's ports; the API wires
adapters to use cases via a single factory.

```
agentscope/
  domain/         pure entities, rules, indicators, port contracts (no I/O)
  application/    use cases (import, analyze, apply mapping, dashboard)
  adapters/       postgres, openrouter, fake, jsonl/csv/parquet readers
  api/            FastAPI routers + factory that assembles adapters
  config/         pydantic-settings (read from .env)
  tests/          unit (no I/O), integration (Postgres), e2e (FakeAgent)
```

See [`docs/architecture.md`](docs/architecture.md) for the full component
diagram and [`docs/data_model.md`](docs/data_model.md) for the relational model.

## Main flow

`import → verify → normalize → explore`

1. **Import** a file (JSONL / CSV / Parquet). Its sha256 is stored; re-importing
   the same file is a no-op (idempotence).
2. **Verify** with a per-import report: rows read, sessions imported,
   duplicates, rejections and missing info.
3. **Normalize** into the common model (sessions, model calls, tool calls)
   using a deterministic engine driven by a saved, versioned mapping.
4. **Explore** the dashboard: 4+ indicators, 3+ visualizations, a detailed
   session view, with filters by source / agent / model / period.

## AI import helper

From the UI you can drop an unknown file. The AI assistant profiles the fields
and **proposes** a mapping to the common schema; it explains its choices and
flags ambiguities. You review, edit and preview the normalized result before
validating. The AI never writes to the database — the deterministic engine
applies the validated mapping. The model is configurable (`.env`); the
`FakeAgent` stub runs the full pipeline in CI without a network or API key.

See [`docs/ai_providers.md`](docs/ai_providers.md) for the tested configurations
and the procedure to change models.

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/sources` | List dataset sources |
| `POST` | `/sources` | Create a source |
| `POST` | `/imports/upload` | Upload a file + import (FormData) |
| `GET` | `/sessions` | List sessions (filters: source_id, agent, model) |
| `GET` | `/sessions/{id}` | Session detail (model calls + tool calls) |
| `GET` | `/dashboard` | Indicators + definitions (filters: source_id, agent, model) |
| `POST` | `/mappings/analyze` | Analyze an unknown file (AI proposes a mapping) |
| `POST` | `/mappings/apply` | Apply a mapping + preview the normalized result |
| `GET` | `/mappings` | List saved mappings |
| `POST` | `/mappings` | Save a mapping (versioned, reusable) |

## Observations

Three observations drawn from the TraceLab v0.0.1 sample (1000 lines, 28
sessions, 1118 tool calls) are documented in
[`docs/observations.md`](docs/observations.md).

## Documentation

- [Architecture](docs/architecture.md) — component diagram + dependency rule
- [Data model](docs/data_model.md) — 3NF relational schema + ERD
- [Indicators](docs/indicators.md) — definitions, units, missing-value handling
- [Mappings](docs/mappings.md) — TraceLab + SWE-chat field correspondences
- [AI providers](docs/ai_providers.md) — tested configs + how to switch models
- [Decisions](docs/decisions.md) — 7 ADRs
- [Datasets](docs/datasets.md) — sources, retrieval method, licensing
- [AI import report](docs/ai_import_report.md) — 2-model test report
- [Observations](docs/observations.md) — 3 figures from real data

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull requests must pass CI (ruff,
mypy, pytest, web build) and be reviewed by another contributor.

## License

MIT — see [LICENSE](LICENSE).
