"""Cross-role API smoke scenario in isolated SQLite; no Neon connection."""

import os
import secrets

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from src.admin.DataBase import get_session
from src.admin.main import app
from src.admin.models import Area, University, User, UserRole
from src.admin.security import get_password_hash


def test_local_student_driver_admin_scenario():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    password = secrets.token_urlsafe(20)
    with Session(engine) as session:
        session.add_all([
            User(name="Fictional Admin", email="scenario-admin@example.test",
                 password_hash=get_password_hash(password), role=UserRole.ADMIN),
            Area(Area_name="الكرادة", city="بغداد"),
            Area(Area_name="المنصور", city="بغداد"),
            University(University_name="جامعة بغداد", governorate="بغداد"),
        ])
        session.commit()

    def sessions():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = sessions
    try:
        with TestClient(app) as client:
            area_rows = client.get("/public/catalogue/areas").json()
            area_id = next(row["id"] for row in area_rows if row["name"] == "الكرادة")
            unmatched_area_id = next(row["id"] for row in area_rows if row["name"] == "المنصور")
            university_id = client.get("/public/catalogue/universities").json()[0]["id"]
            student = client.post("/auth/student-register", json={
                "full_name": "Fictional Student", "email": "scenario-student@example.test",
                "password": password, "area_id": area_id, "university_id": university_id,
            })
            assert student.status_code == 201, student.text
            student_login = client.post("/auth/student-login", data={
                "username": "scenario-student@example.test", "password": password,
            })
            assert student_login.status_code == 200
            student_auth = {"Authorization": f"Bearer {student_login.json()['access_token']}"}
            assert client.get("/student/routes").status_code == 401
            assert client.get("/admin/routes", headers=student_auth).status_code == 401
            second_student = client.post("/auth/student-register", json={
                "full_name": "Second Fictional Student", "email": "scenario-student-2@example.test",
                "password": password, "area_id": area_id, "university_id": university_id,
            })
            assert second_student.status_code == 201, second_student.text
            second_login = client.post("/auth/student-login", data={
                "username": "scenario-student-2@example.test", "password": password,
            })
            assert second_login.status_code == 200
            second_auth = {"Authorization": f"Bearer {second_login.json()['access_token']}"}
            driver_application = client.post("/auth/driver-register", json={
                "full_name": "Fictional Driver", "email": "scenario-driver@example.test",
                "phone": "+9647000000001", "password": password,
                "vehicle_type": "Fictional minibus", "vehicle_model": "Demo model",
                "plate_number": "DEMO-PLATE", "license_number": "DEMO-LICENSE",
                "national_id": "DEMO-ID",
            })
            assert driver_application.status_code == 201, driver_application.text
            assert client.post("/auth/driver-login", data={
                "username": "scenario-driver@example.test", "password": password,
            }).status_code == 403
            admin_login = client.post("/auth/login", data={
                "username": "scenario-admin@example.test", "password": password,
            })
            assert admin_login.status_code == 200, admin_login.text
            admin_auth = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
            approved = client.patch(
                f"/admin/driver-applications/{driver_application.json()['application_id']}/status",
                json={"status": "approved", "notes": ""}, headers=admin_auth,
            )
            assert approved.status_code == 200, approved.text
            driver_login = client.post("/auth/driver-login", data={
                "username": "scenario-driver@example.test", "password": password,
            })
            assert driver_login.status_code == 200, driver_login.text
            driver_auth = {"Authorization": f"Bearer {driver_login.json()['access_token']}"}
            route = client.post("/driver/routes", json={
                "from_area_id": area_id, "to_university_id": university_id,
                "capacity": 1, "departure_time": "07:30:00", "return_time": "15:30:00",
                "price_iqd": 45000,
            }, headers=driver_auth)
            assert route.status_code == 201, route.text
            route_id = route.json()["id"]
            search = client.get(f"/student/routes?from_area_id={area_id}&to_university_id={university_id}",
                                headers=student_auth)
            assert search.status_code == 200 and any(row["id"] == route_id for row in search.json())
            request = client.post("/student/ride-requests", json={"route_id": route_id}, headers=student_auth)
            assert request.status_code == 201, request.text
            assert client.post("/student/ride-requests", json={"route_id": route_id},
                               headers=student_auth).status_code == 409
            second_request = client.post("/student/ride-requests", json={"route_id": route_id},
                                         headers=second_auth)
            assert second_request.status_code == 201, second_request.text
            assert client.get(f"/student/routes/{route_id}", headers=student_auth).json()["available_seats"] == 1
            assert {row["id"] for row in client.get("/driver/ride-requests", headers=driver_auth).json()} == {
                request.json()["id"], second_request.json()["id"]
            }
            decision = client.post(f"/driver/ride-requests/{request.json()['id']}/accept", headers=driver_auth)
            assert decision.status_code == 200, decision.text
            assert client.get("/student/ride-requests", headers=student_auth).json()[0]["status"] == "Accepted"
            assert client.get(f"/student/routes/{route_id}", headers=student_auth).json()["available_seats"] == 0
            assert client.post(f"/driver/ride-requests/{second_request.json()['id']}/accept",
                               headers=driver_auth).status_code == 409
            assert client.get("/student/ride-requests", headers=second_auth).json()[0]["status"] == "Pending"
            assert client.post("/student/ride-requests", json={"route_id": route_id},
                               headers=second_auth).status_code == 409
            assert client.get(f"/driver/routes/{route_id}/enrollments", headers=driver_auth).json()["occupied_seats"] == 1
            assert client.get("/admin/routes", headers=admin_auth).json()[0]["occupied_seats"] == 1
            report = client.post("/student/reports", json={
                "type": "service", "subject": "Fictional service report",
                "description": "Synthetic report for an isolated cross-role API test.",
            }, headers=student_auth)
            assert report.status_code == 201, report.text
            review = client.patch(f"/admin/reports/{report.json()['id']}/review", json={
                "status": "Resolved", "public_resolution": "Fictional public response",
                "internal_notes": "Fictional private Admin note",
            }, headers=admin_auth)
            assert review.status_code == 200, review.text
            own_report = client.get(f"/student/reports/{report.json()['id']}", headers=student_auth).json()
            assert own_report["public_resolution"] == "Fictional public response"
            assert "internal_notes" not in own_report
            assert client.get(f"/student/reports/{report.json()['id']}",
                              headers=second_auth).status_code == 404
            demand = client.post("/student/route-demand", json={
                "from_area_id": unmatched_area_id, "to_university_id": university_id,
            }, headers=student_auth)
            assert demand.status_code == 201, demand.text
            assert client.get("/admin/route-demand", headers=admin_auth).status_code == 200
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
