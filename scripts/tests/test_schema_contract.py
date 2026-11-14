import unittest

from scripts import schema_contract


class FakeCursor:
    def __init__(self, rows_by_kind):
        self.rows_by_kind = rows_by_kind
        self.kind = None

    def execute(self, query, params=None):
        if "information_schema.COLUMNS" in query:
            self.kind = "columns"
        elif "information_schema.STATISTICS" in query:
            self.kind = "indexes"
        elif "information_schema.TABLE_CONSTRAINTS" in query:
            self.kind = "constraints"
        elif "information_schema.CHECK_CONSTRAINTS" in query:
            self.kind = "checks"
        else:
            raise AssertionError(f"unexpected query: {query}")

    def fetchall(self):
        return self.rows_by_kind[self.kind]


class SchemaContractTest(unittest.TestCase):
    def test_normalized_default_and_check_are_stable(self):
        self.assertEqual(schema_contract._normalized_default(None), "<NULL>")
        self.assertEqual(schema_contract._normalized_default("  CURRENT_TIMESTAMP(3)  "), "CURRENT_TIMESTAMP(3)")
        self.assertEqual(schema_contract._normalized_default("a\t\n b"), "a b")
        self.assertEqual(schema_contract._normalized_check("  PRICE  >  0 "), "price > 0")

    def test_schema_fingerprint_rows_normalize_metadata(self):
        cursor = FakeCursor(
            {
                "columns": [("T", "id", 1, "VARCHAR(36)", "NO", "  x  ", "AUTO_INCREMENT")],
                "indexes": [("T", "PRIMARY", 0, 1, "id", None)],
                "constraints": [("T", "PRIMARY", "PRIMARY KEY", "YES")],
                "checks": [("ck_t", "  `price` >  0 ")],
            }
        )

        rows = schema_contract.schema_fingerprint_rows(cursor, "db")

        self.assertEqual(rows["columns"], [["T", "id", 1, "varchar(36)", "NO", "x", ""]])
        self.assertEqual(rows["indexes"], [["T", "PRIMARY", 0, 1, "id", ""]])
        self.assertEqual(rows["constraints"], [["T", "PRIMARY", "PRIMARY KEY", "YES"]])
        self.assertEqual(rows["checks"], [["ck_t", "`price` > 0"]])

    def test_schema_fingerprint_is_deterministic_for_normalized_rows(self):
        first = FakeCursor(
            {
                "columns": [("T", "id", 1, "VARCHAR(36)", "NO", "x", "AUTO_INCREMENT")],
                "indexes": [("T", "PRIMARY", 0, 1, "id", None)],
                "constraints": [("T", "PRIMARY", "PRIMARY KEY", "YES")],
                "checks": [("ck_t", "PRICE > 0")],
            }
        )
        second = FakeCursor(
            {
                "columns": [("T", "id", 1, "varchar(36)", "NO", " x ", " auto_increment ")],
                "indexes": [("T", "PRIMARY", 0, 1, "id", "")],
                "constraints": [("T", "PRIMARY", "PRIMARY KEY", "YES")],
                "checks": [("ck_t", " price   >   0 ")],
            }
        )

        self.assertEqual(
            schema_contract.schema_fingerprint(first, "db"),
            schema_contract.schema_fingerprint(second, "db"),
        )

    def test_history_subset_requires_matching_checksums(self):
        wanted = {"V1": "a", "V2": "b"}
        self.assertTrue(schema_contract._valid_history_subset({"V1": "a"}, wanted))
        self.assertFalse(schema_contract._valid_history_subset({"V1": "wrong"}, wanted))
        self.assertFalse(schema_contract._valid_history_subset({"V3": "c"}, wanted))

    def test_expected_history_expands_published_prefix(self):
        history = schema_contract._expected_history(
            {"expectedHistoryPrefix": "V20261028_01..V20261030_01"}
        )
        self.assertEqual(
            history,
            ["V20261028_01", "V20261028_02", "V20261029_01", "V20261030_01"],
        )


if __name__ == "__main__":
    unittest.main()
