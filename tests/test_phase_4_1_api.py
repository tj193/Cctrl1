import os
import hashlib
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "local-test-secret-with-more-than-32-characters"

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from src.admin.DataBase import get_session
from src.admin.main import app
from src.admin.models import (ApplicationStatus, Area, Driver_Profile, RideRequest,
                              Route, RouteDemand, RouteStudents, RouteStudentStatus,
                              Status, University, UniversityStatus, User, UserRole)
from src.admin.security import ALGORITHM, create_access_token, get_password_hash, secret_key


@pytest.fixture
def api():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    try:
        yield TestClient(app), engine
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_public_catalogue_lists_only_active_canonical_rows(api):
    client, engine = api
    with Session(engine) as session:
        session.add_all([
            Area(Area_name="الكرادة", city="بغداد"),
            Area(Area_name="Disabled", city="بغداد", status=UniversityStatus.DISABLED),
            University(University_name="جامعة بغداد", governorate="بغداد"),
            University(University_name="Disabled University", status=UniversityStatus.DISABLED),
        ])
        session.commit()
    areas = client.get("/public/catalogue/areas")
    universities = client.get("/public/catalogue/universities")
    assert areas.status_code == universities.status_code == 200
    assert len(areas.json()) == len(universities.json()) == 1
    assert areas.json()[0]["name"] == "الكرادة"
    assert isinstance(areas.json()[0]["id"], int)
    assert universities.json()[0]["name"] == "جامعة بغداد"


def login(client, path, email, password="safe-test-password"):
    result = client.post(path, data={"username": email, "password": password})
    assert result.status_code == 200, result.text
    return {"Authorization": f"Bearer {result.json()['access_token']}"}


