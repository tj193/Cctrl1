"""Alembic environment restricted to the verified Neon development branch."""

import os

from alembic import context
from sqlalchemy import create_engine, pool, text
from sqlmodel import SQLModel

from src.admin import models  # noqa: F401 - registers every managed table

from migrations.database import VERIFIED_ENDPOINT_ID, direct_development_url


target_metadata = SQLModel.metadata
database_url = direct_development_url()


def include_name(name: str | None, type_: str, parent_names: dict[str, str | None]) -> bool:
    """Ignore unrelated reflected tables such as playing_with_neon."""

    if type_ == "table":
        return name in target_metadata.tables
    return True


def migration_options() -> dict:
    return {
        "target_metadata": target_metadata,
        "include_name": include_name,
        "include_schemas": False,
        "compare_type": True,
        "compare_server_default": False,
    }


def run_migrations_offline() -> None:
    # Offline mode renders SQL only. Validation still runs before rendering;
    # no connection string or password is embedded in the generated SQL.
    context.configure(
        dialect_name="postgresql",
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **migration_options(),
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Read-only is the default. A future approved stamp/upgrade requires an
    # explicit opt-in matching the already verified endpoint ID.
    write_enabled = os.getenv("DARBGO_ALEMBIC_WRITE_ENDPOINT") == VERIFIED_ENDPOINT_ID
    connect_args: dict[str, str | int] = {"connect_timeout": 10}
    if not write_enabled:
        connect_args["options"] = "-c default_transaction_read_only=on"

    engine = create_engine(
        database_url,
        poolclass=pool.NullPool,
        pool_pre_ping=True,
        echo=False,
        connect_args=connect_args,
    )
    try:
        with engine.connect() as connection:
            if not write_enabled:
                if connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
                    raise RuntimeError("Read-only migration connection was not established")
            context.configure(connection=connection, **migration_options())
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
