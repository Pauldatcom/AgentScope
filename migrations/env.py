from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Alembic Config object — provides access to the .ini file values.
config = context.config

# Python logging from the config file.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import the ORM models so Alembic can autogenerate migrations.
from agentscope.adapters.storage.postgres.models import Base  # noqa: E402

target_metadata = Base.metadata

# Pull the database URL from the environment (DATABASE_URL), falling back
# to the alembic.ini default. Never hardcode it.
import os  # noqa: E402

if os.environ.get("DATABASE_URL"):
    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
