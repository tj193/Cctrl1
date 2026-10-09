"""Fail-closed read-only preview of the verified Neon development branch.

Reads only .env.development through the existing endpoint validator. No DDL,
DML, Alembic command, personal data, or connection URL is printed.
"""

import json
import sys
import unicodedata
from pathlib import Path

from sqlalchemy import create_engine, text


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from migrations.database import VERIFIED_ENDPOINT_ID, direct_development_url  # noqa: E402


TABLES = (
    "user", "driver_profile", "student_profile", "area", "university",
    "route", "ride_request", "routestudents", "report", "routedemand",
    "playing_with_neon",
)


def match_key(value: str) -> str:
    """Conservative comparison only; preserve the source spelling for display."""
    return " ".join(unicodedata.normalize("NFC", value).split()).casefold()


def candidate_comparison(rows: list[tuple[str, str]], candidates: list[dict]) -> dict:
    by_key: dict[str, list[tuple[str, str]]] = {}
    for name, governorate in rows:
        by_key.setdefault(match_key(name), []).append((name, governorate or ""))
    result = {"candidate_count": len(candidates), "exact_existing": 0,
              "candidate_inserts": 0, "manual_conflicts": []}
    seen = set()
    for item in candidates:
        name, governorate = item["name_ar"], item["governorate_ar"]
        key = match_key(name)
        if key in seen:
            result["manual_conflicts"].append({"name": name, "reason": "duplicate candidate"})
            continue
        seen.add(key)
        matches = by_key.get(key, [])
        if not matches:
            result["candidate_inserts"] += 1
        elif len(matches) == 1 and matches[0] == (name, governorate):
            result["exact_existing"] += 1
        else:
            result["manual_conflicts"].append({"name": name, "reason": "existing spelling or governorate differs"})
    return result


def main() -> int:
    manifest = json.loads((ROOT / "data/reference/iraq_universities_candidates.json").read_text(encoding="utf-8"))
    url = direct_development_url()
    engine = create_engine(url, pool_pre_ping=True,
                           connect_args={"options": "-c default_transaction_read_only=on"})
    try:
        with engine.connect() as connection:
            if connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
                raise RuntimeError("Connection is not read-only")
            revisions = connection.execute(text("SELECT version_num FROM public.alembic_version")).scalars().all()
            if revisions != ["20261009_0006"]:
                raise RuntimeError("Development revision is not exactly 20261009_0006")
            reason_nullable = connection.execute(text(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='report' AND column_name='reason'"
            )).scalar_one()
            if reason_nullable != "YES":
                raise RuntimeError("report.reason does not match revision 0006")
            counts = {}
            for table in TABLES:
                # Fixed, audited table names only; no untrusted SQL identifiers.
                counts[table] = connection.execute(text(f'SELECT count(*) FROM public."{table}"')).scalar_one()
            universities = connection.execute(text(
                'SELECT "University_name", governorate FROM public.university'
            )).all()
            comparison = candidate_comparison(universities, manifest["universities"])
        print(json.dumps({"verified_endpoint_id": VERIFIED_ENDPOINT_ID,
                          "connection": "read_only_success", "revision": revisions[0],
                          "report_reason_nullable": True, "table_counts": counts,
                          "university_preview": comparison,
                          "area_candidates": 0, "neon_writes": 0},
                         ensure_ascii=False, indent=2))
        return 0
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # Do not print driver exceptions: they can embed the connection URL.
        print(f"Read-only preview stopped: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
