"""Optional index migration test on a local test_ PostgreSQL database only."""

import importlib
import os
import uuid

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import NullPool


def test_active_demand_migration_on_isolated_postgresql():
    raw_url = os.getenv("TEST_POSTGRES_URL")
    if not raw_url:
        pytest.skip("Local TEST_POSTGRES_URL is required for PostgreSQL migration test")
    url = make_url(raw_url)
    if (url.drivername != "postgresql+psycopg"
            or url.host not in {"localhost", "127.0.0.1", "::1"}
            or not (url.database or "").startswith("test_")):
        pytest.fail("TEST_POSTGRES_URL must target a local test_ PostgreSQL database")

    engine = create_engine(url, poolclass=NullPool)
    try:
        with engine.connect() as connection:
            with connection.begin():
                schema = "demand_test_" + uuid.uuid4().hex
                connection.execute(text(f'CREATE SCHEMA "{schema}"'))
                connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
                connection.execute(text("""
                    CREATE TYPE routedemandstatus AS ENUM
                    ('ACTIVE', 'FULFILLED', 'CANCELLED')
                """))
                connection.execute(text('CREATE TABLE "user" (id integer PRIMARY KEY)'))
                connection.execute(text('CREATE TABLE area (id integer PRIMARY KEY)'))
                connection.execute(text('CREATE TABLE university (id integer PRIMARY KEY)'))
                connection.execute(text("""
                    CREATE TABLE routedemand (
                        id integer PRIMARY KEY,
                        student_id integer NOT NULL REFERENCES "user"(id),
                        from_area_id integer NOT NULL REFERENCES area(id),
                        to_university_id integer NOT NULL REFERENCES university(id),
                        preferred_time timestamptz,
                        status routedemandstatus NOT NULL,
                        created_at timestamptz NOT NULL
                    )
                """))
                connection.execute(text('INSERT INTO "user" (id) VALUES (1)'))
                connection.execute(text('INSERT INTO area (id) VALUES (2)'))
                connection.execute(text('INSERT INTO university (id) VALUES (3)'))
                connection.execute(text("""
                    INSERT INTO routedemand
                        (id, student_id, from_area_id, to_university_id,
                         status, created_at)
                    VALUES (10, 1, 2, 3, 'ACTIVE', now()),
                           (11, 1, 2, 3, 'ACTIVE', now())
                """))

                migration = importlib.import_module(
                    "migrations.versions.20261009_0005_active_route_demand_integrity"
                )
                migration.op = Operations(MigrationContext.configure(connection))
                with pytest.raises(RuntimeError, match="Duplicate active route demand"):
                    migration.upgrade()
                assert connection.execute(text("""
                    SELECT count(*) FROM pg_indexes
                    WHERE schemaname = current_schema()
                      AND indexname = 'uq_routedemand_active_student_journey'
                """)).scalar_one() == 0

                connection.execute(text(
                    "UPDATE routedemand SET status = 'CANCELLED' WHERE id = 11"
                ))
                migration.upgrade()
                with pytest.raises(IntegrityError), connection.begin_nested():
                    connection.execute(text("""
                        INSERT INTO routedemand
                            (id, student_id, from_area_id, to_university_id,
                             status, created_at)
                        VALUES (12, 1, 2, 3, 'ACTIVE', now())
                    """))
                connection.execute(text("""
                    INSERT INTO routedemand
                        (id, student_id, from_area_id, to_university_id,
                         status, created_at)
                    VALUES (13, 1, 2, 3, 'FULFILLED', now())
                """))
                connection.execute(text(
                    "UPDATE routedemand SET status = 'CANCELLED' WHERE id = 10"
                ))
                connection.execute(text("""
                    INSERT INTO routedemand
                        (id, student_id, from_area_id, to_university_id,
                         status, created_at)
                    VALUES (14, 1, 2, 3, 'ACTIVE', now())
                """))
                assert connection.execute(text(
                    "SELECT count(*) FROM routedemand"
                )).scalar_one() == 4

                migration.downgrade()
                assert connection.execute(text("""
                    SELECT count(*) FROM pg_indexes
                    WHERE schemaname = current_schema()
                      AND indexname IN
                      ('uq_routedemand_active_student_journey',
                       'ix_routedemand_origin_university_status')
                """)).scalar_one() == 0
                assert connection.execute(text(
                    "SELECT count(*) FROM routedemand"
                )).scalar_one() == 4
                connection.rollback()
    finally:
        engine.dispose()
