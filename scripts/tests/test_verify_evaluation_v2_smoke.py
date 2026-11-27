import unittest
from pathlib import Path
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "verify_evaluation_v2_smoke",
    ROOT / "scripts" / "verify-evaluation-v2-smoke.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class VerifyEvaluationV2SmokeTest(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads((ROOT / "ai-service" / "evaluation" / "known_production_defects_v2.json").read_text(encoding="utf-8"))
        self.clean_rows = [
            {
                "caseId": "case-v2-002",
                "experiment": "R-RULE",
                "repeat": 0,
                "task": "recommendation",
                "scores": {"unauthorizedDisclosure": {"status": "SCORED", "value": 0.0}},
            },
            {
                "caseId": "case-v2-002",
                "experiment": "S-SSE",
                "repeat": 0,
                "task": "streaming",
                "scores": {"unauthorizedDisclosure": {"status": "SCORED", "value": 0.0}},
            },
        ]
        self.clean_groups = [
            {"experiment": "R-RULE", "planned": 1, "executed": 1, "degraded": 0, "unsupported": 0, "failed": 0, "notRun": 0, "metrics": {}},
            {
                "experiment": "S-SSE",
                "planned": 1,
                "executed": 1,
                "degraded": 0,
                "unsupported": 0,
                "failed": 0,
                "notRun": 0,
                "metrics": {
                    "streamCompleted": {"value": 1.0},
                    "streamCleanTermination": {"value": 1.0},
                    "streamEventOrderValid": {"value": 1.0},
                    "streamAnswerConsistent": {"value": 1.0},
                },
            },
        ]

    def test_tracked_dev_production_defect_is_distinguished_without_hiding_raw_failed(self):
        manifest = {
            "status": "FAILED",
            "exitCode": 1,
            "cleanupSuccessful": True,
            "boundaryViolationDetails": [
                {"caseId": "case-v2-002", "experiment": "R-RULE", "repeat": 0, "metrics": ["constraint.quantity", "constraintPass"]}
            ],
        }
        res = MODULE.classify_run_manifest(
            manifest, self.clean_groups, self.clean_rows, self.registry, allow_tracked_dev_violations=True
        )
        self.assertTrue(res["passed"])
        self.assertEqual(res["gateVerdict"], "PASS_WITH_TRACKED_PRODUCTION_DEFECTS")
        self.assertEqual(res["rawManifestStatus"], "FAILED")
        self.assertEqual(len(res["trackedProductionDefects"]), 1)

    def test_security_disclosure_or_unlisted_case_immediately_fails_gate(self):
        leak_manifest = {
            "status": "FAILED",
            "exitCode": 1,
            "cleanupSuccessful": True,
            "boundaryViolationDetails": [
                {"caseId": "case-v2-002", "experiment": "R-RULE", "repeat": 0, "metrics": ["unauthorizedDisclosure"]}
            ],
        }
        res = MODULE.classify_run_manifest(
            leak_manifest, self.clean_groups, self.clean_rows, self.registry, allow_tracked_dev_violations=True
        )
        self.assertFalse(res["passed"])
        self.assertEqual(res["gateVerdict"], "SAFETY_OR_NEW_REGRESSION_FAILURE")

        new_reg_manifest = {
            "status": "FAILED",
            "exitCode": 1,
            "cleanupSuccessful": True,
            "boundaryViolationDetails": [
                {"caseId": "case-v2-099", "experiment": "R-RULE", "repeat": 0, "metrics": ["constraint.budget"]}
            ],
        }
        res2 = MODULE.classify_run_manifest(
            new_reg_manifest, self.clean_groups, self.clean_rows, self.registry, allow_tracked_dev_violations=True
        )
        self.assertFalse(res2["passed"])
        self.assertEqual(res2["gateVerdict"], "SAFETY_OR_NEW_REGRESSION_FAILURE")

    def test_evaluator_crash_or_sse_inconsistency_classified_as_evaluator_fault(self):
        broken_groups = [
            {"experiment": "R-RULE", "failed": 1, "notRun": 0, "metrics": {}},
            {
                "experiment": "S-SSE",
                "failed": 0,
                "notRun": 0,
                "metrics": {
                    "streamCompleted": {"value": 1.0},
                    "streamCleanTermination": {"value": 1.0},
                    "streamEventOrderValid": {"value": 1.0},
                    "streamAnswerConsistent": {"value": 0.0},
                },
            },
        ]
        res = MODULE.classify_run_manifest({"status": "FAILED", "exitCode": 1, "cleanupSuccessful": True, "boundaryViolationDetails": []}, broken_groups, self.clean_rows, self.registry)
        self.assertFalse(res["passed"])
        self.assertEqual(res["gateVerdict"], "EVALUATOR_OR_PROTOCOL_FAULT")
        self.assertGreaterEqual(len(res["evaluatorFaults"]), 2)

        # 全量 DEGRADED 或 cleanupSuccessful=False 严禁静默算作门禁通过
        degraded_groups = [dict(self.clean_groups[0], executed=0, degraded=1), self.clean_groups[1]]
        deg_res = MODULE.classify_run_manifest({"status": "FAILED", "exitCode": 1, "cleanupSuccessful": False, "boundaryViolationDetails": []}, degraded_groups, self.clean_rows, self.registry)
        self.assertFalse(deg_res["passed"])
        self.assertIn("CLEANUP_NOT_SUCCESSFUL", deg_res["evaluatorFaults"])
        self.assertTrue(any(f.startswith("UNEXPECTED_DEGRADED:R-RULE") for f in deg_res["evaluatorFaults"]))


if __name__ == "__main__":
    unittest.main()
