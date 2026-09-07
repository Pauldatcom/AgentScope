# Changelog

## v0.1.0 — 2026-09-07

First usable release.

### Added

- **Import pipeline**: JSONL, CSV and Parquet files → normalize → validate →
  deduplicate → persist. Idempotence by file sha256 + natural key
  `(source_id, external_session_id)`.
- **Relational model (3NF)**: 7 tables (source, import_run, session, model_call,
  tool_call, mapping, rejection) with Alembic migrations.
- **AI import assistant**: `OpenRouterAdapter` (model chosen via `.env`) +
  `FakeAgent` (deterministic stub for CI). The AI proposes a field mapping;
  the user edits, previews and validates. The deterministic engine applies the
  mapping — no code produced by the AI is ever executed.
- **Dashboard**: 4 indicators (tokens by model, sessions by agent, tool
  distribution, error rate), 3 visualizations (bar, pie, box), detailed
  session timeline with cumulative tokens.
- **Indicators**: pure functions with documented definitions (calculation,
  unit, scope, missing-value handling). Missing values are never turned into
  zero.
- **API**: FastAPI endpoints for sources, imports, sessions, dashboard,
  mappings (analyze, apply, list, save).
- **Frontend**: React + Vite + TypeScript + Tailwind + Recharts. Pages:
  Dashboard, Import, Mapping Assistant, Session Detail.
- **Tests**: 41 tests (unit + e2e). Ruff + mypy clean. CI runs on every PR
  with Postgres service for integration tests.
- **Documentation**: architecture (Mermaid), data model (3NF + ERD),
  indicators, mappings (TraceLab), AI providers (2 configs), 7 ADRs, datasets,
  AI import report, 3 observations from real TraceLab data.

### Tested AI configurations

1. `z-ai/glm-5.2` via OpenRouter
2. `openai/gpt-4o-mini` via OpenRouter
3. `FakeAgent` (CI, no network)

### Known limitations

- Only JSONL is tested end-to-end with real data; CSV and Parquet are unit-tested
  with synthetic data.
- The AI import assistant works best with JSONL-like structures; deeply nested
  formats may require manual mapping edits.
- No authentication on the API — intended for local/single-user use.
- No data retention policy — the database grows with each import.
