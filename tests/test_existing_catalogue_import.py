import unittest
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch
import json

from tools.import_existing_catalogue import catalogue, compare, desired_rows, main


class ExistingCatalogueImportTests(unittest.TestCase):
    def test_source_and_generated_catalogue_are_consistent(self):
        governors, universities = catalogue()
        areas, institutions = desired_rows(governors, universities)
        self.assertEqual((len(governors), len(areas), len(institutions)), (19, 270, 166))

    def test_repeat_import_preserves_existing_ids(self):
        governors, universities = catalogue()
        areas, institutions = desired_rows(governors, universities)
        first = compare(areas, institutions, [], [])
        repeat = compare(areas, institutions, areas, institutions)
        self.assertEqual((first["proposed_area_inserts"], first["proposed_university_inserts"]), (270, 166))
        self.assertEqual((repeat["proposed_area_inserts"], repeat["proposed_university_inserts"]), (0, 0))

    def test_university_governorate_conflict_is_not_silently_updated(self):
        governors, universities = catalogue()
        areas, institutions = desired_rows(governors, universities)
        name, governorate = institutions[0]
        result = compare(areas, institutions, [], [(name, "different governorate")])
        self.assertIn(name, result["conflicts"])

    def test_development_flag_reports_read_only_mode(self):
        output = StringIO()
        with patch("sys.argv", ["import_existing_catalogue.py", "--development"]), \
                patch("tools.import_existing_catalogue.development_preview",
                      return_value={"mode": "development_read_only", "revision": ["20261009_0006"]}), \
                redirect_stdout(output):
            self.assertEqual(main(), 0)
        result = json.loads(output.getvalue())
        self.assertEqual(result["mode"], "development_read_only")


if __name__ == "__main__":
    unittest.main()
