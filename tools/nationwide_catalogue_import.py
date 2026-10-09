"""Fail-closed nationwide catalogue validation and dry run.

There is intentionally no write path while hierarchy and pickup coverage are
incomplete. A future transactional importer must pass the documented gates.
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from migrations.database import VERIFIED_ENDPOINT_ID, direct_development_url  # noqa: E402
from tools.phase43_readonly_preview import candidate_comparison, match_key  # noqa: E402


def load_manifests() -> tuple[dict, list[dict]]:
    base = ROOT / "data/reference"
    governorates = json.loads((base / "iraq_governorates_candidate.json").read_text(encoding="utf-8"))
    public = json.loads((base / "iraq_universities_candidates.json").read_text(encoding="utf-8"))
    private = json.loads((base / "iraq_private_institutions_candidates.json").read_text(encoding="utf-8"))
    institutions = [{**row, "kind": "public", "source_url": public["source_url"]}
                    for row in public["universities"]]
    institutions += [{**row, "source_url": private["source_url"]}
                     for row in private["institutions"]]
    return governorates, institutions


def validate(governorates: dict, institutions: list[dict]) -> dict:
    rows = governorates["governorates"]
    if len(rows) != 19 or sum(row["name_ar"] == "حلبجة" for row in rows) != 1:
        raise ValueError("Manifest must represent 19 governorates including Halabja")
    if len({row["catalogue_key"] for row in rows}) != 19:
        raise ValueError("Duplicate governorate catalogue keys")
    names = [match_key(row["name_ar"]) for row in rows]
    if len(set(names)) != 19:
        raise ValueError("Duplicate normalized governorate names")
    if any(row["source_ref"] not in governorates["sources"] for row in rows):
        raise ValueError("Unattributed governorate")
    canonical_keys = {row["catalogue_key"] for row in rows}
    alias_names = [match_key(row["name_ar"]) for row in governorates["aliases"]]
    if (len(alias_names) != len(set(alias_names)) or
            any(row["canonical_key"] not in canonical_keys or row["use"] != "matching_only"
                or not row["source_url"] for row in governorates["aliases"])):
        raise ValueError("Invalid governorate alias")
    if governorates["locations"]:
        raise ValueError("Subdivision import requires separate source validation")
    valid_governorates = set(names)
    institution_names = [match_key(row["name_ar"]) for row in institutions]
    if len(institution_names) != len(set(institution_names)):
        raise ValueError("Duplicate normalized institution names")
    if any(match_key(row["governorate_ar"]) not in valid_governorates
           or row["kind"] not in {"public", "private"} or not row["source_url"]
           for row in institutions):
        raise ValueError("Invalid institution attribution or governorate mapping")
    counts = Counter((row["governorate_ar"], row["kind"]) for row in institutions)
    return {
        "governorate_names_verified": 19,
        "districts_verified": 0,
        "subdistricts_verified": 0,
        "neighborhoods_verified": 0,
        "pickup_areas_verified": 0,
        "university_candidates": len(institutions),
        "public_candidates": sum(row["kind"] == "public" for row in institutions),
        "private_candidates": sum(row["kind"] == "private" for row in institutions),
        "institution_counts_by_governorate": {
            row["name_ar"]: {"public": counts[(row["name_ar"], "public")],
                             "private": counts[(row["name_ar"], "private")]}
            for row in rows
        },
    }


def read_development(institutions: list[dict]) -> dict:
    from sqlalchemy import create_engine, text

    engine = create_engine(direct_development_url(), pool_pre_ping=True,
                           connect_args={"options": "-c default_transaction_read_only=on"})
    try:
        with engine.connect() as connection:
            if connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
                raise RuntimeError("Read-only connection not established")
            revisions = connection.execute(text("SELECT version_num FROM public.alembic_version")).scalars().all()
            if revisions != ["20261009_0006"]:
                raise RuntimeError("Unexpected development revision")
            university_rows = connection.execute(text(
                'SELECT "University_name", governorate FROM public.university'
            )).all()
            area_count = connection.execute(text("SELECT count(*) FROM public.area")).scalar_one()
        return {"endpoint_id": VERIFIED_ENDPOINT_ID, "revision": revisions[0],
                "transaction_read_only": True, "existing_areas": area_count,
                "institution_name_comparison": candidate_comparison(university_rows, institutions)}
    finally:
        engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--development", action="store_true",
                        help="Compare with verified Neon development in read-only mode")
    parser.add_argument("--apply", action="store_true",
                        help="Refused while the nationwide coverage gate is incomplete")
    args = parser.parse_args()
    if args.apply:
        raise RuntimeError("Import refused: hierarchy, pickup coverage, snapshot and separate approval are unresolved")
    governorates, institutions = load_manifests()
    result = validate(governorates, institutions)
    result["mode"] = "dry_run_only"
    result["approved_inserts"] = 0
    result["approved_updates"] = 0
    result["blockers"] = [
        "No verified nationwide district/subdistrict/neighborhood source manifest",
        "No verified pickup areas or approved hierarchy mapping",
        "Only a partial university/college candidate list; private names need cross-check",
        "Proposed revision 20261009_0007 is unapplied and unapproved",
        "Fresh restorable development snapshot unconfirmed",
        "Separate Neon import approval absent",
    ]
    if args.development:
        result["development_read_only"] = read_development(institutions)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # Database exceptions can embed URLs; report only their type.
        print(f"Catalogue dry run stopped: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
