import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = SCRIPT_ROOT / "migrate-database.py"
sys.path.insert(0, str(SCRIPT_ROOT))
SPEC = importlib.util.spec_from_file_location("migrate_database", MODULE_PATH)
migrate_database = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(migrate_database)


class MigrateDatabaseCliTest(unittest.TestCase):
    def run_main(self, *args):
        with mock.patch.object(sys, "argv", [str(MODULE_PATH), *args]):
            return migrate_database.main()

    def test_accept_baseline_requires_reason_and_operator(self):
        with self.assertRaises(SystemExit) as context:
            self.run_main("--host", "127.0.0.1", "--database", "campus", "--accept-baseline", "release")

        self.assertEqual(context.exception.code, 2)

    def test_blank_reason_is_rejected_before_database_connection(self):
        with mock.patch.object(migrate_database.pymysql, "connect") as connect:
            with self.assertRaises(SystemExit) as context:
                self.run_main(
                    "--host",
                    "127.0.0.1",
                    "--database",
                    "campus",
                    "--accept-baseline",
                    "release",
                    "--reason",
                    " ",
                    "--operator",
                    "alice",
                )

        self.assertEqual(context.exception.code, 2)
        connect.assert_not_called()

    def test_reason_or_operator_cannot_be_used_without_acceptance(self):
        for option, value in (("--reason", "ticket-1"), ("--operator", "alice")):
            with self.subTest(option=option):
                with self.assertRaises(SystemExit) as context:
                    self.run_main("--host", "127.0.0.1", "--database", "campus", option, value)
                self.assertEqual(context.exception.code, 2)

    def test_valid_acceptance_arguments_are_forwarded(self):
        connection = mock.Mock()
        with mock.patch.dict(os.environ, {"DB_USERNAME": "db-user", "DB_PASSWORD": "secret"}, clear=False):
            with mock.patch.object(migrate_database.pymysql, "connect", return_value=connection) as connect:
                with mock.patch.object(migrate_database, "apply_migrations") as apply:
                    self.run_main(
                        "--host",
                        "127.0.0.1",
                        "--database",
                        "campus",
                        "--accept-baseline",
                        "release",
                        "--reason",
                        "ticket-1",
                        "--operator",
                        "alice",
                    )

        connect.assert_called_once()
        apply.assert_called_once_with(
            connection,
            accept_baseline="release",
            reason="ticket-1",
            operator="alice",
        )
        connection.close.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
