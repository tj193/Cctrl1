import unittest

from tools.import_existing_catalogue import catalogue, desired_rows
from tools.seed_development_demo import AREA_KEYS, COUNTS, UNIVERSITY_KEYS, accounts


class DemoSeedPlanTests(unittest.TestCase):
    def test_exact_deterministic_counts_and_synthetic_identities(self):
        self.assertEqual(sum(COUNTS.values()), 54)
        self.assertEqual(COUNTS["user"], 18)
        self.assertEqual(COUNTS["routestudents"], 2)
        rows = accounts()
        self.assertEqual(len(rows), 18)
        self.assertEqual(len({row["email"] for row in rows}), 18)
        self.assertEqual(sum(row["role"] == "Admin" for row in rows), 1)
        self.assertTrue(all(row["email"].endswith("@example.test") for row in rows))

    def test_all_reference_keys_exist_in_project_catalogue(self):
        governors, universities = catalogue()
        areas, institutions = desired_rows(governors, universities)
        self.assertTrue(set(AREA_KEYS).issubset(set(areas)))
        self.assertTrue(set(UNIVERSITY_KEYS).issubset(set(institutions)))


if __name__ == "__main__":
    unittest.main()
