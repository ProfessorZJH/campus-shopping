import importlib.util
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET


SCRIPT = Path(__file__).resolve().parents[1] / "verify-fix-regressions.py"
SPEC = importlib.util.spec_from_file_location("verify_fix_regressions", SCRIPT)
regressions = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(regressions)


class MapperPredicateRegressionTest(unittest.TestCase):
    def setUp(self):
        self.tree = ET.parse(regressions.mapper)

    def verify(self):
        with tempfile.TemporaryDirectory() as directory:
            mapper = Path(directory) / "mapper.xml"
            self.tree.write(mapper, encoding="utf-8", xml_declaration=True)
            regressions.verify_mapper(mapper)

    def test_shared_filters_are_accepted(self):
        self.verify()

    def test_count_cannot_use_the_managed_filter(self):
        include = self.tree.getroot().find("./select[@id='count']/include")
        include.set("refid", "managedSearchFilter")
        with self.assertRaises(AssertionError):
            self.verify()

    def test_count_cannot_make_the_filter_optional(self):
        count = self.tree.getroot().find("./select[@id='count']")
        include = count.find("include")
        count.remove(include)
        optional = ET.SubElement(count, "if", {"test": "optional"})
        optional.append(include)
        with self.assertRaises(AssertionError):
            self.verify()

    def test_unresolved_include_fails_closed(self):
        include = self.tree.getroot().find("./select[@id='count']/include")
        include.set("refid", "missingFilter")
        with self.assertRaises(AssertionError):
            self.verify()


if __name__ == "__main__":
    unittest.main()
