"""Preview deterministic DarbGo fixtures; guarded one-transaction development seed.

No write occurs by default. For approved writes, generated test passwords stay
in an ignored local file and are never printed.
"""

import argparse
import json
import os
import secrets
import sys
from datetime import datetime, time, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.phase43_synthetic_plan import build_plan

REVISION = "20261009_0006"
AREA_KEYS = [("الكرادة", "بغداد"), ("المنصور", "بغداد"), ("العشار", "البصرة"),
             ("عنكاوا", "أربيل"), ("الأعظمية", "بغداد"), ("المعقل", "البصرة"),
             ("بختياري", "أربيل")]
UNIVERSITY_KEYS = [("جامعة بغداد", "بغداد"), ("الجامعة المستنصرية", "بغداد"),
                   ("جامعة البصرة", "البصرة"), ("جامعة صلاح الدين", "أربيل")]
COUNTS = {"user": 18, "driver_profile": 5, "student_profile": 12, "route": 4,
          "ride_request": 7, "routestudents": 2, "report": 3, "routedemand": 3}
CREDENTIALS_FILE = ROOT / ".artifacts" / "demo-credentials.json"


def local_demo_secrets() -> dict[str, str]:
    """Keep generated test passwords out of source, output, and Git."""
    CREDENTIALS_FILE.parent.mkdir(exist_ok=True)
    if CREDENTIALS_FILE.exists():
        values = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
    else:
        values = {role: secrets.token_urlsafe(24) for role in ("Admin", "Driver", "Student")}
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
        with os.fdopen(os.open(CREDENTIALS_FILE, flags, 0o600), "w", encoding="utf-8") as output:
            json.dump(values, output)
    if set(values) != {"Admin", "Driver", "Student"} or any(
        not isinstance(value, str) or len(value) < 12 for value in values.values()
    ):
        raise RuntimeError("Local demo credentials are incomplete")
    return values


def accounts() -> list[dict]:
    return build_plan()["accounts"]


def preview(session) -> tuple[dict, dict, dict]:
    from sqlalchemy import text

    revision = session.execute(text("SELECT version_num FROM public.alembic_version")).scalars().all()
    if revision != [REVISION]:
        raise RuntimeError("Unexpected development revision")
    area_rows = session.execute(text('SELECT id, "Area_name", city FROM public.area')).all()
    uni_rows = session.execute(text('SELECT id, "University_name", governorate FROM public.university')).all()
    areas = {(name, city): id_ for id_, name, city in area_rows}
    universities = {(name, city): id_ for id_, name, city in uni_rows}
    if any(sum((name, city) == key for _, name, city in area_rows) != 1 for key in AREA_KEYS):
        raise RuntimeError("Fixture area is missing or ambiguous")
    if any(sum((name, city) == key for _, name, city in uni_rows) != 1 for key in UNIVERSITY_KEYS):
        raise RuntimeError("Fixture university is missing or ambiguous")
    emails = [row["email"] for row in accounts()]
    existing = session.execute(text('SELECT email FROM public."user" WHERE email = ANY(:emails)'),
                               {"emails": emails}).scalars().all()
    admin_count = session.execute(text("SELECT count(*) FROM public.\"user\" WHERE role = 'ADMIN'" )).scalar_one()
    if not existing and admin_count:
        raise RuntimeError("An Admin account already exists; cannot add another")
    if existing and sorted(existing) != sorted(emails):
        raise RuntimeError("Partial synthetic account set; manual review required")
    existing_counts = {}
    if existing:
        from sqlmodel import select
        from src.admin.models import (Driver_Profile, Report, RideRequest, Route, RouteDemand,
                                      RouteStudents, StudentProfile, User)
        user_rows = session.exec(select(User).where(User.email.in_(emails))).all()
        ids = {user.id for user in user_rows}
        route_ids = {route.id for route in session.exec(select(Route).where(Route.driver_id.in_(ids))).all()}
        existing_counts = {
            "user": len(user_rows),
            "driver_profile": len(session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id.in_(ids))).all()),
            "student_profile": len(session.exec(select(StudentProfile).where(StudentProfile.user_id.in_(ids))).all()),
            "route": len(route_ids),
            "ride_request": len(session.exec(select(RideRequest).where(RideRequest.student_id.in_(ids))).all()),
            "routestudents": len(session.exec(select(RouteStudents).where(RouteStudents.route_id.in_(route_ids))).all()),
            "report": len(session.exec(select(Report).where(Report.report_id.in_(ids))).all()),
            "routedemand": len(session.exec(select(RouteDemand).where(RouteDemand.student_id.in_(ids))).all()),
        }
        if existing_counts != COUNTS or admin_count != 1:
            raise RuntimeError("Synthetic records differ from the complete fixture; manual review required")
    return ({"revision": revision[0], "existing_fixture_counts": existing_counts,
             "proposed_inserts": {key: 0 if existing else value for key, value in COUNTS.items()},
             "proposed_updates": 0, "proposed_deletes": 0,
             "existing_admin_count": admin_count}, areas, universities)


