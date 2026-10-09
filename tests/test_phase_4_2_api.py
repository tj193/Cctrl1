"""Phase 4.2 API behavior in isolated SQLite, never Neon."""

import os
import ast
from datetime import time
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "local-test-secret-with-more-than-32-characters"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from src.admin.DataBase import get_session
from src.admin.main import app
from src.admin.models import (ApplicationStatus, Area, Driver_Profile, Report, ReportStatus,
                              RideRequest, RideRequestStatus, Route, RouteDemand,
                              RouteDemandStatus, RouteStudents, Status, University,
                              User, UserRole)
from src.admin.security import get_password_hash


@pytest.fixture
def api():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    try:
        yield TestClient(app), engine
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def setup(engine):
    with Session(engine) as session:
        users = [User(name=name, email=f"{name.lower()}@example.test",
                      password_hash=get_password_hash("safe-test-password"), role=role)
                 for name, role in (("Admin", UserRole.ADMIN), ("Driver", UserRole.DRIVER),
                                    ("OtherDriver", UserRole.DRIVER), ("Student", UserRole.STUDENT),
                                    ("OtherStudent", UserRole.STUDENT))]
        area = Area(Area_name="Origin", city="Baghdad")
        other_area = Area(Area_name="Unmatched", city="Baghdad")
        university = University(University_name="University")
        session.add_all(users + [area, other_area, university])
        session.commit()
        for item in users + [area, other_area, university]:
            session.refresh(item)
        for i, user in enumerate(users[1:3], 1):
            session.add(Driver_Profile(Driver_id=user.id, phone_number=f"+964770000000{i}",
                                       vehicle_name="Car", vehicle_model="Model", vehicle_plate=f"P{i}",
                                       license_number=f"L{i}", national_id=f"N{i}",
                                       vehicle_photo_url="", license_photo_url="", id_photo_url="",
                                       verification_status=ApplicationStatus.APPROVED))
        route = Route(driver_id=users[1].id, from_area_id=area.id,
                      to_university_id=university.id, capacity=1,
                      departure_time=time(7), return_time=time(15), price_iqd=50000)
        other_route = Route(driver_id=users[2].id, from_area_id=area.id,
                            to_university_id=university.id, capacity=2)
        session.add_all([route, other_route])
        session.commit()
        session.refresh(route)
        session.refresh(other_route)
        return {"admin": users[0].id, "driver": users[1].id, "other_driver": users[2].id,
                "student": users[3].id, "other_student": users[4].id,
                "route": route.id, "other_route": other_route.id,
                "area": area.id, "other_area": other_area.id, "university": university.id}


