<div align="center">

# AgentScope

**Explore and normalize traces from coding AI agents.**

[![CI](https://github.com/Pauldatcom/AgentScope/actions/workflows/ci.yml/badge.svg)](https://github.com/Pauldatcom/AgentScope/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-82%25-success)](https://github.com/Pauldatcom/AgentScope)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

AgentScope ingests agent trace files (JSONL, CSV, Parquet), normalizes them
into a common relational model, lets an AI assistant propose field mappings
for unknown sources, and exposes dashboards to understand what agents do —
which tools they call, how many tokens they consume, and where they spend
their time.

## Features

- **Multi-format ingestion** — JSONL, CSV, and Parquet with idempotent imports
  (sha256 + natural key deduplication).
- **3NF relational model** — sessions, model calls, and tool calls with
  explicit keys and relationships.
- **AI import assistant** — drop an unknown file, the AI proposes a field
  mapping, you review and preview before validating. The AI never writes to
  the database.
- **Interchangeable AI** — one OpenRouter key, any model via `.env`.
  `FakeAgent` runs the full pipeline in CI without a network or API key.
- **Dashboard** — 4 indicators, 3 visualizations, and a detailed session
  timeline. All metrics computed from real imported data.
- **Clean Architecture** — the domain depends on nothing but the standard
  library. Adapters implement ports. The API wires everything via a single
  factory.

## Getting started

### Prerequisites

- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (for PostgreSQL + optional full-stack deployment)
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### Quick setup (local development)

```bash
git clone https://github.com/Pauldatcom/AgentScope.git
cd AgentScope

# 1. Configure environment
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d postgres

# 3. Install dependencies
make dev                    # uv sync --extra dev
pnpm install                 # root deps (concurrently) + web deps

# 4. Run database migrations
make migrate                # alembic upgrade head

# 5. (Optional) Fetch a TraceLab sample (1000 lines, gitignored)
bash scripts/fetch_sample.sh

# 6. Start API + frontend together
pnpm dev                    # API → http://localhost:8000, web → http://localhost:5173
```

`pnpm dev` runs both processes concurrently (blue = API, green = web).
Use `make dev-api` / `make dev-web` to start them separately.

### Full-stack deployment (Docker Compose)

```bash
docker compose up -d --build
```

This starts PostgreSQL, the API (port 8000), and the web frontend
(port 8080).

## Configuration

All configuration is via environment variables (`.env` file):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://...` | PostgreSQL connection string |
| `IA_PROVIDER` | `fake` | AI provider: `openrouter` or `fake` |
| `IA_MODEL` | `openai/gpt-4o-mini` | Primary model (OpenRouter) |
| `IA_MODEL_ALT` | `z-ai/glm-5.2` | Secondary model for testing |
| `OPENROUTER_API_KEY` | (empty) | OpenRouter API key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter endpoint |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `APP_HOST` | `0.0.0.0` | API host |
| `APP_PORT` | `8000` | API port |
| `MASK_ENV` | `true` | Hide `.env` values in Settings (database URL is never sent) |
| `ENABLE_INTEGRATIONS` | (unset) | Slack/S3 Settings cards; unset = on in development only |

No API key is required for local development — `IA_PROVIDER=fake` uses the
deterministic `FakeAgent` stub.

## Architecture

Clean Architecture, modular monolith. The domain depends on nothing but the
standard library; adapters implement the domain's ports; the API wires
adapters to use cases via a single factory.

```
agentscope/
  domain/         Pure entities, rules, indicators, port contracts (no I/O)
  application/    Use cases (import, analyze, apply mapping, dashboard)
  adapters/       Postgres, OpenRouter, FakeAgent, JSONL/CSV/Parquet readers
  api/            FastAPI routers + factory that assembles adapters
  config/         pydantic-settings (reads from .env)
```

- **Dependency rule**: `domain <- application <- api`. The domain never
  imports SQLAlchemy, httpx, pandas, or any framework.
- **Adapters** implement the domain's ports and can be swapped via configuration.
- **`main.py`** is the only file that knows about concrete adapters.

See [`docs/architecture.md`](docs/architecture.md) for the full component
diagram and [`docs/data_model.md`](docs/data_model.md) for the relational
schema.

## Main flow

```
import → verify → normalize → explore
```

1. **Import** a file (JSONL / CSV / Parquet). Its sha256 is stored; re-importing
   the same file is a no-op.
2. **Verify** with a per-import report: rows read, sessions imported,
   duplicates, rejections, and missing info.
3. **Normalize** into the common model using a deterministic engine driven by
   a saved, versioned mapping.
4. **Explore** the dashboard: indicators, visualizations, and a detailed
   session timeline with filters by source, agent, and model.

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/sources` | List dataset sources |
| `POST` | `/sources` | Create a source |
| `POST` | `/imports/upload` | Upload a file and run the import pipeline |
| `GET` | `/sessions` | List sessions (filters: `source_id`, `agent`, `model`) |
| `GET` | `/sessions/{id}` | Session detail (model calls + tool calls) |
| `GET` | `/dashboard` | Indicators + definitions (filters: `source_id`, `agent`, `model`) |
| `POST` | `/mappings/analyze` | Analyze an unknown file (AI proposes a mapping) |
| `POST` | `/mappings/apply` | Apply a mapping and preview the normalized result |
| `GET` | `/mappings` | List saved mappings |
| `POST` | `/mappings` | Save a mapping (versioned, reusable) |

## Testing

```bash
make test                   # unit + e2e tests (no Postgres, no network)
make test-integration       # integration tests (requires Postgres)
make lint                   # ruff (Python) + eslint (frontend)
make typecheck              # mypy (Python) + tsc (frontend)
pnpm lint                   # frontend only (eslint)
pnpm typecheck              # frontend only (tsc --noEmit)
```

41 tests, 82% coverage on `agentscope/`. CI runs on every pull request.

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | Component diagram + dependency rule |
| [Data model](docs/data_model.md) | 3NF relational schema + ERD |
| [Indicators](docs/indicators.md) | Definitions, units, missing-value handling |
| [Mappings](docs/mappings.md) | Field correspondences for TraceLab, SWE-chat, Trace Commons |
| [AI providers](docs/ai_providers.md) | Tested configurations + how to switch models |
| [Decisions](docs/decisions.md) | 7 architecture decision records |
| [Datasets](docs/datasets.md) | Sources, retrieval method, licensing |
| [AI import report](docs/ai_import_report.md) | 2-model test report |
| [Observations](docs/observations.md) | 3 figures from real TraceLab data |
| [Security](SECURITY.md) | Vulnerability disclosure policy |

## Datasets

| Dataset | Provider | License | Used for |
|---|---|---|---|
| [TraceLab](https://github.com/uw-syfi/TraceLab) | SyFI Lab, UW | CC BY 4.0 | Primary source (Claude Code + Codex traces) |
| [SWE-chat](https://huggingface.co/datasets/SALT-NLP/SWE-chat) | SALT-NLP | — | Second source (structured conversations) |
| [Trace Commons](https://huggingface.co/datasets/trace-commons/agent-traces) | Agent Traces | — | Unknown structure stress test |

Datasets are **not** committed to the repository. Use
`scripts/fetch_sample.sh` to download a TraceLab sample for local development.

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for
guidelines on branches, pull requests, adding data sources, and adding AI
providers.

## License

[MIT](LICENSE) — AgentScope is open source software.

## Acknowledgements

- [TraceLab](https://github.com/uw-syfi/TraceLab) — SyFI Lab, University of
  Washington, for the public dataset and inspiration.
- [OpenRouter](https://openrouter.ai) — for providing a unified API to
  multiple LLM providers.
- [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy](https://sqlalchemy.org/),
  [Recharts](https://recharts.org/), and [Tailwind CSS](https://tailwindcss.com/).
