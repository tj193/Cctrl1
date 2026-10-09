"""Read-only post-smoke integrity check; never changes either Neon branch."""

import json
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from migrations.database import direct_development_url
from tools.verify_development_backup import backup_url, inspect

EXPECTED_DEV = {"alembic_version": 1, "area": 270, "university": 166,
                "user": 18, "driver_profile": 5, "student_profile": 12,
                "route": 4, "ride_request": 7, "routestudents": 3,
                "report": 3, "routedemand": 3, "playing_with_neon": 0}


def main():
    backup_connection, _ = backup_url()
    backup = inspect(backup_connection)
    development = inspect(direct_development_url())
    engine = create_engine(direct_development_url(),
                           connect_args={"options": "-c default_transaction_read_only=on"})
    try:
        with engine.connect() as connection:
            if connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
                raise RuntimeError("Read-only verification was not established")
            status_rows = dict(connection.execute(text("""
                SELECT status::text, count(*) FROM public.ride_request GROUP BY status::text
            """)).all())
            invalid_enrollments = connection.execute(text("""
                SELECT count(*) FROM public.routestudents e
                WHERE e.status::text = 'ACTIVE' AND NOT EXISTS (
                    SELECT 1 FROM public.ride_request r
                    WHERE r.student_id = e.student_id AND r.route_id = e.route_id
                    AND r.status::text = 'ACCEPTED')
            """)).scalar_one()
            missing_enrollments = connection.execute(text("""
                SELECT count(*) FROM public.ride_request r WHERE r.status::text = 'ACCEPTED'
                AND NOT EXISTS (SELECT 1 FROM public.routestudents e
                    WHERE e.student_id = r.student_id AND e.route_id = r.route_id
                    AND e.status::text = 'ACTIVE')
            """)).scalar_one()
            over_capacity = connection.execute(text("""
                SELECT count(*) FROM public.route r WHERE (
                    SELECT count(*) FROM public.routestudents e
                    WHERE e.route_id = r.id AND e.status::text = 'ACTIVE') > r.capacity
            """)).scalar_one()
            orphaned_profiles = connection.execute(text("""
                SELECT (SELECT count(*) FROM public.student_profile p
                        LEFT JOIN public."user" u ON u.id = p.user_id WHERE u.id IS NULL)
                     + (SELECT count(*) FROM public.driver_profile p
                        LEFT JOIN public."user" u ON u.id = p."Driver_id" WHERE u.id IS NULL)
            """)).scalar_one()
    finally:
        engine.dispose()
    checks = {
        "backup_unchanged": backup["revision"] == ["20261009_0006"] and
                            all(count == (1 if name == "alembic_version" else 0)
                                for name, count in backup["counts"].items()),
        "development_revision": development["revision"] == ["20261009_0006"],
        "development_counts": development["counts"] == EXPECTED_DEV,
        "schema_unchanged": development["schema_fingerprint"] == backup["schema_fingerprint"],
        "request_statuses": status_rows == {"PENDING": 2, "ACCEPTED": 3, "DECLINED": 2},
        "seat_integrity": not invalid_enrollments and not missing_enrollments and not over_capacity,
        "profile_relationships": not orphaned_profiles,
    }
    print(json.dumps({"checks": checks, "development_counts": development["counts"],
                      "request_statuses": status_rows, "read_only": True}, indent=2))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Post-smoke verification stopped: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
