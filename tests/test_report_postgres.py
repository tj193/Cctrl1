"""Optional report migration round-trip on a local test_ PostgreSQL database."""

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


def expect_integrity_error(connection, statement):
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(text(statement))


def test_report_migration_round_trip_on_isolated_postgresql():
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
                schema = "report_test_" + uuid.uuid4().hex
                connection.execute(text(f'CREATE SCHEMA "{schema}"'))
                connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
                connection.execute(text(
                    "CREATE TYPE userrole AS ENUM ('ADMIN', 'STUDENT', 'DRIVER')"
                ))
                connection.execute(text("""
                    CREATE TYPE reportstatus AS ENUM
                    ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')
                """))
                connection.execute(text('CREATE TABLE "user" (id integer PRIMARY KEY)'))
                connection.execute(text('CREATE TABLE route (id integer PRIMARY KEY)'))
                connection.execute(text("""
                    CREATE TABLE report (
                        id integer PRIMARY KEY,
                        report_id integer NOT NULL REFERENCES "user"(id),
                        target_id integer NOT NULL REFERENCES "user"(id),
                        target_type userrole NOT NULL,
                        reason varchar NOT NULL,
                        status reportstatus NOT NULL,
                        resolved_by integer REFERENCES "user"(id),
                        created_at timestamptz NOT NULL
                    )
                """))
                connection.execute(text('INSERT INTO "user" (id) VALUES (1), (2)'))
                connection.execute(text('INSERT INTO route (id) VALUES (10)'))
                connection.execute(text("""
                    INSERT INTO report
                        (id, report_id, target_id, target_type, reason, status, created_at)
                    VALUES (20, 1, 2, 'DRIVER', 'Legacy reason', 'PENDING', now())
                """))

                migration = importlib.import_module(
                    "migrations.versions.20261009_0004_reports_complaints"
                )
                migration.op = Operations(MigrationContext.configure(connection))
                migration.upgrade()
                assert connection.execute(text("""
                    SELECT type IS NULL, subject IS NULL, description IS NULL,
                           public_resolution IS NULL, internal_notes IS NULL,
                           related_route_id IS NULL, updated_at IS NULL,
                           resolved_at IS NULL
                    FROM report WHERE id = 20
                """)).one() == (True,) * 8
                assert connection.execute(text(
                    "SELECT reason FROM report WHERE id = 20"
                )).scalar_one() == "Legacy reason"
                expect_integrity_error(connection, """
                    INSERT INTO report
                        (id, report_id, status, created_at, subject, description)
                    VALUES (23, 1, 'PENDING', now(), 'Canonical title',
                            'Canonical details')
                """)
                connection.execute(text("""
                    INSERT INTO report
                        (id, report_id, reason, status, created_at,
                         type, subject, description, related_route_id)
                    VALUES (21, 1, 'Route concern', 'INVESTIGATING', now(),
                            'route', 'Pickup issue', 'Description', 10)
                """))
                expect_integrity_error(connection, """
                    INSERT INTO report
                        (id, report_id, reason, status, created_at)
                    VALUES (22, 999, 'Bad owner', 'PENDING', now())
                """)
                expect_integrity_error(connection, """
                    UPDATE report SET related_route_id = 999 WHERE id = 21
                """)
                connection.execute(text("""
                    UPDATE report SET status = 'RESOLVED', resolved_by = 2,
                        public_resolution = 'Visible answer',
                        internal_notes = 'Private note',
                        updated_at = now(), resolved_at = now()
                    WHERE id = 21
                """))
                assert connection.execute(text("""
                    SELECT public_resolution <> internal_notes,
                           updated_at IS NOT NULL, resolved_at IS NOT NULL
                    FROM report WHERE id = 21
                """)).one() == (True, True, True)
                with pytest.raises(RuntimeError, match="manual review"):
                    migration.downgrade()
                assert connection.execute(text(
                    "SELECT count(*) FROM report WHERE id = 21"
                )).scalar_one() == 1

                connection.execute(text("DELETE FROM report WHERE id = 21"))
                migration.downgrade()
                assert connection.execute(text("""
                    SELECT report_id, target_id, reason, status
                    FROM report WHERE id = 20
                """)).one() == (1, 2, "Legacy reason", "PENDING")
                assert connection.execute(text("""
                    SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'report'
                      AND column_name IN
                      ('type', 'subject', 'description', 'public_resolution',
                       'internal_notes', 'related_route_id', 'updated_at', 'resolved_at')
                """)).scalar_one() == 0
                assert connection.execute(text(
                    "SELECT to_regtype('reportstatus') IS NOT NULL"
                )).scalar_one() is True
                connection.rollback()
    finally:
        engine.dispose()