def auth(client, role):
    path = {"admin": "/auth/login", "driver": "/auth/driver-login",
            "otherdriver": "/auth/driver-login", "student": "/auth/student-login",
            "otherstudent": "/auth/student-login"}[role]
    response = client.post(path, data={"username": f"{role}@example.test", "password": "safe-test-password"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_request_acceptance_capacity_ownership_and_suspension(api):
    client, engine = api
    ids = setup(engine)
    student = auth(client, "student")
    other_student = auth(client, "otherstudent")
    driver = auth(client, "driver")
    other_driver = auth(client, "otherdriver")
    admin = auth(client, "admin")
    created = client.post("/student/ride-requests", headers=student, json={"route_id": ids["route"]})
    assert created.status_code == 201, created.text
    request_id = created.json()["id"]
    assert created.json()["status"] == "Pending"
    assert client.get(f"/student/ride-requests/{request_id}", headers=other_student).status_code == 404
    assert client.post("/student/ride-requests", headers=student, json={"route_id": ids["route"]}).status_code == 409
    assert client.get(f"/driver/ride-requests/{request_id}", headers=other_driver).status_code == 404
    assert client.post(f"/driver/ride-requests/{request_id}/accept", headers=other_driver).status_code == 404
    assert client.get(f"/driver/routes/{ids['route']}/enrollments", headers=driver).json()["occupied_seats"] == 0
    accepted = client.post(f"/driver/ride-requests/{request_id}/accept", headers=driver)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "Accepted"
    assert client.post(f"/driver/ride-requests/{request_id}/accept", headers=driver).status_code == 409
    assert client.post("/student/ride-requests", headers=student, json={"route_id": ids["route"]}).status_code == 409
    assert client.get(f"/driver/routes/{ids['route']}/enrollments", headers=driver).json()["occupied_seats"] == 1
    assert client.post("/student/ride-requests", headers=other_student, json={"route_id": ids["route"]}).status_code == 409
    with Session(engine) as session:
        assert session.get(RideRequest, request_id).status == RideRequestStatus.ACCEPTED
        assert len(session.exec(select(RouteStudents).where(RouteStudents.route_id == ids["route"])).all()) == 1
        user = session.get(User, ids["driver"])
        user.status = Status.SUSPENDED
        session.add(user)
        session.commit()
    assert client.post(f"/driver/ride-requests/{request_id}/accept", headers=driver).status_code == 401
    assert client.get("/student/routes", headers=student).json()[0]["id"] == ids["other_route"]
    flagged = next(row for row in client.get("/admin/routes", headers=admin).json()
                   if row["id"] == ids["route"])
    assert flagged["requires_review"] is True
    assert flagged["review_active_enrollments"] == 1
    with Session(engine) as session:
        user = session.get(User, ids["other_student"])
        user.status = Status.SUSPENDED
        session.add(user)
        session.commit()
    assert client.post("/student/ride-requests", headers=other_student,
                       json={"route_id": ids["other_route"]}).status_code == 401


def test_decline_and_atomic_rollback(api):
    client, engine = api
    ids = setup(engine)
    student = auth(client, "student")
    driver = auth(client, "driver")
    first = client.post("/student/ride-requests", headers=student, json={"route_id": ids["route"]}).json()["id"]
    assert client.post(f"/driver/ride-requests/{first}/decline", headers=driver).json()["status"] == "Declined"
    assert client.post(f"/driver/ride-requests/{first}/accept", headers=driver).status_code == 409
    second = client.post("/student/ride-requests", headers=student, json={"route_id": ids["route"]}).json()["id"]

    def fail_enrollment(conn, cursor, statement, parameters, context, executemany):
        if statement.lower().startswith("insert into routestudents"):
            raise IntegrityError(statement, parameters, Exception("isolated test failure"))

    event.listen(engine, "before_cursor_execute", fail_enrollment)
    try:
        response = client.post(f"/driver/ride-requests/{second}/accept", headers=driver)
        assert response.status_code == 409
        assert "isolated test failure" not in response.text
    finally:
        event.remove(engine, "before_cursor_execute", fail_enrollment)
    with Session(engine) as session:
        assert session.get(RideRequest, second).status == RideRequestStatus.PENDING
        assert session.exec(select(RouteStudents)).all() == []


def test_reports_legacy_privacy_review_and_owner(api):
    client, engine = api
    ids = setup(engine)
    student = auth(client, "student")
    other_student = auth(client, "otherstudent")
    driver = auth(client, "driver")
    admin = auth(client, "admin")
    with Session(engine) as session:
        session.add(Report(report_id=ids["student"], reason="Original legacy text"))
        session.commit()
    legacy = client.get("/student/reports", headers=student).json()[0]
    assert legacy["subject"].startswith("Legacy report #")
    assert legacy["description"] == "Original legacy text"
    assert "internal_notes" not in legacy
    created = client.post("/student/reports", headers=student,
                          json={"type": "service", "subject": "App problem", "description": "The app could not show my route details."})
    assert created.status_code == 201, created.text
    report_id = created.json()["id"]
    assert "internal_notes" not in created.json()
    assert created.json()["legacy_fallback"] is False
    assert client.get(f"/student/reports/{report_id}", headers=other_student).status_code == 404
    assert client.get(f"/driver/reports/{report_id}", headers=driver).status_code == 404
    assert client.post("/driver/reports", headers=driver, json={"type": "account",
                        "subject": "Account issue", "description": "My account details need correction."}).status_code == 201
    review = client.patch(f"/admin/reports/{report_id}/review", headers=admin,
                          json={"status": "Resolved", "public_resolution": "We fixed the issue.",
                                "internal_notes": "Private administrative check."})
    assert review.status_code == 200, review.text
    assert review.json()["resolved_by"] == ids["admin"]
    assert review.json()["resolved_at"] is not None
    assert review.json()["internal_notes"] == "Private administrative check."
    owner = client.get(f"/student/reports/{report_id}", headers=student).json()
    assert owner["public_resolution"] == "We fixed the issue."
    assert "internal_notes" not in owner
    assert client.patch(f"/admin/reports/{report_id}/review", headers=admin,
                        json={"status": "Pending"}).status_code == 409
    assert client.patch(f"/admin/reports/{report_id}/review", headers=driver,
                        json={"status": "Dismissed"}).status_code == 401
    with Session(engine) as session:
        report = session.get(Report, report_id)
        assert report.reason is None
        assert report.subject == "App problem"
        assert report.description == "The app could not show my route details."


def test_route_demand_duplicates_cancellation_and_analytics(api):
    client, engine = api
    ids = setup(engine)
    student = auth(client, "student")
    other_student = auth(client, "otherstudent")
    admin = auth(client, "admin")
    body = {"from_area_id": ids["other_area"], "to_university_id": ids["university"]}
    assert client.post("/student/route-demand", headers=student,
                       json={"from_area_id": ids["area"], "to_university_id": ids["university"]}).status_code == 409
    created = client.post("/student/route-demand", headers=student, json=body)
    assert created.status_code == 201, created.text
    demand_id = created.json()["id"]
    assert client.post("/student/route-demand", headers=student, json=body).status_code == 409
    assert client.get(f"/student/route-demand/{demand_id}", headers=other_student).status_code == 404
    assert client.get("/admin/route-demand", headers=admin).json()[0]["student_count"] == 1
    cancelled = client.post(f"/student/route-demand/{demand_id}/cancel", headers=student)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "Cancelled"
    assert client.post(f"/student/route-demand/{demand_id}/cancel", headers=student).status_code == 409
    assert client.post("/student/route-demand", headers=student, json=body).status_code == 201
    assert client.get("/admin/route-demand", headers=admin).json()[0]["student_count"] == 1
    with Session(engine) as session:
        assert len(session.exec(select(RouteDemand).where(RouteDemand.status == RouteDemandStatus.ACTIVE)).all()) == 1


def test_report_creation_fails_closed_before_reason_migration(api, monkeypatch):
    client, engine = api
    ids = setup(engine)
    student = auth(client, "student")
    from src.admin.routers import report_api

    class Inspector:
        def get_columns(self, table):
            assert table == "report"
            return [{"name": "reason", "nullable": False}]

    monkeypatch.setattr(report_api, "inspect", lambda connection: Inspector())
    response = client.post("/student/reports", headers=student,
                           json={"type": "service", "subject": "App issue",
                                 "description": "The app could not show my route details."})
    assert response.status_code == 503
    with Session(engine) as session:
        assert session.exec(select(Report)).all() == []


def test_reason_nullable_revision_only_changes_one_column():
    source = (Path(__file__).resolve().parents[1] / "migrations" / "versions" /
              "20261009_0006_report_reason_nullable.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    upgrade = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "upgrade")
    assert len(upgrade.body) == 1
    call = upgrade.body[0].value
    assert isinstance(call, ast.Call)
    assert isinstance(call.func, ast.Attribute) and call.func.attr == "alter_column"
    assert [arg.value for arg in call.args] == ["report", "reason"]
    assert any(keyword.arg == "nullable" and isinstance(keyword.value, ast.Constant)
               and keyword.value.value is True for keyword in call.keywords)
    assert "SELECT count(*) FROM report WHERE reason IS NULL" in source
