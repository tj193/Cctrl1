"""Metadata and PostgreSQL SQL checks; no database connection is made."""

from datetime import timezone

from sqlalchemy import CheckConstraint, Enum as SAEnum
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from src.admin.models import (
    RideRequest, RideRequestStatus, Route, RouteStudents, RouteStudentStatus,
)


def test_request_defaults_and_status_serialization():
    request = RideRequest(student_id=3, route_id=7)
    assert request.status is RideRequestStatus.PENDING
    assert request.version == 1
    assert request.created_at.tzinfo is timezone.utc
    assert request.decided_at is None
    assert request.decided_by is None

    column = RideRequest.__table__.c.status
    assert isinstance(column.type, SAEnum)
    assert column.type.enums == ["PENDING", "ACCEPTED", "DECLINED"]
    assert column.type.name == "riderequeststatus"
    assert [status.value for status in RideRequestStatus] == [
        "Pending", "Accepted", "Declined"
    ]
    assert RideRequest(status=RideRequestStatus.ACCEPTED).status.value == "Accepted"
    assert RideRequest(status=RideRequestStatus.DECLINED).status.value == "Declined"


def test_request_postgresql_table_and_foreign_keys():
    table = RideRequest.__table__
    assert table.name == "ride_request"
    assert {key.target_fullname for key in table.foreign_keys} == {
        "user.id", "route.id"
    }
    assert len(table.foreign_keys) == 3
    assert table.c.created_at.type.timezone is True
    assert table.c.decided_at.type.timezone is True
    assert table.c.status.server_default is not None
    assert table.c.version.server_default is not None
    assert any(c.name == "ck_ride_request_version_positive"
               for c in table.constraints if isinstance(c, CheckConstraint))
    sql = str(CreateTable(table).compile(dialect=postgresql.dialect()))
    assert "TIMESTAMP WITH TIME ZONE" in sql
    assert "riderequeststatus" in sql


def test_pending_request_unique_index_is_partial():
    index = next(i for i in RideRequest.__table__.indexes
                 if i.name == "uq_ride_request_pending_student_route")
    assert index.unique is True
    assert [column.name for column in index.columns] == ["student_id", "route_id"]
    sql = str(CreateIndex(index).compile(dialect=postgresql.dialect()))
    assert "WHERE status = 'PENDING'::riderequeststatus" in sql
    assert "ACCEPTED" not in sql and "DECLINED" not in sql


def test_active_enrollment_unique_index_excludes_cancelled():
    assert [status.name for status in RouteStudentStatus] == ["ACTIVE", "CANCELLED"]
    index = next(i for i in RouteStudents.__table__.indexes
                 if i.name == "uq_routestudents_active_student_route")
    assert index.unique is True
    sql = str(CreateIndex(index).compile(dialect=postgresql.dialect()))
    assert "WHERE status = 'ACTIVE'::routestudentstatus" in sql
    assert "CANCELLED" not in sql
    assert any(i.name == "ix_routestudents_route_status"
               for i in RouteStudents.__table__.indexes)


def test_route_capacity_check_metadata():
    check = next(c for c in Route.__table__.constraints
                 if isinstance(c, CheckConstraint) and c.name == "ck_route_capacity_positive")
    assert str(check.sqltext) == "capacity > 0"
