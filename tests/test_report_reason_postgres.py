"""Optional revision 0006 round trip on an isolated local test_ PostgreSQL DB."""

import importlib
import os
import uuid

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def test_reason_nullable_upgrade_and_guarded_downgrade():
    raw_url = os.getenv("TEST_POSTGRES_URL")
    if not raw_url:
        pytest.skip("Local TEST_POSTGRES_URL is unavailable; revision 0006 PostgreSQL DDL NOT TESTED")
    url = make_url(raw_url)
    if (url.drivername != "postgresql+psycopg" or
            url.host not in {"localhost", "127.0.0.1", "::1"} or
            not (url.database or "").startswith("test_")):
        pytest.fail("TEST_POSTGRES_URL must target a local postgresql+psycopg test_ database")
    schema = "report_reason_" + uuid.uuid4().hex
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
                connection.execute(text("CREATE TABLE report (id integer PRIMARY KEY, reason varchar NOT NULL)"))
                connection.execute(text("INSERT INTO report (id, reason) VALUES (1, 'Historical text')"))
                migration = importlib.import_module(
                    "migrations.versions.20261009_0006_report_reason_nullable"
                )
                migration.op = Operations(MigrationContext.configure(connection))
                migration.upgrade()
                assert connection.execute(text("SELECT reason FROM report WHERE id = 1")).scalar_one() == "Historical text"
                connection.execute(text("INSERT INTO report (id, reason) VALUES (2, NULL)"))
                with pytest.raises(RuntimeError, match="reason NOT NULL"):
                    migration.downgrade()
                connection.execute(text("DELETE FROM report WHERE id = 2"))
                migration.downgrade()
                assert connection.execute(text("SELECT is_nullable FROM information_schema.columns "
                                               "WHERE table_schema = current_schema() AND table_name = 'report' "
                                               "AND column_name = 'reason'")).scalar_one() == "NO"
                assert connection.execute(text("SELECT reason FROM report WHERE id = 1")).scalar_one() == "Historical text"
            finally:
                transaction.rollback()
    finally:
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        engine.dispose()
