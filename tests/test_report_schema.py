"""Report metadata and isolated SQLite behavior; no Neon connection."""

import ast
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import DateTime, String, Text, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from src.admin.models import (
    Area, Report, ReportStatus, Route, University, User, UserRole,
)


def test_existing_report_contract_and_nullable_additions():
    report = Report(
        report_id=1, target_id=2, target_type=UserRole.DRIVER, reason="Old reason"
    )
    assert report.report_id == 1
    assert report.target_id == 2
    assert report.target_type == UserRole.DRIVER
    assert report.reason == "Old reason"
    assert report.status == ReportStatus.PENDING
    assert report.created_at.tzinfo is timezone.utc
    for name in (
        "type", "subject", "description", "public_resolution", "internal_notes",
        "related_route_id", "updated_at", "resolved_at",
    ):
        assert getattr(report, name) is None
        assert Report.__table__.c[name].nullable is True
    assert Report.__table__.c.target_id.nullable is True
    assert Report.__table__.c.target_type.nullable is True
    assert Report.__table__.c.report_id.nullable is False
    assert Report.__table__.c.reason.nullable is True


def test_report_types_foreign_keys_and_status_enum_preserved():
    table = Report.__table__
    assert isinstance(table.c.type.type, String)
    assert table.c.type.type.length == 32
    assert isinstance(table.c.subject.type, String)
    assert table.c.subject.type.length == 120
    for name in ("description", "public_resolution", "internal_notes"):
        assert isinstance(table.c[name].type, Text)
    for name in ("created_at", "updated_at", "resolved_at"):
        column_type = table.c[name].type
        timestamp_type = column_type if isinstance(column_type, DateTime) else column_type.impl
        assert isinstance(timestamp_type, DateTime)
        assert timestamp_type.timezone is True
    assert {key.target_fullname for key in table.foreign_keys} == {
        "user.id", "route.id"
    }
    assert len(table.foreign_keys) == 4
    assert [value.name for value in ReportStatus] == [
        "PENDING", "INVESTIGATING", "RESOLVED", "DISMISSED"
    ]
    assert {index.name for index in table.indexes} == {
        "ix_report_reporter_created_at", "ix_report_status_created_at",
        "ix_report_related_route_id",
    }


def test_expand_migration_has_no_reason_copy_or_data_update():
    migration = Path(__file__).resolve().parents[1] / "migrations" / "versions" / (
        "20261009_0004_reports_complaints.py"
    )
    tree = ast.parse(migration.read_text(encoding="utf-8"))
    upgrade = next(node for node in tree.body
                   if isinstance(node, ast.FunctionDef) and node.name == "upgrade")
    allowed = {"alter_column", "add_column", "create_foreign_key", "create_index"}
    for statement in upgrade.body:
        assert isinstance(statement, ast.Expr)
        assert isinstance(statement.value, ast.Call)
        call = statement.value.func
        assert isinstance(call, ast.Attribute)
        assert isinstance(call.value, ast.Name) and call.value.id == "op"
        assert call.attr in allowed
    assert "reason" not in ast.get_source_segment(migration.read_text(encoding="utf-8"), upgrade)


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            yield db
    finally:
        engine.dispose()


def test_owner_optional_target_and_route_relationships(session):
    student = User(name="Student", email="student-report@example.test",
                   password_hash="test", role=UserRole.STUDENT)
    driver = User(name="Driver", email="driver-report@example.test",
                  password_hash="test", role=UserRole.DRIVER)
    area = Area(Area_name="Report Area", city="Test City")
    university = University(University_name="Report University")
    session.add_all([student, driver, area, university])
    session.commit()
    for item in (student, driver, area, university):
        session.refresh(item)
    route = Route(driver_id=driver.id, from_area_id=area.id,
                  to_university_id=university.id, capacity=3)
    session.add(route)
    session.commit()
    session.refresh(route)

    report = Report(
        report_id=student.id, reason="Pickup concern", type="route",
        subject="Pickup issue", description="The pickup location was unclear.",
        related_route_id=route.id,
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    assert report.target_id is None and report.target_type is None
    assert report.related_route_id == route.id
    assert report.reason == "Pickup concern"

    report.status = ReportStatus.RESOLVED
    report.resolved_by = driver.id
    report.public_resolution = "Pickup details clarified."
    report.internal_notes = "Private review detail."
    report.updated_at = datetime.now(timezone.utc)
    report.resolved_at = report.updated_at
    session.commit()
    stored = session.exec(select(Report).where(Report.id == report.id)).one()
    assert stored.public_resolution != stored.internal_notes
    assert stored.status == ReportStatus.RESOLVED
    assert stored.resolved_at is not None

    canonical = Report(report_id=student.id, reason=None, type="route",
                       subject="Canonical title", description="Canonical details")
    session.add(canonical)
    session.commit()
    session.refresh(canonical)
    assert canonical.reason is None

    with pytest.raises(IntegrityError):
        session.add(Report(report_id=999999, reason="Bad reporter"))
        session.commit()
    session.rollback()
    with pytest.raises(IntegrityError):
        session.add(Report(report_id=student.id, reason="Bad route",
                           related_route_id=999999))
        session.commit()
    session.rollback()
