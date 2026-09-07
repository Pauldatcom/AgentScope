# Changelog

All notable changes to AgentScope are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Professionalized repository: badges, issue templates, PR template, SECURITY.md,
  CODEOWNERS, Makefile, Dockerfiles (API + web), full-stack docker-compose.
- Rewrote README, CONTRIBUTING, and all docs in English.
- Cleaned alembic.ini (removed template boilerplate).

## [0.1.0] - 2026-09-07

### Added

- **Import pipeline**: JSONL, CSV, and Parquet files with idempotent imports
  (sha256 + natural key deduplication).
- **Relational model (3NF)**: 7 tables (source, import_run, session, model_call,
  tool_call, mapping, rejection) with Alembic migrations.
- **AI import assistant**: `OpenRouterAdapter` (model chosen via `.env`) +
  `FakeAgent` (deterministic stub for CI). The AI proposes a field mapping;
  the user edits, previews, and validates. The deterministic engine applies
  the mapping — no code produced by the AI is ever executed.
- **Dashboard**: 4 indicators (tokens by model, sessions by agent, tool
  distribution, error rate), 3 visualizations, detailed session timeline with
  cumulative tokens.
- **Indicators**: pure functions with documented definitions (calculation,
  unit, scope, missing-value handling). Missing values are never turned into
  zero.
- **API**: FastAPI endpoints for sources, imports, sessions, dashboard, and
  mappings (analyze, apply, list, save).
- **Frontend**: React + Vite + TypeScript + Tailwind + Recharts. Pages:
  Dashboard, Import, Mapping Assistant, Session Detail.
- **Tests**: 41 tests (unit + e2e), 82% coverage. Ruff + mypy clean.
- **CI**: GitHub Actions running ruff, mypy, pytest, and web build on every PR
  with PostgreSQL service for integration tests.
- **Documentation**: architecture (Mermaid), data model (3NF + ERD),
  indicators, mappings (TraceLab + SWE-chat + Trace Commons), AI providers
  (2 configurations), 7 ADRs, datasets, AI import report, 3 observations
  from real TraceLab data.

### Tested AI configurations

1. `z-ai/glm-5.2` via OpenRouter
2. `openai/gpt-4o-mini` via OpenRouter
3. `FakeAgent` (CI, no network)

### Known limitations

- Only JSONL is tested end-to-end with real data; CSV and Parquet are
  unit-tested with synthetic data.
- The AI import assistant works best with JSONL-like structures; deeply
  nested formats may require manual mapping edits.
- No authentication on the API — intended for local or single-user deployment.
- No data retention policy — the database grows with each import.
