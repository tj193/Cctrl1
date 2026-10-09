"""Preview the checked-in frontend catalogue; guarded development import.

Default operation is offline and read-only. --development compares with the
verified Neon development endpoint. --apply requires separate approval and a
fresh snapshot acknowledgement; it is never invoked by this preparation task.
"""

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def catalogue() -> tuple[list[dict], list[dict]]:
    text = (ROOT / "js/data/iraq-catalogue.js").read_text(encoding="utf-8-sig").strip()
    prefix = "window.IraqCatalogue = "
    if not text.startswith(prefix) or not text.endswith(";"):
        raise ValueError("Unexpected frontend catalogue format")
    data = json.loads(text[len(prefix):-1])
    governors, universities = data["governorates"], data["universities"]
    source = json.loads((ROOT / "reference-data/universities-source.json").read_text(encoding="utf-8"))
    if universities != source["universities"]:
        raise ValueError("Generated and source university catalogues differ")
    keys = [row["id"] for row in governors]
    names = [row["arabic"] for row in governors]
    if len(governors) != 19 or len(set(keys)) != len(keys) or len(set(names)) != len(names):
        raise ValueError("Invalid governorate catalogue")
    if any(not row["areas"] or len(row["areas"]) != len(set(row["areas"]))
           or any(not name.strip() for name in row["areas"]) for row in governors):
        raise ValueError("Empty or duplicate area within a governorate")
    if any(row["governorate"] not in keys or row["type"] not in {"public", "private"}
           or not row["name"].strip() for row in universities):
        raise ValueError("Invalid university association or name")
    university_names = [row["name"] for row in universities]
    if len(set(university_names)) != len(university_names):
        raise ValueError("University names collide with global database uniqueness")
    return governors, universities


def desired_rows(governors: list[dict], universities: list[dict]) -> tuple[list[tuple], list[tuple]]:
    names = {row["id"]: row["arabic"] for row in governors}
    areas = [(area, row["arabic"]) for row in governors for area in row["areas"]]
    institutions = [(row["name"], names[row["governorate"]]) for row in universities]
    return areas, institutions


def compare(areas: list[tuple], institutions: list[tuple], existing_areas: list[tuple],
            existing_universities: list[tuple]) -> dict:
    area_map = Counter(existing_areas)
    uni_by_name = {}
    for name, governorate in existing_universities:
        uni_by_name.setdefault(name, []).append(governorate)
    area_inserts = [row for row in areas if row not in area_map]
    university_inserts = [row for row in institutions if row[0] not in uni_by_name]
    conflicts = [name for name, governorate in institutions
                 if name in uni_by_name and uni_by_name[name] != [governorate]]
    duplicate_areas = [f"area:{name}:{city}" for (name, city), count in area_map.items() if count > 1]
    duplicate_universities = [name for name, rows in uni_by_name.items() if len(rows) > 1]
    conflicts += duplicate_areas + duplicate_universities
    return {"proposed_area_inserts": len(area_inserts),
            "proposed_university_inserts": len(university_inserts),
            "matched_areas": len(areas) - len(area_inserts),
            "matched_universities": len(institutions) - len(university_inserts),
            "duplicate_existing_areas": sorted(duplicate_areas),
            "duplicate_existing_universities": sorted(duplicate_universities),
            "conflicts": sorted(set(conflicts)), "area_rows": area_inserts,
            "university_rows": university_inserts}


def development_preview(areas: list[tuple], institutions: list[tuple], apply: bool,
                        approved_count: str | None) -> dict:
    from sqlalchemy import create_engine, text
    from migrations.database import direct_development_url

    # No process DATABASE_URL, .env, or URL argument is accepted here.
    engine = create_engine(direct_development_url(), pool_pre_ping=True,
                           connect_args={} if apply else {"options": "-c default_transaction_read_only=on"})
    try:
        with engine.begin() as connection:
            if not apply and connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
                raise RuntimeError("Read-only transaction was not established")
            if apply:
                connection.execute(text("SELECT pg_advisory_xact_lock(20261009, 7)"))
            revision = connection.execute(text("SELECT version_num FROM public.alembic_version")).scalars().all()
            if apply and revision != ["20261009_0006"]:
                raise RuntimeError("Development revision differs from approved preview baseline")
            existing_areas = connection.execute(text('SELECT "Area_name", city FROM public.area')).all()
            existing_universities = connection.execute(text(
                'SELECT "University_name", governorate FROM public.university')).all()
            result = compare(areas, institutions, existing_areas, existing_universities)
            if apply and result["conflicts"]:
                raise RuntimeError("Existing catalogue rows conflict; manual review required")
            if apply:
                count = f'{result["proposed_area_inserts"]}:{result["proposed_university_inserts"]}'
                if approved_count != count:
                    raise RuntimeError("Approved insert counts do not match current database")
                for name, city in result["area_rows"]:
                    connection.execute(text('INSERT INTO public.area ("Area_name", city, status, created_at) '
                                            'VALUES (:name, :city, :status, now())'),
                                       {"name": name, "city": city, "status": "ACTIVE"})
                for name, governorate in result["university_rows"]:
                    connection.execute(text('INSERT INTO public.university '
                                            '("University_name", governorate, status, created_at) '
                                            'VALUES (:name, :governorate, :status, now())'),
                                       {"name": name, "governorate": governorate, "status": "ACTIVE"})
            result.pop("area_rows")
            result.pop("university_rows")
            result["revision"] = revision
            result["existing_area_count"] = len(existing_areas)
            result["existing_university_count"] = len(existing_universities)
            result["catalogue_compatible"] = revision == ["20261009_0006"] and not result["conflicts"]
            result["write_ready"] = apply
            result["mode"] = "transactional_apply" if apply else "development_read_only"
            return result
    finally:
        engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--development", action="store_true", help="Read-only comparison to verified development")
    parser.add_argument("--apply", action="store_true", help="Separate approved transaction only")
    parser.add_argument("--approved-count", help="Approved area:university insert counts")
    args = parser.parse_args()
    if args.apply and (not args.development or os.getenv("DARBGO_CATALOGUE_WRITE_APPROVED") != "20261009_0006"
                       or not os.getenv("DARBGO_DEVELOPMENT_SNAPSHOT_ID") or not args.approved_count):
        raise RuntimeError("Write approval, snapshot ID, approved counts and development flag required")
    governors, universities = catalogue()
    areas, institutions = desired_rows(governors, universities)
    result = {"mode": "offline_dry_run", "governorates": len(governors),
              "source_area_rows": len(areas), "source_university_rows": len(institutions),
              "per_governorate": {row["id"]: {"areas": len(row["areas"]),
                                   "universities": sum(u["governorate"] == row["id"] for u in universities)}
                                  for row in governors},
              "proposed_inserts_if_target_empty": {"areas": len(areas), "universities": len(institutions)}}
    if args.development:
        development = development_preview(areas, institutions, args.apply, args.approved_count)
        result["mode"] = development["mode"]
        result["development"] = development
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # SQLAlchemy exceptions can contain URL details; print only the error class.
        print(f"Catalogue import stopped: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
