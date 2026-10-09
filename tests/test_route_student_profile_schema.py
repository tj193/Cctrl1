"""Schema tests using metadata and an isolated in-memory SQLite database."""

from datetime import time

import pytest
from sqlalchemy import CheckConstraint, Integer, Text, Time, event
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateTable
from sqlmodel import Session, SQLModel, create_engine

from src.admin.models import Area, Route, StudentProfile, University, User, UserRole


def test_route_columns_are_nullable_and_postgresql_types():
    route = Route(driver_id=1, from_area_id=2, to_university_id=3, capacity=4)
    assert route.departure_time is None
    assert route.return_time is None
    assert route.price_iqd is None
    assert route.notes is None

    table = Route.__table__
    for name in ("departure_time", "return_time", "price_iqd", "notes"):
        assert table.c[name].nullable is True
    assert isinstance(table.c.departure_time.type, Time)
    assert isinstance(table.c.return_time.type, Time)
    assert isinstance(table.c.price_iqd.type, Integer)
    assert isinstance(table.c.notes.type, Text)
    assert {key.target_fullname for key in table.foreign_keys} == {
        "user.id", "area.id", "university.id"
    }
    assert any(c.name == "ck_route_capacity_positive"
               for c in table.constraints if isinstance(c, CheckConstraint))
    assert any(c.name == "ck_route_price_iqd_nonnegative"
               for c in table.constraints if isinstance(c, CheckConstraint))
    sql = str(CreateTable(table).compile(dialect=postgresql.dialect()))
    assert "departure_time TIME" in sql
    assert "return_time TIME" in sql


def test_student_profile_one_to_one_and_nullable_location_fields():
    table = StudentProfile.__table__
    assert table.name == "student_profile"
    assert {column.name for column in table.primary_key} == {"user_id"}
    assert {key.target_fullname for key in table.foreign_keys} == {
        "user.id", "area.id", "university.id"
    }
    for name in ("phone", "area_id", "university_id", "preferred_arrival_time"):
        assert table.c[name].nullable is True
    assert isinstance(table.c.preferred_arrival_time.type, Time)
    assert any(i.name == "ix_student_profile_area_university" for i in table.indexes)
    assert StudentProfile(user_id=1).preferred_arrival_time is None


@pytest.fixture
def sqlite_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            yield session
    finally:
        engine.dispose()


def test_profile_relationships_and_one_to_one_in_isolated_sqlite(sqlite_session):
    session = sqlite_session
    student = User(name="Student", email="student@example.test", password_hash="test",
                   role=UserRole.STUDENT)
    other = User(name="Other", email="other@example.test", password_hash="test",
                 role=UserRole.STUDENT)
    area = Area(Area_name="Test Area", city="Test City")
    university = University(University_name="Test University")
    session.add_all([student, other, area, university])
    session.commit()
    for item in (student, other, area, university):
        session.refresh(item)

    session.add(StudentProfile(user_id=student.id, area_id=area.id,
                               university_id=university.id,
                               preferred_arrival_time=time(8, 30)))
    session.commit()
    with pytest.raises(IntegrityError):
        session.add(StudentProfile(user_id=student.id))
        session.commit()
    session.rollback()
    with pytest.raises(IntegrityError):
        session.add(StudentProfile(user_id=999999, area_id=area.id))
        session.commit()
    session.rollback()
    with pytest.raises(IntegrityError):
        session.add(StudentProfile(user_id=other.id, area_id=999999))
        session.commit()
    session.rollback()
    with pytest.raises(IntegrityError):
        session.add(StudentProfile(user_id=other.id, university_id=999999))
        session.commit()
    session.rollback()


def test_nonnegative_price_and_legacy_nulls_in_isolated_sqlite(sqlite_session):
    session = sqlite_session
    driver = User(name="Driver", email="driver@example.test", password_hash="test",
                  role=UserRole.DRIVER)
    area = Area(Area_name="Other Area", city="Test City")
    university = University(University_name="Other University")
    session.add_all([driver, area, university])
    session.commit()
    for item in (driver, area, university):
        session.refresh(item)
    route = Route(driver_id=driver.id, from_area_id=area.id,
                  to_university_id=university.id, capacity=3)
    session.add(route)
    session.commit()
    session.refresh(route)
    assert (route.departure_time, route.return_time, route.price_iqd, route.notes) == (
        None, None, None, None
    )
    route.price_iqd = -1
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