def seed(session, areas: dict, universities: dict, secrets: dict) -> None:
    from sqlmodel import select
    from src.admin.models import (ApplicationStatus, Driver_Profile, Report, ReportStatus,
                                  RideRequest, RideRequestStatus, Route, RouteDemand,
                                  RouteStudentStatus, RouteStudents, Status, StudentProfile,
                                  User, UserRole)
    from src.admin.security import get_password_hash

    names = {"Admin": "DarbGo Demo Admin", "Driver": "Demo Driver", "Student": "Demo Student"}
    users = {}
    for row in accounts():
        role = UserRole(row["role"])
        number = row["key"].rsplit("-", 1)[-1]
        name = names[row["role"]] if role == UserRole.ADMIN else f'{names[row["role"]]} {number}'
        user = User(name=name, email=row["email"],
                    password_hash=get_password_hash(secrets[row["role"]]), role=role,
                    status=Status(row["status"]))
        if role == UserRole.DRIVER and row["approval"] == "Pending":
            user.status = Status.PENDING
        session.add(user)
        session.flush()
        users[row["key"]] = user
        if role == UserRole.DRIVER:
            index = int(number)
            profile = Driver_Profile(
                Driver_id=user.id, phone_number=f'DEMO-NO-CALL-{index:02d}',
                vehicle_name="Demo minibus", vehicle_model=f"Fictional model {index}",
                vehicle_plate=f"DEMO-PLATE-{index:02d}",
                license_number=f"DEMO-LICENSE-{index:02d}", national_id=f"DEMO-ID-{index:02d}",
                vehicle_photo_url="", license_photo_url="", id_photo_url="",
                verification_status=ApplicationStatus.PENDING if index == 4 else ApplicationStatus.APPROVED,
                reviewed_by=None if index == 4 else users["phase43-admin-01"].id,
                reviewed_at=None if index == 4 else datetime.now(timezone.utc),
            )
            session.add(profile)
        if role == UserRole.STUDENT:
            index = int(number)
            area_key = AREA_KEYS[(index - 1) % 4]
            uni_key = UNIVERSITY_KEYS[(index - 1) % 4]
            session.add(StudentProfile(user_id=user.id, area_id=areas[area_key],
                                       university_id=universities[uni_key],
                                       preferred_arrival_time=time(8, 0)))
    route_specs = [
        (1, AREA_KEYS[0], UNIVERSITY_KEYS[0], 2, 45000),
        (1, AREA_KEYS[1], UNIVERSITY_KEYS[1], 8, 42000),
        (2, AREA_KEYS[2], UNIVERSITY_KEYS[2], 10, 50000),
        (3, AREA_KEYS[3], UNIVERSITY_KEYS[3], 12, 55000),
    ]
    routes = []
    for index, (driver, area, university, capacity, price) in enumerate(route_specs, 1):
        route = Route(driver_id=users[f"phase43-driver-{driver:02d}"].id,
                      from_area_id=areas[area], to_university_id=universities[university],
                      capacity=capacity, departure_time=time(7, 0 + index * 5),
                      return_time=time(15, 0 + index * 5), price_iqd=price,
                      notes=f"Fictional development route {index}")
        session.add(route)
        session.flush()
        routes.append(route)
    decisions = [(1, 0, RideRequestStatus.ACCEPTED), (2, 0, RideRequestStatus.ACCEPTED),
                 (3, 1, RideRequestStatus.PENDING), (4, 2, RideRequestStatus.PENDING),
                 (5, 3, RideRequestStatus.PENDING), (6, 1, RideRequestStatus.DECLINED),
                 (7, 2, RideRequestStatus.DECLINED)]
    for student, route_index, status in decisions:
        request = RideRequest(student_id=users[f"phase43-student-{student:02d}"].id,
                              route_id=routes[route_index].id, status=status)
        if status != RideRequestStatus.PENDING:
            driver_id = routes[route_index].driver_id
            request.decided_by = driver_id
            request.decided_at = datetime.now(timezone.utc)
            request.version = 2
        session.add(request)
        if status == RideRequestStatus.ACCEPTED:
            session.add(RouteStudents(student_id=request.student_id, route_id=request.route_id,
                                      status=RouteStudentStatus.ACTIVE))
    for index, student in enumerate((1, 8, 9), 1):
        report = Report(report_id=users[f"phase43-student-{student:02d}"].id,
                        type="service", subject=f"Fictional support report {index}",
                        description="Synthetic development report for workflow verification only.",
                        related_route_id=routes[0].id if student == 1 else None,
                        status=ReportStatus.RESOLVED if index == 1 else ReportStatus.PENDING)
        if index == 1:
            report.public_resolution = "This fictional report was reviewed in development."
            report.internal_notes = "Development-only Admin note."
            report.resolved_by = users["phase43-admin-01"].id
            report.resolved_at = datetime.now(timezone.utc)
            report.updated_at = report.resolved_at
        session.add(report)
    demands = [(10, AREA_KEYS[4], UNIVERSITY_KEYS[2]),
               (11, AREA_KEYS[5], UNIVERSITY_KEYS[0]),
               (12, AREA_KEYS[6], UNIVERSITY_KEYS[0])]
    used_routes = {(route.from_area_id, route.to_university_id) for route in routes}
    for student, area, university in demands:
        pair = (areas[area], universities[university])
        if pair in used_routes:
            raise RuntimeError("Synthetic demand has a matching route")
        session.add(RouteDemand(student_id=users[f"phase43-student-{student:02d}"].id,
                                from_area_id=pair[0], to_university_id=pair[1]))
    session.flush()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--development", action="store_true", help="Read-only comparison")
    parser.add_argument("--apply", action="store_true", help="Separately approved write transaction")
    args = parser.parse_args()
    if args.apply and (not args.development or os.getenv("DARBGO_DEMO_WRITE_APPROVED") != REVISION
                       or not os.getenv("DARBGO_DEVELOPMENT_SNAPSHOT_ID")):
        raise RuntimeError("Separate write approval and current snapshot are required")
    result = {"mode": "offline_plan", "planned_inserts_if_empty": COUNTS,
              "total_planned_inserts_if_empty": sum(COUNTS.values()),
              "catalogue_keys": {"areas": AREA_KEYS, "universities": UNIVERSITY_KEYS}}
    if args.development:
        from sqlalchemy import create_engine, text
        from sqlmodel import Session
        from migrations.database import direct_development_url

        development_url = direct_development_url()
        # Model imports also load DataBase.engine; pin that import to the same
        # verified development URL instead of inheriting .env or a shell URL.
        os.environ["DATABASE_URL"] = development_url.render_as_string(hide_password=False)
        engine = create_engine(development_url, pool_pre_ping=True,
                               connect_args={} if args.apply else {"options": "-c default_transaction_read_only=on"})
        try:
            with engine.begin() as connection:
                session = Session(bind=connection)
                if args.apply:
                    connection.execute(text("SELECT pg_advisory_xact_lock(20261009, 8)"))
                elif connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
                    raise RuntimeError("Read-only transaction was not established")
                details, areas, universities = preview(session)
                result.update(details)
                result["mode"] = "development_read_only" if not args.apply else "transactional_apply"
                if args.apply and details["proposed_inserts"] != {key: 0 for key in COUNTS}:
                    seed(session, areas, universities, local_demo_secrets())
                    session.flush()
        finally:
            engine.dispose()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        detail = str(exc)
        if any(marker in detail.lower() for marker in ("postgresql", "password", "@", "host=")):
            detail = "RuntimeError"
        print(f"Synthetic plan stopped: {detail}", file=sys.stderr)
        raise SystemExit(1) from None
    except Exception as exc:
        # Never print DB exceptions: SQLAlchemy diagnostics may contain secrets.
        print(f"Synthetic plan stopped: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
