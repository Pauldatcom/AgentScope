# Changelog

## v0.1.0 (unreleased)

- Initial Clean Architecture skeleton (domain / application / adapters / api).
- Import pipeline: JSONL / CSV / Parquet → normalize → validate → deduplicate → persist.
- Idempotence by file hash + natural key.
- AI import assistant: `OpenRouterAdapter` + `FakeAgent` for CI.
- Dashboard: 4 indicators, 3 visualizations, session detail (skeleton).
- PostgreSQL via Docker Compose + Alembic (skeleton).
- React + Vite + Tailwind frontend (skeleton).
- CI: ruff, mypy, pytest, web build on every PR.