def seed(engine):
    with Session(engine) as session:
        admin = User(name="Admin", email="admin@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.ADMIN)
        driver = User(name="Driver", email="driver@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.DRIVER)
        other = User(name="Other Driver", email="other-driver@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.DRIVER)
        pending = User(name="Pending Driver", email="pending@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.DRIVER)
        area = Area(Area_name="Area A", city="Baghdad")
        inactive_area = Area(Area_name="Area B", city="Baghdad", status=UniversityStatus.DISABLED)
        university = University(University_name="University A")
        inactive_university = University(University_name="University B", status=UniversityStatus.DISABLED)
        session.add_all([admin, driver, other, pending, area, inactive_area, university, inactive_university])
        session.commit()
        for item in (admin, driver, other, pending, area, inactive_area, university, inactive_university):
            session.refresh(item)
        session.add_all([
            Driver_Profile(Driver_id=driver.id, phone_number="+9647701111111", vehicle_name="Car", vehicle_model="Model",
                           vehicle_plate="P1", license_number="L1", national_id="N1", vehicle_photo_url="",
                           license_photo_url="", id_photo_url="", verification_status=ApplicationStatus.APPROVED),
            Driver_Profile(Driver_id=other.id, phone_number="+9647702222222", vehicle_name="Car", vehicle_model="Model",
                           vehicle_plate="P2", license_number="L2", national_id="N2", vehicle_photo_url="",
                           license_photo_url="", id_photo_url="", verification_status=ApplicationStatus.APPROVED),
            Driver_Profile(Driver_id=pending.id, phone_number="+9647703333333", vehicle_name="Car", vehicle_model="Model",
                           vehicle_plate="P3", license_number="L3", national_id="N3", vehicle_photo_url="",
                           license_photo_url="", id_photo_url=""),
        ])
        session.commit()
        return {"admin": admin.id, "driver": driver.id, "other": other.id, "pending": pending.id,
                "area": area.id, "inactive_area": inactive_area.id,
                "university": university.id, "inactive_university": inactive_university.id}


def student_payload(email="student@example.test", **changes):
    return {"full_name": "Student One", "email": email, "password": "safe-test-password", **changes}


def route_payload(ids, **changes):
    return {"from_area_id": ids["area"], "to_university_id": ids["university"],
            "capacity": 2, "departure_time": "07:30:00", "return_time": "15:00:00",
            "price_iqd": 50000, **changes}


def test_student_registration_login_profile_and_guards(api):
    client, engine = api
    ids = seed(engine)
    assert client.post("/auth/student-register", json=student_payload(area_id=999)).status_code == 422
    assert client.post("/auth/student-register", json=student_payload(university_id=ids["inactive_university"])).status_code == 422
    created = client.post("/auth/student-register", json=student_payload(
        area_id=ids["area"], university_id=ids["university"], phone="07701234567",
        preferred_arrival_time="08:00:00"))
    assert created.status_code == 201, created.text
    assert "password_hash" not in created.text
    assert client.post("/auth/student-register", json=student_payload()).status_code == 409
    assert client.post("/auth/student-login", data={"username": "student@example.test", "password": "wrong"}).status_code == 401
    headers = login(client, "/auth/student-login", "student@example.test")
    profile = client.get("/student/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["user_id"] == created.json()["id"]
    assert profile.json()["phone"] == "+9647701234567"
    assert "password_hash" not in profile.text
    assert client.put("/student/profile", headers=headers, json={"user_id": ids["admin"]}).status_code == 422
    assert client.get("/student/profile", headers=headers).json()["user_id"] == created.json()["id"]
    assert client.put("/student/profile", headers=headers, json={"area_id": ids["inactive_area"]}).status_code == 422
    assert client.put("/student/profile", headers=headers, json={"university_id": 999}).status_code == 422
    assert len(client.get("/student/areas", headers=headers).json()) == 1
    assert len(client.get("/student/universities", headers=headers).json()) == 1
    assert client.get("/student/profile").status_code == 401
    assert client.get("/admin/me", headers=headers).status_code == 401
    admin_headers = login(client, "/auth/login", "admin@example.test")
    assert client.get("/student/profile", headers=admin_headers).status_code == 401
    assert client.get("/admin/me", headers=admin_headers).status_code == 200
    token = headers["Authorization"].split()[1]
    assert client.get("/student/profile", headers={"Authorization": "Bearer invalid"}).status_code == 401
    expired = jwt.encode({"sub": str(created.json()["id"]), "role": "Student", "pwd": "bad",
                          "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}, secret_key(), algorithm=ALGORITHM)
    assert client.get("/student/profile", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    forged_role = jwt.decode(token, secret_key(), algorithms=[ALGORITHM])
    forged_role["role"] = "Admin"
    bad_role = jwt.encode(forged_role, secret_key(), algorithm=ALGORITHM)
    assert client.get("/student/profile", headers={"Authorization": f"Bearer {bad_role}"}).status_code == 401
    with Session(engine) as session:
        student = session.get(User, created.json()["id"])
        student.status = Status.SUSPENDED
        session.add(student)
        session.commit()
    assert client.get("/student/profile", headers=headers).status_code == 401
    assert client.post("/auth/student-login", data={"username": "student@example.test", "password": "safe-test-password"}).status_code == 403


def test_driver_routes_discovery_occupancy_and_regression(api):
    client, engine = api
    ids = seed(engine)
    student = client.post("/auth/student-register", json=student_payload())
    student_id = student.json()["id"]
    student_headers = login(client, "/auth/student-login", "student@example.test")
    driver_headers = login(client, "/auth/driver-login", "driver@example.test")
    other_headers = login(client, "/auth/driver-login", "other-driver@example.test")
    admin_headers = login(client, "/auth/login", "admin@example.test")
    assert client.get("/auth/driver-me", headers=driver_headers).status_code == 200
    assert client.get("/driver/routes", headers=student_headers).status_code == 401
    assert client.get("/student/routes", headers=driver_headers).status_code == 401
    assert client.get("/admin/routes", headers=driver_headers).status_code == 401
    assert client.post("/auth/driver-login", data={"username": "pending@example.test", "password": "safe-test-password"}).status_code == 403
    with Session(engine) as session:
        pending_hash = session.get(User, ids["pending"]).password_hash
    pending_token = create_access_token({"sub": str(ids["pending"]), "role": "Driver",
                                         "pwd": hashlib.sha256(pending_hash.encode()).hexdigest()})
    assert client.post("/driver/routes", headers={"Authorization": f"Bearer {pending_token}"}, json=route_payload(ids)).status_code == 403
    for changes in ({"capacity": 0}, {"price_iqd": -1}, {"from_area_id": ids["inactive_area"]},
                    {"to_university_id": ids["inactive_university"]}, {"departure_time": None}):
        assert client.post("/driver/routes", headers=driver_headers, json=route_payload(ids, **changes)).status_code == 422
    created = client.post("/driver/routes", headers=driver_headers, json=route_payload(ids, notes="North gate"))
    assert created.status_code == 201, created.text
    route_id = created.json()["id"]
    assert created.json()["driver_name"] == "Driver"
    assert created.json()["notes"] == "North gate"
    assert created.json()["available_seats"] == 2
    assert client.get("/driver/routes", headers=driver_headers).json()[0]["id"] == route_id
    assert client.get(f"/driver/routes/{route_id}", headers=other_headers).status_code == 404
    assert client.patch(f"/driver/routes/{route_id}", headers=other_headers, json={"capacity": 3}).status_code == 404
    assert client.patch(f"/driver/routes/{route_id}/disable", headers=other_headers).status_code == 404
    with Session(engine) as session:
        session.add_all([
            RouteStudents(student_id=student_id, route_id=route_id, status=RouteStudentStatus.ACTIVE),
            RouteStudents(student_id=student_id, route_id=route_id, status=RouteStudentStatus.CANCELLED),
            RideRequest(student_id=student_id, route_id=route_id),
            RouteDemand(student_id=student_id, from_area_id=ids["area"], to_university_id=ids["university"]),
        ])
        session.commit()
    found = client.get("/student/routes", headers=student_headers)
    assert found.status_code == 200, found.text
    assert found.json()[0]["occupied_seats"] == 1
    assert found.json()[0]["available_seats"] == 1
    assert "notes" not in found.json()[0]
    assert client.get("/student/routes", headers=student_headers, params={"from_area_id": ids["area"], "to_university_id": ids["university"], "status": "Active"}).json()[0]["id"] == route_id
    assert client.get("/student/routes", headers=student_headers, params={"from_area_id": ids["inactive_area"]}).status_code == 422
    assert client.get("/student/routes", headers=student_headers, params={"to_university_id": 999}).status_code == 422
    assert client.get("/student/routes", headers=student_headers, params={"status": "Disabled"}).json() == []
    assert client.get(f"/student/routes/{route_id}", headers=student_headers).json()["id"] == route_id
    assert client.patch(f"/driver/routes/{route_id}", headers=driver_headers, json={"capacity": 0}).status_code == 422
    assert client.patch(f"/driver/routes/{route_id}", headers=driver_headers, json={"price_iqd": -2}).status_code == 422
    second = client.post("/auth/student-register", json=student_payload(email="second@example.test"))
    assert second.status_code == 201
    with Session(engine) as session:
        session.add(RouteStudents(student_id=second.json()["id"], route_id=route_id,
                                  status=RouteStudentStatus.ACTIVE))
        session.commit()
    assert client.patch(f"/driver/routes/{route_id}", headers=driver_headers, json={"capacity": 1}).status_code == 409
    assert client.patch(f"/driver/routes/{route_id}", headers=driver_headers, json={"capacity": 2}).status_code == 200
    assert client.get("/student/routes", headers=student_headers).json()[0]["available_seats"] == 0
    assert client.patch(f"/driver/routes/{route_id}/disable", headers=driver_headers).status_code == 200
    assert client.get("/student/routes", headers=student_headers).json() == []
    assert client.get(f"/student/routes/{route_id}", headers=student_headers).status_code == 404
    assert client.get("/admin/routes", headers=admin_headers).status_code == 200
    with Session(engine) as session:
        driver = session.get(User, ids["driver"])
        driver.status = Status.SUSPENDED
        session.add(driver)
        session.commit()
    assert client.get("/driver/routes", headers=driver_headers).status_code == 401
