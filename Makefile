.PHONY: help install dev test test-integration lint typecheck migrate dev-api dev-web build up down clean

help:
	@echo "AgentScope — available targets:"
	@echo ""
	@echo "  make install         Install Python dependencies (uv)"
	@echo "  make dev             Install dev dependencies (uv --extra dev)"
	@echo "  make test            Run unit + e2e tests"
	@echo "  make test-integration Run integration tests (requires Postgres)"
	@echo "  make lint            Run ruff linter"
	@echo "  make typecheck        Run mypy type checker"
	@echo "  make migrate          Run Alembic migrations (upgrade head)"
	@echo "  make dev-api          Start the API in development mode"
	@echo "  make dev-web          Start the frontend in development mode"
	@echo "  make build            Build the frontend for production"
	@echo "  make up               Start the full stack via Docker Compose"
	@echo "  make down             Stop the Docker Compose stack"
	@echo "  make clean           Remove caches and build artifacts"

install:
	uv sync

dev:
	uv sync --extra dev

test:
	uv run pytest tests/unit tests/e2e -v

test-integration:
	uv run pytest -m integration -v

lint:
	uv run ruff check .

typecheck:
	uv run mypy agentscope

migrate:
	uv run alembic upgrade head

dev-api:
	uv run uvicorn agentscope.api.main:app --reload --port 8000

dev-web:
	cd web && npm run dev

build:
	cd web && npm run build

up:
	docker compose up -d --build

down:
	docker compose down

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf web/node_modules web/dist .venv 2>/dev/null || true
