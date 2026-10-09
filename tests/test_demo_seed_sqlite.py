"""Isolated fixture-invariant test; never connects to Neon."""

import os
from collections import Counter
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from src.admin.models import (ApplicationStatus, Driver_Profile, Report, RideRequest,
                              RideRequestStatus, Route, RouteDemand, RouteStudents,
                              Status, StudentProfile, University, Area, User, UserRole)
from tools.seed_development_demo import AREA_KEYS, COUNTS, UNIVERSITY_KEYS, seed


def test_seed_uses_canonical_ids_and_preserves_approval_and_seat_invariants():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        area_rows = [Area(Area_name=name, city=city) for name, city in AREA_KEYS]
        university_rows = [University(University_name=name, governorate=city)
                           for name, city in UNIVERSITY_KEYS]
        session.add_all(area_rows + university_rows)
        session.commit()
        areas = {(row.Area_name, row.city): row.id for row in area_rows}
        universities = {(row.University_name, row.governorate): row.id for row in university_rows}
        with patch("src.admin.security.get_password_hash", return_value="isolated-test-hash"):
            seed(session, areas, universities,
                 {"Admin": "test-password-only", "Driver": "test-password-only",
                  "Student": "test-password-only"})
        session.commit()
        tables = {"user": User, "driver_profile": Driver_Profile, "student_profile": StudentProfile,
                  "route": Route, "ride_request": RideRequest, "routestudents": RouteStudents,
                  "report": Report, "routedemand": RouteDemand}
        assert {key: len(session.exec(select(model)).all()) for key, model in tables.items()} == COUNTS
        users = session.exec(select(User)).all()
        assert Counter(user.role for user in users) == {
            UserRole.ADMIN: 1, UserRole.DRIVER: 5, UserRole.STUDENT: 12
        }
        profiles = session.exec(select(Driver_Profile)).all()
        assert Counter(profile.verification_status for profile in profiles) == {
            ApplicationStatus.APPROVED: 4, ApplicationStatus.PENDING: 1
        }
        assert sum(user.status == Status.SUSPENDED for user in users) == 1
        requests = session.exec(select(RideRequest)).all()
        assert Counter(request.status for request in requests) == {
            RideRequestStatus.PENDING: 3, RideRequestStatus.ACCEPTED: 2,
            RideRequestStatus.DECLINED: 2
        }
        enrollments = session.exec(select(RouteStudents)).all()
        assert {(row.student_id, row.route_id) for row in enrollments} == {
            (row.student_id, row.route_id) for row in requests if row.status == RideRequestStatus.ACCEPTED
        }
        routes = session.exec(select(Route)).all()
        assert all(sum(row.route_id == route.id for row in enrollments) <= route.capacity for route in routes)
        demands = session.exec(select(RouteDemand)).all()
        assert all((row.from_area_id, row.to_university_id) not in
                   {(route.from_area_id, route.to_university_id) for route in routes} for row in demands)
    engine.dispose()
