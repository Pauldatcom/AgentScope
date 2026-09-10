"""FastAPI app + adapter factory.

This is the ONLY place that assembles adapters and wires them to use cases.
The domain never imports from here; it only depends on its own ports.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..adapters.storage.postgres import (
    Base,
    PostgresUoWFactory,
    build_engine,
)
from ..config import Settings, get_settings
from ..domain.contracts import (
    FileReaderPort,
    LLMClientPort,
    MappingAgentPort,
    UoWFactory,
)
from .routers import (
    activity,
    agents,
    dashboard,
    data_quality,
    imports,
    mappings,
    models,
    sessions,
    sources,
    tools,
)
from .routers import settings as settings_router


def _build_uow_factory(settings: Settings) -> UoWFactory:
    engine = build_engine(settings.database_url)

    # Run Alembic migrations if the DB is not yet at head; otherwise skip
    # (avoids acquiring a table lock on a large DB).
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        # Check if alembic_version table exists and is at head.
        from pathlib import Path as _Path

        import alembic.config as _ac
        from alembic import command as _cmd
        from alembic.runtime.migration import MigrationContext

        cfg = _ac.Config(
            str(_Path(__file__).resolve().parent.parent.parent / "alembic.ini")
        )
        cfg.set_main_option("sqlalchemy.url", settings.database_url)

        with engine.connect() as conn:
            mc = MigrationContext.configure(conn)
            current_rev = mc.get_current_revision()

        if current_rev is None:
            # No migrations table yet — run upgrade from scratch.
            _cmd.upgrade(cfg, "head")
        # If current_rev is not None, the DB is already migrated — skip.
    except Exception:
        Base.metadata.create_all(engine)

    from sqlalchemy.orm import sessionmaker

    factory = sessionmaker(bind=engine, future=True)
    return PostgresUoWFactory(factory)


def _build_mapping_agent(settings: Settings) -> MappingAgentPort:
    from ..adapters.ia.fake.agent import FakeAgent
    from ..adapters.ia.openrouter.adapter import (
        OpenRouterAdapter,
        OpenRouterLLMClient,
    )

    if settings.ia_provider == "fake" or not settings.openrouter_api_key:
        return FakeAgent()
    client: LLMClientPort = OpenRouterLLMClient(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )
    return OpenRouterAdapter(client=client, model=settings.ia_model)


def _file_reader_for(path: str) -> FileReaderPort:
    from pathlib import Path

    from ..adapters.files.jsonl_reader import JsonlReader

    ext = Path(path).suffix.lower()
    if ext in {".jsonl", ".json"}:
        return JsonlReader()
    if ext == ".csv":
        from ..adapters.files.csv_reader import CsvReader

        return CsvReader()
    if ext == ".parquet":
        from ..adapters.files.parquet_reader import ParquetReader

        return ParquetReader()
    raise ValueError(f"Unsupported file extension: {ext}")


@asynccontextmanager
async def _lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.uow_factory = _build_uow_factory(settings)
    app.state.mapping_agent = _build_mapping_agent(settings)
    app.state.file_reader_for = _file_reader_for

    # Seed the TraceLab source + mapping at startup.
    from ..domain.seed import seed_defaults

    with app.state.uow_factory() as uow:
        seed_defaults(uow)
        uow.commit()

    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="AgentScope",
        version="0.1.0",
        description="Explore and normalize traces from coding AI agents.",
        lifespan=_lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins.split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(imports.router)
    app.include_router(mappings.router)
    app.include_router(sessions.router)
    app.include_router(sources.router)
    app.include_router(dashboard.router)
    app.include_router(agents.router)
    app.include_router(tools.router)
    app.include_router(models.router)
    app.include_router(data_quality.router)
    app.include_router(settings_router.router)
    app.include_router(activity.router)
    return app


app = create_app()


def run_cli() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "agentscope.api.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=False,
    )
