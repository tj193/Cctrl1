"""Read-only comparison of the local development and backup Neon endpoints."""

import hashlib
import json
import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from migrations.database import VERIFIED_ENDPOINT_ID, direct_development_url

EXPECTED_REVISION = "20261009_0006"
EXPECTED_TABLES = {
    "alembic_version", "area", "university", "user", "driver_profile",
    "student_profile", "route", "ride_request", "routestudents", "report",
    "routedemand", "playing_with_neon",
}


def backup_url():
    raw = (ROOT / ".env.backup").read_text(encoding="utf-8-sig").strip()
    if raw.startswith("DATABASE_URL="):
        raw = raw.partition("=")[2].strip().strip('"').strip("'")
    if "\n" in raw or "\r" in raw:
        raise RuntimeError("Backup URL file must contain one connection string")
    url = make_url(raw)
    host = (url.host or "").lower()
    endpoint = host.partition(".")[0].removesuffix("-pooler")
    if (url.drivername not in {"postgresql", "postgresql+psycopg"} or not host.endswith(".neon.tech")
            or not endpoint.startswith("ep-") or endpoint == VERIFIED_ENDPOINT_ID
            or url.query.get("sslmode") != "require" or not url.username
            or not url.password or not url.database):
        raise RuntimeError("Backup URL is not a distinct verified-format Neon endpoint")
    return url.set(drivername="postgresql+psycopg",
                   host=f"{endpoint}.{host.partition('.')[2]}"), endpoint


def inspect(url):
    engine = create_engine(url, pool_pre_ping=True,
                           connect_args={"options": "-c default_transaction_read_only=on"})
    try:
        with engine.connect() as connection:
            if connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
                raise RuntimeError("Read-only connection was not established")
            names = connection.execute(text("""
                SELECT tablename FROM pg_catalog.pg_tables
                WHERE schemaname = 'public' ORDER BY tablename
            """)).scalars().all()
            revision = connection.execute(text(
                "SELECT version_num FROM public.alembic_version"
            )).scalars().all()
            counts = {}
            for name in names:
                if not name.replace("_", "").isalnum():
                    raise RuntimeError("Unexpected table identifier")
                counts[name] = connection.execute(text(f'SELECT count(*) FROM public."{name}"')).scalar_one()
            schema_rows = connection.execute(text("""
                SELECT table_name, column_name, ordinal_position, data_type, udt_name,
                       is_nullable, column_default
                FROM information_schema.columns WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            """)).all()
            constraints = connection.execute(text("""
                SELECT c.conrelid::regclass::text, c.conname, c.contype,
                       pg_get_constraintdef(c.oid)
                FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
                WHERE n.nspname = 'public'
                ORDER BY 1, 2
            """)).all()
            indexes = connection.execute(text("""
                SELECT tablename, indexname, indexdef FROM pg_indexes
                WHERE schemaname = 'public' ORDER BY tablename, indexname
            """)).all()
            enums = connection.execute(text("""
                SELECT t.typname, e.enumlabel, e.enumsortorder
                FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder
            """)).all()
            fingerprint = hashlib.sha256(repr((schema_rows, constraints, indexes, enums)).encode()).hexdigest()
            return {"revision": revision, "tables": names, "counts": counts,
                    "schema_fingerprint": fingerprint,
                    "branch_setting": connection.execute(text(
                        "SELECT current_setting('neon.branch_id', true)"
                    )).scalar_one()}
    finally:
        engine.dispose()


def main():
    development = inspect(direct_development_url())
    backup_connection, backup_endpoint = backup_url()
    backup = inspect(backup_connection)
    checks = {
        "revision_0006": development["revision"] == backup["revision"] == [EXPECTED_REVISION],
        "expected_tables": EXPECTED_TABLES <= set(development["tables"]) and
                           EXPECTED_TABLES <= set(backup["tables"]),
        "table_names_match": development["tables"] == backup["tables"],
        "row_counts_match": development["counts"] == backup["counts"],
        "schema_match": development["schema_fingerprint"] == backup["schema_fingerprint"],
        "distinct_endpoint": backup_endpoint != VERIFIED_ENDPOINT_ID,
        "distinct_branch_id": bool(development["branch_setting"] and backup["branch_setting"])
                              and development["branch_setting"] != backup["branch_setting"],
    }
    result = {"checks": checks, "development_counts": development["counts"],
              "backup_counts": backup["counts"], "backup_endpoint_id": backup_endpoint,
              "backup_branch_id_available": bool(backup["branch_setting"]),
              "read_only": True, "comparison_passed": all(checks.values())}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["comparison_passed"] else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"Backup verification stopped: {error}", file=sys.stderr)
        raise SystemExit(1) from None
    except Exception as error:
        print(f"Backup verification stopped: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
