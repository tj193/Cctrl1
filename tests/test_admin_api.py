import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "local-test-secret-with-more-than-32-characters"

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from src.admin.DataBase import get_session
from src.admin.main import app
from src.admin.models import (
    Area, Driver_Profile, Report, Route, RouteDemand, RouteStudents,
    University, User, UserRole,
)
from src.admin.security import get_password_hash


def test_admin_journey():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def test_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = test_session
    try:
        with Session(engine) as session:
            admin = User(name="Admin", email="admin@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.ADMIN)
            student = User(name="Student", email="student@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.STUDENT)
            driver = User(name="Driver", email="driver@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.DRIVER)
            area = Area(Area_name="Baghdad", city="Baghdad")
            university = University(University_name="Example University")
            session.add_all([admin, student, driver, area, university])
            session.commit()
            for item in (admin, student, driver, area, university):
                session.refresh(item)
            profile = Driver_Profile(
                Driver_id=driver.id, phone_number="07000000000", vehicle_name="Car", vehicle_model="Toyota",
                vehicle_plate="TEST-1", license_number="L-1", national_id="N-1", vehicle_photo_url="",
                license_photo_url="", id_photo_url="",
            )
            route = Route(driver_id=driver.id, from_area_id=area.id, to_university_id=university.id, capacity=4)
            demand = RouteDemand(student_id=student.id, from_area_id=area.id, to_university_id=university.id)
            report = Report(report_id=student.id, target_id=driver.id, target_type=UserRole.DRIVER, reason="Test report")
            session.add_all([profile, route, demand, report])
            session.commit()
            session.refresh(route)
            session.refresh(profile)
            session.refresh(report)
            session.add(RouteStudents(student_id=student.id, route_id=route.id))
            session.commit()
            student_id, driver_id = student.id, driver.id
            area_id, university_id = area.id, university.id
            profile_id, route_id, report_id = profile.id, route.id, report.id

        client = TestClient(app)
        assert client.get("/health").status_code == 200
        assert client.get("/admin/dashboard/metrics").status_code == 401
        assert client.post("/auth/login", data={"username": "admin@example.test", "password": "wrong"}).status_code == 401
        assert client.post("/auth/login", data={"username": "student@example.test", "password": "safe-test-password"}).status_code == 403
        response = client.post("/auth/login", data={"username": "admin@example.test", "password": "safe-test-password"})
        assert response.status_code == 200
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        new_admin = {"name": "Second Admin", "email": "second@example.test", "password": "second-safe-password"}
        assert client.post("/admin/admins", json=new_admin).status_code == 401
        assert client.post("/admin/admins", headers=headers, json={**new_admin, "password": "short"}).status_code == 422
        created = client.post("/admin/admins", headers=headers, json=new_admin)
        assert created.status_code == 201, created.text
        assert created.json()["email"] == "second@example.test"
        assert "password" not in created.json() and "password_hash" not in created.json()
        assert client.post("/admin/admins", headers=headers, json=new_admin).status_code == 409
        assert client.post("/auth/login", data={"username": new_admin["email"], "password": new_admin["password"]}).status_code == 200
        assert client.get("/routes/", headers=headers).status_code == 200
        assert client.get("/routes/").status_code == 401

        metrics = client.get("/admin/dashboard/metrics", headers=headers).json()
        assert metrics == {"total_students": 1, "total_drivers": 1, "pending_drivers": 1, "active_routes": 1, "open_reports": 1}
        assert client.get("/admin/dashboard/recent-approvals", headers=headers).json()[0]["applicant_name"] == "Driver"
        assert client.get("/admin/dashboard/recent-reports", headers=headers).json()[0]["subject"] == "Test report"
        assert client.get("/admin/route-demand", headers=headers).json()[0]["student_count"] == 1
        analytics = client.get("/admin/route-demand/analytics", headers=headers).json()
        assert len(analytics) == 1
        assert analytics[0]["area_name"] == "Baghdad"
        assert analytics[0]["route_exists"] is True
        assert client.get("/admin/routes", headers=headers).json()[0]["enrolled_students"] == 1
        assert client.get("/admin/students", headers=headers).json()[0]["full_name"] == "Student"
        assert client.get("/admin/areas", headers=headers).json()[0]["name"] == "Baghdad"
        assert client.get("/admin/universities", headers=headers).json()[0]["name"] == "Example University"

        assert client.patch(f"/admin/driver-applications/{profile_id}/status", headers=headers, json={"status": "rejected"}).status_code == 400
        assert client.patch(f"/admin/driver-applications/{profile_id}/status", headers=headers, json={"status": "approved"}).status_code == 200
        assert client.get("/admin/available-drivers", headers=headers).json()[0]["id"] == driver_id
        assert client.post("/admin/routes", headers=headers, json={"area_id": area_id, "university_id": university_id, "driver_id": driver_id, "capacity": 3}).status_code == 201
        assert client.patch(f"/admin/routes/{route_id}/status", headers=headers, json={"status": "disabled"}).status_code == 200
        assert client.patch(f"/admin/reports/{report_id}/status", headers=headers, json={"status": "resolved"}).status_code == 200
        assert client.patch(f"/admin/students/{student_id}/status", headers=headers, json={"status": "suspended"}).status_code == 200
        assert client.patch(f"/admin/drivers/{driver_id}/status", headers=headers, json={"status": "suspended"}).status_code == 200

        assert client.get("/admin/me", headers=headers).json()["email"] == "admin@example.test"
        assert client.put("/admin/me", headers=headers, json={"name": "New Admin", "email": "new@example.test"}).status_code == 200
        assert client.post("/admin/me/password", headers=headers, json={"current_password": "wrong", "new_password": "new-safe-password"}).status_code == 400
        assert client.post("/admin/me/password", headers=headers, json={"current_password": "safe-test-password", "new_password": "new-safe-password"}).status_code == 200
        assert client.get("/admin/me", headers=headers).status_code == 401
        assert client.post("/auth/login", data={"username": "new@example.test", "password": "new-safe-password"}).status_code == 200
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_driver_application_approval_and_login():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def test_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = test_session
    try:
        with Session(engine) as session:
            session.add(User(name="Admin", email="admin@example.test", password_hash=get_password_hash("safe-test-password"), role=UserRole.ADMIN))
            session.commit()

        client = TestClient(app)
        application = {
            "full_name": "Test Driver", "email": "driver@example.test", "phone": "07701234567",
            "password": "driver-test-password", "vehicle_type": "Car", "vehicle_model": "Corolla",
            "plate_number": "BAG-123", "license_number": "LICENSE-123", "national_id": "NATIONAL-123",
        }
        submitted = client.post("/auth/driver-applications", json=application)
        assert submitted.status_code == 201, submitted.text
        profile_id = submitted.json()["application_id"]
        assert client.post("/auth/driver-applications", json=application).status_code == 409
        assert client.post("/auth/driver-applications", json={**application, "phone": "123"}).status_code == 422

        driver_credentials = {"username": "driver@example.test", "password": application["password"]}
        assert client.post("/auth/driver-login", data=driver_credentials).status_code == 403
        admin_token = client.post("/auth/login", data={"username": "admin@example.test", "password": "safe-test-password"}).json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        rows = client.get("/admin/driver-applications", headers=admin_headers).json()
        assert rows[0]["id"] == profile_id
        assert rows[0]["status"] == "Pending"
        assert rows[0]["license_number"] == "LICENSE-123"
        assert client.patch(f"/admin/driver-applications/{profile_id}/status", json={"status": "approved"}).status_code == 401
        assert client.get("/admin/drivers", headers=admin_headers).json() == []
        assert client.patch(f"/admin/driver-applications/{profile_id}/status", headers=admin_headers, json={"status": "approved"}).status_code == 200
        approved_drivers = client.get("/admin/drivers", headers=admin_headers).json()
        assert len(approved_drivers) == 1
        assert approved_drivers[0]["full_name"] == "Test Driver"
        assert approved_drivers[0]["verification_status"] == "Approved"
        assert approved_drivers[0]["status"] == "Active"

        signed_in = client.post("/auth/driver-login", data=driver_credentials)
        assert signed_in.status_code == 200, signed_in.text
        assert client.post("/auth/driver-login", data={**driver_credentials, "username": "0770 123 4567"}).status_code == 200
        driver_headers = {"Authorization": f"Bearer {signed_in.json()['access_token']}"}
        assert client.get("/auth/driver-me", headers=driver_headers).json()["name"] == "Test Driver"
        assert client.get("/admin/driver-applications", headers=driver_headers).status_code == 401
        assert client.post("/auth/driver-login", data={**driver_credentials, "password": "wrong"}).status_code == 401

        assert client.patch(f"/admin/driver-applications/{profile_id}/status", headers=admin_headers, json={"status": "rejected", "notes": "Invalid details"}).status_code == 200
        rejected = client.post("/auth/driver-login", data=driver_credentials)
        assert rejected.status_code == 403
        assert "Invalid details" in rejected.json()["detail"]
        assert client.get("/admin/driver-applications", headers=admin_headers).json()[0]["rejection_reason"] == "Invalid details"
        assert client.get("/auth/driver-me", headers=driver_headers).status_code == 401
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
