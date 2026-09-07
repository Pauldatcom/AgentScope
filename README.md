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

## License

MIT — see [LICENSE](LICENSE).
