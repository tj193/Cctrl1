"""Offline nationwide manifest and additive migration checks; no Neon access."""

import ast
from pathlib import Path

from src.admin.models import SQLModel
from tools.nationwide_catalogue_import import load_manifests, validate


ROOT = Path(__file__).resolve().parents[1]


def test_nineteen_governorates_and_partial_institution_candidates():
    governorates, institutions = load_manifests()
    result = validate(governorates, institutions)
    assert result["governorate_names_verified"] == 19
    assert result["districts_verified"] == result["pickup_areas_verified"] == 0
    assert result["public_candidates"] == 5
    assert result["private_candidates"] == 8
    assert result["institution_counts_by_governorate"]["حلبجة"] == {"public": 0, "private": 0}


def test_current_model_remains_compatible_with_unmigrated_development():
    tables = SQLModel.metadata.tables
    assert "governorate" not in tables and "catalogue_location" not in tables
    assert "catalogue_location_id" not in tables["area"].c
    assert "governorate_id" not in tables["university"].c
    route_fks = {fk.target_fullname for column in tables["route"].columns for fk in column.foreign_keys}
    assert {"area.id", "university.id"} <= route_fks


def test_revision_is_additive_and_downgrade_has_data_guard():
    source = (ROOT / "migrations/versions/20261009_0007_nationwide_catalogue_hierarchy.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    upgrades = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "upgrade")
    calls = [node.func.attr for node in ast.walk(upgrades) if isinstance(node, ast.Call)
             and isinstance(node.func, ast.Attribute)]
    assert "drop_table" not in calls and "drop_column" not in calls
    assert "create_table" in calls and "add_column" in calls
    assert '"fk_area_catalogue_location"' in source
    assert '"fk_university_governorate"' in source
    assert "Catalogue data exists; downgrade refused" in source


def test_import_write_flag_is_statically_refused_before_connection():
    source = (ROOT / "tools/nationwide_catalogue_import.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
    refusal = source.index("if args.apply:")
    manifest_load = source.index("governorates, institutions = load_manifests()", refusal)
    connection = source.index("read_development(institutions)", refusal)
    assert refusal < manifest_load < connection
    assert "Import refused: hierarchy, pickup coverage, snapshot and separate approval" in source
