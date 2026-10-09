"""Optional migration round-trip on a local test_ PostgreSQL database only."""

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


def expect_integrity_error(connection, statement, parameters=None):
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(text(statement), parameters or {})


def test_migration_round_trip_on_isolated_postgresql():
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
                schema = "route_profile_test_" + uuid.uuid4().hex
                connection.execute(text(f'CREATE SCHEMA "{schema}"'))
                connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
                connection.execute(text('CREATE TABLE "user" (id integer PRIMARY KEY)'))
                connection.execute(text('CREATE TABLE area (id integer PRIMARY KEY)'))
                connection.execute(text('CREATE TABLE university (id integer PRIMARY KEY)'))
                connection.execute(text("""
                    CREATE TABLE route (
                        id integer PRIMARY KEY,
                        driver_id integer NOT NULL REFERENCES "user"(id),
                        from_area_id integer NOT NULL REFERENCES area(id),
                        to_university_id integer NOT NULL REFERENCES university(id),
                        capacity integer NOT NULL,
                        status text NOT NULL,
                        created_at timestamptz NOT NULL DEFAULT now()
                    )
                """))
                connection.execute(text(
                    "CREATE TABLE ride_request (id integer PRIMARY KEY, route_id integer "
                    "REFERENCES route(id))"
                ))
                connection.execute(text('INSERT INTO "user" (id) VALUES (1), (2)'))
                connection.execute(text('INSERT INTO area (id) VALUES (10)'))
                connection.execute(text('INSERT INTO university (id) VALUES (20)'))
                connection.execute(text("""
                    INSERT INTO route (id, driver_id, from_area_id,
                                       to_university_id, capacity, status)
                    VALUES (30, 1, 10, 20, 4, 'ACTIVE')
                """))
                connection.execute(text(
                    'INSERT INTO ride_request (id, route_id) VALUES (40, 30)'
                ))

                migration = importlib.import_module(
                    "migrations.versions.20261009_0003_route_student_profile"
                )
                migration.op = Operations(MigrationContext.configure(connection))
                migration.upgrade()
                assert connection.execute(text("""
                    SELECT departure_time IS NULL, return_time IS NULL,
                           price_iqd IS NULL, notes IS NULL FROM route WHERE id = 30
                """)).one() == (True, True, True, True)
                connection.execute(text("""
                    INSERT INTO student_profile
                        (user_id, area_id, university_id, preferred_arrival_time)
                    VALUES (2, 10, 20, TIME '08:30')
                """))
                expect_integrity_error(connection,
                    "INSERT INTO student_profile (user_id) VALUES (2)")
                expect_integrity_error(connection,
                    "INSERT INTO student_profile (user_id, area_id) VALUES (1, 999)")
                expect_integrity_error(connection,
                    "INSERT INTO student_profile (user_id, university_id) VALUES (1, 999)")
                expect_integrity_error(connection,
                    "UPDATE route SET price_iqd = -1 WHERE id = 30")
                connection.execute(text("""
                    UPDATE route SET departure_time = TIME '07:00',
                                     return_time = TIME '14:00', price_iqd = 45000
                    WHERE id = 30
                """))
                assert connection.execute(text(
                    "SELECT price_iqd FROM route WHERE id = 30"
                )).scalar_one() == 45000

                migration.downgrade()
                assert connection.execute(text(
                    "SELECT to_regclass('student_profile') IS NULL"
                )).scalar_one() is True
                assert connection.execute(text(
                    "SELECT count(*) FROM ride_request WHERE id = 40"
                )).scalar_one() == 1
                assert connection.execute(text("""
                    SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'route'
                      AND column_name IN
                        ('departure_time', 'return_time', 'price_iqd', 'notes')
                """)).scalar_one() == 0
                connection.rollback()
    finally:
        engine.dispose()
