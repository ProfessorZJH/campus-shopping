from pathlib import Path
import os
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from scripts.evidence import DEFAULT_ROOT, ROOT, evidence_dir, evidence_root, evidence_path


WRITERS = [
    "frontend/tests/contract_ui.py",
    "frontend/tests/live_final_matrix.py",
    "frontend/tests/live_m2_fulfillment.py",
    "frontend/tests/live_shopping.py",
    "frontend/tests/live_ui.py",
    "frontend/tests/ui_audit_contract.py",
    "frontend/tests/ui_copy_polish.py",
    "frontend/tests/ui_remaining.py",
    "frontend/tests/ui_three_pages.py",
    "scripts/accept-local-shopping.py",
    "scripts/probe-ddd-review.py",
    "scripts/smoke-agent-v1-1-m1-e2e.py",
    "scripts/smoke-agent-v1-1-m1-milvus-java-fact.py",
    "scripts/smoke-agent-v1-1-m2-http.py",
    "scripts/smoke-agent-v1-1-m2-runtime-bridge.py",
    "scripts/smoke-agent-v1-1.py",
    "scripts/smoke-ai-live.py",
    "scripts/smoke-ai-local.py",
    "scripts/smoke-full.py",
    "scripts/smoke-redis-shared.py",
    "scripts/verify-containers.py",
    "scripts/verify-local-shopping-db.py",
    "scripts/verify-migrations.py",
    "scripts/verify-mysql-isolated.py",
]


class EvidencePathsTest(unittest.TestCase):
    def test_local_defaults_to_ignored_var_directory(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CAMPUS_EVIDENCE_DIR", None)
            self.assertEqual(DEFAULT_ROOT, evidence_root())
            self.assertEqual(ROOT / "var/verify/ui", evidence_dir("ui"))
            self.assertEqual(ROOT / "var/verify/ui/results.json", evidence_path("ui", "results.json"))

    def test_ci_override_controls_publication_directory(self):
        with TemporaryDirectory() as directory, patch.dict(
            os.environ,
            {"CAMPUS_EVIDENCE_DIR": directory},
            clear=False,
        ):
            self.assertEqual(Path(directory).resolve(), evidence_root())
            self.assertEqual(Path(directory, "browser/results.json").resolve(), evidence_path("browser", "results.json"))

    def test_relative_override_is_resolved_from_repository_root(self):
        with patch.dict(os.environ, {"CAMPUS_EVIDENCE_DIR": "custom-evidence"}, clear=False):
            self.assertEqual((ROOT / "custom-evidence").resolve(), evidence_root())

    def test_evidence_writers_do_not_hardcode_tracked_outputs(self):
        for relative in WRITERS:
            source = (ROOT / relative).read_text(encoding="utf-8")
            if relative != "scripts/smoke-agent-v1-1-m1-e2e.py":
                self.assertNotIn("docs/testing/evidence", source, relative)
            self.assertTrue("evidence_dir" in source or "evidence_path" in source, relative)


if __name__ == "__main__":
    unittest.main()
