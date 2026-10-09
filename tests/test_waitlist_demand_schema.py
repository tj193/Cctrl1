"""Route-demand metadata and isolated SQLite constraint checks."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import CheckConstraint, event
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateIndex
from sqlmodel import Session, SQLModel, create_engine

from src.admin.models import (
    Area, RideRequest, Route, RouteDemand, RouteDemandStatus,
    RouteStudents, StudentProfile, University, User, UserRole,
)


def test_demand_model_and_existing_seat_constraints():
    table = RouteDemand.__table__
    assert table.name == "routedemand"
    assert {key.target_fullname for key in table.foreign_keys} == {
        "user.id", "area.id", "university.id"
    }
    assert [status.name for status in RouteDemandStatus] == [
        "ACTIVE", "FULFILLED", "CANCELLED"
    ]
    assert table.c.student_id.nullable is False
    assert table.c.from_area_id.nullable is False
    assert table.c.to_university_id.nullable is False
    assert table.c.created_at.nullable is False
    assert table.c.preferred_time.nullable is True
    unique = next(index for index in table.indexes
                  if index.name == "uq_routedemand_active_student_journey")
    assert unique.unique is True
    assert [column.name for column in unique.columns] == [
        "student_id", "from_area_id", "to_university_id"
    ]
    assert "WHERE status = 'ACTIVE'::routedemandstatus" in str(
        CreateIndex(unique).compile(dialect=postgresql.dialect())
    )
    assert any(index.name == "ix_routedemand_origin_university_status"
               for index in table.indexes)
    assert any(index.name == "uq_ride_request_pending_student_route"
               for index in RideRequest.__table__.indexes)
    assert any(index.name == "uq_routestudents_active_student_route"
               for index in RouteStudents.__table__.indexes)
    assert {name for name in (constraint.name for constraint in Route.__table__.constraints
                             if isinstance(constraint, CheckConstraint))} >= {
        "ck_route_capacity_positive", "ck_route_price_iqd_nonnegative"
    }
    assert {key.target_fullname for key in StudentProfile.__table__.foreign_keys} == {
        "user.id", "area.id", "university.id"
    }


@pytest.fixture
def demand_database():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            student = User(name="Demand Student", email="demand@example.test",
                           password_hash="test", role=UserRole.STUDENT)
            area = Area(Area_name="Demand Area", city="Test City")
            university = University(University_name="Demand University")
            session.add_all([student, area, university])
            session.commit()
            for item in (student, area, university):
                session.refresh(item)
            yield session, student.id, area.id, university.id
    finally:
        engine.dispose()


def insert_demand(session, student_id, area_id, university_id, status):
    return session.execute(RouteDemand.__table__.insert().values(
        student_id=student_id, from_area_id=area_id,
        to_university_id=university_id, status=status,
        created_at=datetime.now(timezone.utc),
    ))


def test_active_duplicate_is_rejected_but_history_can_remain(demand_database):
    session, student_id, area_id, university_id = demand_database
    first = insert_demand(session, student_id, area_id, university_id,
                          RouteDemandStatus.ACTIVE)
    session.commit()
    with pytest.raises(IntegrityError):
        insert_demand(session, student_id, area_id, university_id,
                      RouteDemandStatus.ACTIVE)
        session.commit()
    session.rollback()
    session.execute(RouteDemand.__table__.update().where(
        RouteDemand.__table__.c.id == first.inserted_primary_key[0]
    ).values(status=RouteDemandStatus.CANCELLED))
    insert_demand(session, student_id, area_id, university_id,
                  RouteDemandStatus.ACTIVE)
    insert_demand(session, student_id, area_id, university_id,
                  RouteDemandStatus.FULFILLED)
    session.commit()


def test_demand_foreign_keys_require_canonical_records(demand_database):
    session, student_id, area_id, university_id = demand_database
    for bad_ids in (
        (999999, area_id, university_id),
        (student_id, 999999, university_id),
        (student_id, area_id, 999999),
    ):
        with pytest.raises(IntegrityError):
            insert_demand(session, *bad_ids, RouteDemandStatus.ACTIVE)
            session.commit()
        session.rollback()
