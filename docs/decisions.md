# Architecture Decision Records

## ADR-001 — Idempotence by file hash + natural key
Re-importing the same file MUST NOT create duplicates. We compute the sha256
of the file at import time and store it in `import_run.file_hash` (unique).
Sessions are deduplicated by `(source_id, external_session_id)`. A re-import
returns the existing `import_run` with `is_duplicate_run=True` and writes
nothing.

## ADR-002 — Deterministic import engine; the AI only proposes
The AI assistant proposes a field mapping; it never writes to the database and
no code produced by the model is ever executed. `ApplyMappingUseCase` applies a
validated mapping deterministically and refuses invalid mappings with an
explanation.

## ADR-003 — Indicators are computed in Python/SQL, never by the AI
The AI receives only field profiles and small samples (after filtering of
sensitive values). All dashboard metrics are computed by pure functions in
`agentscope.domain.indicators`, testable without I/O.

## ADR-004 — Explicit missing values; never a silent zero
A metric that does not exist for a source is `NULL` plus a boolean flag (e.g.
`metric_available`). The dashboard exposes this in each indicator's definition.

## ADR-005 — Ports defined in the domain; adapters are replaceable
The domain defines the ports (`MappingAgentPort`, `SessionRepository`,
`FileReaderPort`, `LLMClientPort`). Adapters implement them. The domain is
unit-tested without SQLAlchemy, httpx, pandas or any LLM call.

## ADR-006 — OpenRouter as the single AI provider; `FakeAgent` for CI
One adapter (`OpenRouterAdapter`) covers multiple models via `.env`. `FakeAgent`
runs the full analyse → validate → import pipeline in CI without a network or
API key. Switching providers is a new adapter + a branch in `main.py`; the
domain never changes.

## ADR-007 — Monolithic modular architecture
No microservices. A single FastAPI app + a React frontend. The separation is
between domain, application, adapters and API — not between processes.
