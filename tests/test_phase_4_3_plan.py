from tools.phase43_readonly_preview import candidate_comparison
from tools.phase43_synthetic_plan import build_plan


def test_catalogue_preview_is_idempotent_and_flags_ambiguous_existing_rows():
    candidates = [{"name_ar": "جامعة بغداد", "governorate_ar": "بغداد"},
                  {"name_ar": "جامعة البصرة", "governorate_ar": "البصرة"}]
    assert candidate_comparison([], candidates)["candidate_inserts"] == 2
    same = candidate_comparison([("جامعة بغداد", "بغداد"), ("جامعة البصرة", "البصرة")], candidates)
    assert same["exact_existing"] == 2
    assert same["candidate_inserts"] == 0
    conflict = candidate_comparison([("جامعة بغداد", "غير محدد")], candidates)
    assert conflict["candidate_inserts"] == 1
    assert len(conflict["manual_conflicts"]) == 1


def test_synthetic_plan_has_no_credentials_or_real_contacts():
    plan = build_plan()
    assert len(plan["accounts"]) == 18
    assert len({item["email"] for item in plan["accounts"]}) == 18
    assert all(item["email"].endswith("@example.test") for item in plan["accounts"])
    assert plan["planned_counts_if_reference_gate_passes"]["active_enrollment"] == 2
    assert all("password" not in item and "phone" not in item for item in plan["accounts"])
