import unittest
from unittest import mock

from scripts import schema_contract


class FakeCursor:
    def __init__(self):
        self.statements = []
        self.last_query = ""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        self.last_query = query
        self.statements.append((query, params))

    def fetchone(self):
        if "SELECT DATABASE()" in self.last_query:
            return ("campus",)
        if "GET_LOCK" in self.last_query:
            return (1,)
        if "RELEASE_LOCK" in self.last_query:
            return (1,)
        if "table_name='sys_schema_migration_drift'" in self.last_query:
            return (1,)
        return (0,)

    def fetchall(self):
        if "SELECT version,checksum" in self.last_query:
            return []
        return []

    def nextset(self):
        return None


class FakeConnection:
    def __init__(self):
        self.cursor_instance = FakeCursor()

    def cursor(self):
        return self.cursor_instance


class SchemaAdmissionTest(unittest.TestCase):
    EXPECTED = [{
        "version": "V1",
        "file": "V20261028_01__order_item_image_snapshot.sql",
        "sha256": "a",
    }]

    def run_migrations(self, **kwargs):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"):
            schema_contract.apply_migrations(connection, expected=self.EXPECTED, **kwargs)
        return connection.cursor_instance

    def test_unknown_structure_is_rejected_before_ddl(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value={"iam_user"}), \
             mock.patch.object(schema_contract, "schema_fingerprint", return_value="unknown"), \
             mock.patch.object(schema_contract, "_history", return_value={}), \
             mock.patch.object(schema_contract, "_baseline_manifest", return_value=[]), \
             mock.patch.object(schema_contract, "_structure_detail", return_value="detail"), \
             mock.patch.object(schema_contract, "execute_script") as execute_script:
            with self.assertRaises(schema_contract.SchemaAdmissionError):
                schema_contract.apply_migrations(connection, expected=self.EXPECTED)

        execute_script.assert_not_called()
        self.assertFalse(any("CREATE TABLE" in statement[0] for statement in connection.cursor_instance.statements))

    def test_complete_history_with_drift_records_audit_before_rejecting(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value={"sys_schema_migration_drift"}), \
             mock.patch.object(schema_contract, "schema_fingerprint", return_value="drift"), \
             mock.patch.object(schema_contract, "_history", return_value={"V1": "a"}), \
             mock.patch.object(schema_contract, "_structure_detail", return_value="detail"), \
             mock.patch.object(schema_contract, "_write_audit") as write_audit:
            with self.assertRaises(schema_contract.SchemaDriftError):
                schema_contract.apply_migrations(connection, expected=self.EXPECTED)

        self.assertEqual(write_audit.call_args.args[2], "DRIFT")
        self.assertFalse(any("CREATE TABLE" in statement[0] for statement in connection.cursor_instance.statements))

    def test_known_baseline_acceptance_audits_and_replays(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value={"legacy_table"}), \
             mock.patch.object(schema_contract, "schema_fingerprint", side_effect=["legacy", "target"]), \
             mock.patch.object(schema_contract, "_history", return_value={}), \
             mock.patch.object(
                 schema_contract,
                 "_baseline_manifest",
                 return_value=[{"release": "legacy", "sourceFingerprint": "legacy", "expectedHistory": ["V1"]}],
             ), \
             mock.patch.object(schema_contract, "_write_audit") as write_audit, \
             mock.patch.object(schema_contract, "_register_history"), \
             mock.patch.object(schema_contract, "validate_history"), \
             mock.patch.object(schema_contract, "execute_script") as execute_script:
            schema_contract.apply_migrations(
                connection,
                expected=self.EXPECTED,
                accept_baseline="legacy",
                reason="ticket-1",
                operator="alice",
            )

        self.assertEqual(write_audit.call_args.args[2], "BASELINE_ACCEPTED")
        execute_script.assert_called_once()
        self.assertTrue(any("CREATE TABLE" in statement[0] for statement in connection.cursor_instance.statements))

    def test_current_target_with_complete_history_is_idempotent(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value={"sys_schema_migration"}), \
             mock.patch.object(schema_contract, "schema_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_history", return_value={"V1": "a"}), \
             mock.patch.object(schema_contract, "execute_script") as execute_script:
            schema_contract.apply_migrations(connection, expected=self.EXPECTED)

        execute_script.assert_not_called()
        self.assertFalse(any("CREATE TABLE" in statement[0] for statement in connection.cursor_instance.statements))

    def test_empty_database_replays_current_schema(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value=set()), \
             mock.patch.object(schema_contract, "schema_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "validate_history"), \
             mock.patch.object(schema_contract, "execute_script") as execute_script:
            schema_contract.apply_migrations(connection, expected=self.EXPECTED)

        execute_script.assert_called_once()
        self.assertIn("BEGIN GENERATED SCHEMA PREFLIGHT", execute_script.call_args.args[1])
        self.assertFalse(any("CREATE TABLE" in statement[0] for statement in connection.cursor_instance.statements))

    def test_current_target_without_history_registers_history(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value={"iam_user"}), \
             mock.patch.object(schema_contract, "schema_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_history", return_value={}), \
             mock.patch.object(schema_contract, "_register_history") as register_history, \
             mock.patch.object(schema_contract, "validate_history"):
            schema_contract.apply_migrations(connection, expected=self.EXPECTED)

        register_history.assert_called_once_with(connection.cursor_instance, self.EXPECTED)
        self.assertTrue(any("CREATE TABLE" in statement[0] for statement in connection.cursor_instance.statements))

    def test_post_migration_drift_is_audited_and_rejected(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value={"legacy_table", "sys_schema_migration_drift"}), \
             mock.patch.object(schema_contract, "schema_fingerprint", side_effect=["legacy", "drift"]), \
             mock.patch.object(schema_contract, "_history", return_value={}), \
             mock.patch.object(
                 schema_contract,
                 "_baseline_manifest",
                 return_value=[{"release": "legacy", "sourceFingerprint": "legacy", "expectedHistory": ["V1"]}],
             ), \
             mock.patch.object(schema_contract, "_write_audit") as write_audit, \
             mock.patch.object(schema_contract, "_register_history"), \
             mock.patch.object(schema_contract, "validate_history"), \
             mock.patch.object(schema_contract, "execute_script") as execute_script:
            with self.assertRaises(schema_contract.SchemaDriftError):
                schema_contract.apply_migrations(
                    connection,
                    expected=self.EXPECTED,
                    accept_baseline="legacy",
                    reason="ticket-1",
                    operator="alice",
                )

        self.assertEqual(write_audit.call_args_list[-1].args[2], "DRIFT")
        execute_script.assert_called_once()

    def test_known_baseline_with_mismatched_history_is_rejected(self):
        connection = FakeConnection()
        with mock.patch.object(schema_contract, "_target_fingerprint", return_value="target"), \
             mock.patch.object(schema_contract, "_table_names", return_value={"legacy_table"}), \
             mock.patch.object(schema_contract, "schema_fingerprint", return_value="legacy"), \
             mock.patch.object(schema_contract, "_history", return_value={"V2": "wrong"}), \
             mock.patch.object(
                 schema_contract,
                 "_baseline_manifest",
                 return_value=[{"release": "legacy", "sourceFingerprint": "legacy", "expectedHistory": ["V1"]}],
             ), \
             mock.patch.object(schema_contract, "_structure_detail", return_value="detail"), \
             mock.patch.object(schema_contract, "execute_script") as execute_script:
            with self.assertRaises(ValueError) as context:
                schema_contract.apply_migrations(connection, expected=self.EXPECTED)

        self.assertIn("已登记迁移被修改", str(context.exception))
        execute_script.assert_not_called()
        self.assertFalse(any("CREATE TABLE" in statement[0] for statement in connection.cursor_instance.statements))


if __name__ == "__main__":
    unittest.main()
