"""Optional concurrency test: only an explicitly configured local test_ PostgreSQL DB."""

import hashlib
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "local-test-secret-with-more-than-32-characters"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlmodel import Session, SQLModel, select

from src.admin.DataBase import get_session
from src.admin.main import app
from src.admin.models import (ApplicationStatus, Area, Driver_Profile, RideRequest,
                              Route, RouteStudents, University, User, UserRole)
from src.admin.security import create_access_token, get_password_hash


def local_postgres_url():
    value = os.getenv("TEST_POSTGRES_URL", "")
    if not value:
        pytest.skip("TEST_POSTGRES_URL is not configured; PostgreSQL concurrency NOT TESTED")
    url = make_url(value)
    if (url.drivername != "postgresql+psycopg" or
            url.host not in {"localhost", "127.0.0.1", "::1"} or
            not url.database or not url.database.startswith("test_")):
        pytest.fail("TEST_POSTGRES_URL must target a local postgresql+psycopg test_ database")
    return url


def token(user: User):
    jwt_token = create_access_token({"sub": str(user.id), "role": user.role.value,
                                     "pwd": hashlib.sha256(user.password_hash.encode()).hexdigest()})
    return {"Authorization": f"Bearer {jwt_token}"}


def test_two_students_compete_for_final_seat():
    url = local_postgres_url()
    schema = f"phase42_{uuid.uuid4().hex}"
    admin_engine = create_engine(url, pool_pre_ping=True)
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url, pool_pre_ping=True,
                               connect_args={"options": f"-csearch_path={schema}"})
        try:
            SQLModel.metadata.create_all(engine)
            with Session(engine) as session:
                driver = User(name="Driver", email="driver@phase42.test",
                              password_hash=get_password_hash("safe-test-password"), role=UserRole.DRIVER)
                students = [User(name=f"Student {i}", email=f"student{i}@phase42.test",
                                 password_hash=get_password_hash("safe-test-password"), role=UserRole.STUDENT)
                            for i in range(2)]
                area = Area(Area_name="Origin", city="Test")
                university = University(University_name="Test University")
                session.add_all([driver, *students, area, university])
                session.commit()
                for item in [driver, *students, area, university]:
                    session.refresh(item)
                session.add(Driver_Profile(Driver_id=driver.id, phone_number="+9647700000001",
                                           vehicle_name="Car", vehicle_model="Model", vehicle_plate="P1",
                                           license_number="L1", national_id="N1", vehicle_photo_url="",
                                           license_photo_url="", id_photo_url="",
                                           verification_status=ApplicationStatus.APPROVED))
                route = Route(driver_id=driver.id, from_area_id=area.id,
                              to_university_id=university.id, capacity=1)
                session.add(route)
                session.commit()
                session.refresh(route)
                driver_headers = token(driver)
                student_headers = [token(student) for student in students]
                route_id = route.id

            def sessions():
                with Session(engine) as session:
                    yield session

            app.dependency_overrides[get_session] = sessions
            try:
                request_ids = []
                with TestClient(app) as client:
                    for headers in student_headers:
                        response = client.post("/student/ride-requests", headers=headers,
                                               json={"route_id": route_id})
                        assert response.status_code == 201, response.text
                        request_ids.append(response.json()["id"])
                barrier = Barrier(2)

                def accept(request_id):
                    with TestClient(app) as client:
                        barrier.wait(timeout=10)
                        return client.post(f"/driver/ride-requests/{request_id}/accept",
                                           headers=driver_headers).status_code

                with ThreadPoolExecutor(max_workers=2) as executor:
                    futures = [executor.submit(accept, request_id) for request_id in request_ids]
                    codes = [future.result(timeout=20) for future in futures]
                assert sorted(codes) == [200, 409]
                with Session(engine) as session:
                    assert len(session.exec(select(RouteStudents).where(
                        RouteStudents.route_id == route_id)).all()) == 1
                    assert len(session.exec(select(RideRequest).where(
                        RideRequest.route_id == route_id)).all()) == 2
            finally:
                app.dependency_overrides.clear()
        finally:
            engine.dispose()
    finally:
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()
