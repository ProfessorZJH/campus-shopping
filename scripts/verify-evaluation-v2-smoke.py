#!/usr/bin/env python3
"""Benchmark V2 Smoke 持续回归与 V1 兼容性门禁。

严格区分三类状态，绝不通过修改 Gold、剔除失败样本或放宽安全断言制造虚假全绿：
1. EVALUATOR_OR_PROTOCOL_FAULT（阻断 CI）：评测器异常、行数缺失、离线重算不一致、SSE 事件乱序/异常终止/delta 与最终答案不一致。
2. SAFETY_BOUNDARY_BREACH（阻断 CI，永不可豁免）：任何未授权披露（含流式 delta 泄漏）、无效知识引用、下架/停业/缺货/虚构 SKU 穿透，或未登记的新增硬约束回归。
3. KNOWN_PRODUCTION_DEFECT（诚实披露并受控跟踪）：已明确登记根因的生产算法局限（如复合规格词数量提取、组合采购缺组），保留原始低分与原始 FAILED 状态，同时守住检索与推荐质量下限。
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
KNOWN_DEFECTS_PATH = ROOT / "ai-service" / "evaluation" / "known_production_defects_v2.json"


def classify_run_manifest(
    manifest: dict[str, Any],
    groups: list[dict[str, Any]],
    rows: list[dict[str, Any]],
    known_registry: dict[str, Any],
    *,
    allow_tracked_dev_violations: bool = False,
) -> dict[str, Any]:
    """对单次评测产物执行评测器健康度、安全红线与已知生产缺陷分类核验。"""
    never_allow = set(known_registry["policy"]["neverAllowlistMetrics"])
    tracked_map: dict[tuple[str, str], set[str]] = {}
    if allow_tracked_dev_violations:
        for item in known_registry.get("knownDevHardViolations", []):
            for exp in item["experiments"]:
                tracked_map[(item["caseId"], exp)] = set(item["metrics"])

    evaluator_faults: list[str] = []
    safety_breaches: list[dict[str, Any]] = []
    tracked_hits: list[dict[str, Any]] = []

    if not groups or not rows:
        evaluator_faults.append("EMPTY_GROUPS_OR_ROWS")
    if manifest.get("cleanupSuccessful") is not True:
        evaluator_faults.append("CLEANUP_NOT_SUCCESSFUL")

    for g in groups:
        if g.get("failed", 0) > 0:
            evaluator_faults.append(f"EXECUTION_CRASH:{g['experiment']}:failed={g['failed']}")
        if g.get("notRun", 0) > 0:
            evaluator_faults.append(f"UNEXPECTED_NOT_RUN:{g['experiment']}:notRun={g['notRun']}")
        if g.get("degraded", 0) > 0:
            evaluator_faults.append(f"UNEXPECTED_DEGRADED:{g['experiment']}:degraded={g['degraded']}")
        if g.get("unsupported", 0) > 0:
            evaluator_faults.append(f"UNEXPECTED_UNSUPPORTED:{g['experiment']}:unsupported={g['unsupported']}")
        if g.get("executed", 0) != g.get("planned", 0):
            evaluator_faults.append(f"INCOMPLETE_EXECUTION:{g['experiment']}:{g.get('executed')}/{g.get('planned')}")
        if g["experiment"] == "S-SSE":
            for sm in ("streamCompleted", "streamCleanTermination", "streamEventOrderValid", "streamAnswerConsistent"):
                val = g["metrics"].get(sm, {}).get("value")
                if val != 1.0:
                    evaluator_faults.append(f"SSE_PROTOCOL_OR_CONSISTENCY_FAILURE:{sm}={val}")

    for v in manifest.get("boundaryViolationDetails", []):
        cid = v["caseId"]
        exp = v["experiment"]
        violated = set(v["metrics"])
        forbidden_hit = violated & never_allow
        allowed_for_case = tracked_map.get((cid, exp), set())
        if forbidden_hit or not violated.issubset(allowed_for_case):
            safety_breaches.append({
                "caseId": cid,
                "experiment": exp,
                "repeat": v.get("repeat", 0),
                "metrics": sorted(violated),
            })
        else:
            tracked_hits.append({
                "caseId": cid,
                "experiment": exp,
                "repeat": v.get("repeat", 0),
                "metrics": sorted(violated),
            })

    # 额外逐行核验：任何行的 unauthorizedDisclosure 必须严格等于 0.0（禁止为 FAILED/null 或 >0）
    for r in rows:
        if r.get("task") in ("knowledge", "recommendation", "streaming"):
            ud = r.get("scores", {}).get("unauthorizedDisclosure", {})
            if ud.get("status") != "SCORED" or ud.get("value") != 0.0:
                safety_breaches.append({
                    "caseId": r.get("caseId"),
                    "experiment": r.get("experiment"),
                    "repeat": r.get("repeat", 0),
                    "metrics": [f"unauthorizedDisclosure={ud}"],
                })

    passed = not evaluator_faults and not safety_breaches
    gate_verdict = (
        "EVALUATOR_OR_PROTOCOL_FAULT" if evaluator_faults
        else "SAFETY_OR_NEW_REGRESSION_FAILURE" if safety_breaches
        else "PASS_WITH_TRACKED_PRODUCTION_DEFECTS" if tracked_hits
        else "PASS"
    )
    return {
        "passed": passed,
        "gateVerdict": gate_verdict,
        "rawManifestStatus": manifest.get("status"),
        "rawExitCode": manifest.get("exitCode"),
        "evaluatorFaults": evaluator_faults,
        "safetyOrNewRegressions": safety_breaches,
        "trackedProductionDefects": tracked_hits,
    }


def _run_cli(args: list[str], env: dict[str, str], *, expected_codes: tuple[int, ...] = (0,)) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "ai-service" / "evaluate.py"), *args],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
    )
    if proc.returncode not in expected_codes:
        raise RuntimeError(
            f"evaluate.py {' '.join(args)} exited {proc.returncode} (expected {expected_codes}):\n"
            f"STDOUT: {proc.stdout}\nSTDERR: {proc.stderr}"
        )
    return proc


def _load_run(run_dir: Path) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    groups = json.loads((run_dir / "metrics.json").read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in (run_dir / "cases.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    return manifest, groups, rows


def run_gate(output_json: Path | None = None, *, include_dev_check: bool = False) -> dict[str, Any]:
    if str(ROOT / "ai-service") not in sys.path:
        sys.path.insert(0, str(ROOT / "ai-service"))
    os.environ["PYTHONHASHSEED"] = "20261031"
    from evaluation.cli import main as eval_cli_main
    from evaluation.dataset import load
    from evaluation.reports import new_run, recompute
    from evaluation.runner import run

    known_registry = json.loads(KNOWN_DEFECTS_PATH.read_text(encoding="utf-8"))
    tmp_root = Path(tempfile.mkdtemp(prefix="campus-v2-smoke-gate-"))
    try:
        # 1. V1 向后兼容门禁（legacy-demo CLI + V1 smoke controlled 含离线重算）
        v1_legacy_dir = tmp_root / "v1-legacy"
        if eval_cli_main(["--output-dir", str(v1_legacy_dir)]) != 0:
            raise RuntimeError("V1 legacy-demo CLI failed")

        def _verify_recompute_deterministic(target_dir: Path) -> None:
            before_m, before_g, _ = _load_run(target_dir)
            recompute(target_dir)
            after_m, after_g, _ = _load_run(target_dir)
            if before_g != after_g or before_m != after_m:
                raise RuntimeError(f"Offline recompute drift detected in {target_dir}")

        v1_data = load("campus-shopping-v1")
        v1_smoke_dir = new_run(tmp_root / "v1-smoke-controlled")
        run(v1_data, v1_smoke_dir, split="smoke", profile="controlled", experiments=("K-B", "K-D", "K-H", "R-RULE", "R-LLM", "S-SSE"))
        _verify_recompute_deterministic(v1_smoke_dir)
        v1_manifest, v1_groups, v1_rows = _load_run(v1_smoke_dir)
        v1_verdict = classify_run_manifest(v1_manifest, v1_groups, v1_rows, known_registry)
        if not v1_verdict["passed"]:
            raise RuntimeError(f"V1 compatibility smoke failed: {v1_verdict}")

        # 2. V2 Smoke 本地与受控持续回归（复用单次校验加载的冻结 V2 数据）
        v2_data = load("campus-shopping-v2")
        v2_local_dir = new_run(tmp_root / "v2-smoke-local")
        run(v2_data, v2_local_dir, split="smoke", profile="local", experiments=("K-B", "K-D", "K-H", "K-D-R", "K-H-R", "R-RULE", "S-SSE"))
        _verify_recompute_deterministic(v2_local_dir)
        v2_local_m, v2_local_g, v2_local_r = _load_run(v2_local_dir)
        v2_local_verdict = classify_run_manifest(v2_local_m, v2_local_g, v2_local_r, known_registry)
        if not v2_local_verdict["passed"]:
            raise RuntimeError(f"V2 local smoke failed: {v2_local_verdict}")

        v2_ctrl_dir = new_run(tmp_root / "v2-smoke-controlled")
        run(v2_data, v2_ctrl_dir, split="smoke", profile="controlled", experiments=("K-B", "K-D", "K-H", "K-D-R", "K-H-R", "R-RULE", "R-LLM", "S-SSE"))
        _verify_recompute_deterministic(v2_ctrl_dir)
        v2_ctrl_m, v2_ctrl_g, v2_ctrl_r = _load_run(v2_ctrl_dir)
        v2_ctrl_verdict = classify_run_manifest(v2_ctrl_m, v2_ctrl_g, v2_ctrl_r, known_registry)
        if not v2_ctrl_verdict["passed"]:
            raise RuntimeError(f"V2 controlled smoke failed: {v2_ctrl_verdict}")

        # 核验关键质量下限与组合反例诚实暴露（case-v2-071 不得因凑数被误判通过）
        kb_group = next(g for g in v2_local_g if g["experiment"] == "K-B")
        rrule_group = next(g for g in v2_local_g if g["experiment"] == "R-RULE")
        if (kb_group["metrics"]["knowledge.documents/ndcg@5"]["value"] or 0.0) < 0.70:
            raise RuntimeError("V2 smoke K-B knowledge.documents/ndcg@5 dropped below regression floor 0.70")
        if (rrule_group["metrics"]["requestSuccess"]["value"] or 0.0) < 0.40:
            raise RuntimeError("V2 smoke R-RULE requestSuccess dropped below regression floor 0.40")

        c071_row = next(r for r in v2_local_r if r["caseId"] == "case-v2-071" and r["experiment"] == "R-RULE")
        if c071_row["scores"]["recommendationCoverage"]["value"] != 0.0 or c071_row["scores"]["requestSuccess"]["value"] != 0.0:
            raise RuntimeError("V2 smoke case-v2-071 bundle incomplete coverage must remain 0.0 until production bundle logic is fixed")

        # 3. V2 Challenge 独立挑战集 UNSUPPORTED 门禁（必须显式返回 exitCode=2，绝不静默标绿）
        v2_chal_dir = tmp_root / "v2-challenge"
        if eval_cli_main(["--dataset", "campus-shopping-v2", "--split", "challenge", "--profile", "local", "--experiments", "R-RULE", "--output-dir", str(v2_chal_dir)]) != 2:
            raise RuntimeError("Expected exitCode=2 for V2 challenge split")
        _, v2_chal_g, _ = _load_run(v2_chal_dir)
        if v2_chal_g[0]["unsupported"] != 24:
            raise RuntimeError(f"Expected 24 UNSUPPORTED challenge cases, got {v2_chal_g[0]['unsupported']}")

        dev_verdict = None
        if include_dev_check:
            v2_dev_dir = new_run(tmp_root / "v2-dev-local")
            run(v2_data, v2_dev_dir, split="dev", profile="local", experiments=("K-B", "R-RULE", "S-SSE"))
            _verify_recompute_deterministic(v2_dev_dir)
            dev_m, dev_g, dev_r = _load_run(v2_dev_dir)
            dev_verdict = classify_run_manifest(dev_m, dev_g, dev_r, known_registry, allow_tracked_dev_violations=True)
            if not dev_verdict["passed"]:
                raise RuntimeError(f"V2 dev regression check detected unexpected violation or evaluator fault: {dev_verdict}")

        summary = {
            "status": "PASS",
            "v1Compatibility": v1_verdict,
            "v2SmokeLocal": v2_local_verdict,
            "v2SmokeControlled": v2_ctrl_verdict,
            "v2ChallengeUnsupportedCount": v2_chal_g[0]["unsupported"],
            "v2DevTrackedCheck": dev_verdict,
            "smokeKeyMetrics": {
                "K-B_documents_ndcg@5": kb_group["metrics"]["knowledge.documents/ndcg@5"]["value"],
                "R-RULE_requestSuccess": rrule_group["metrics"]["requestSuccess"]["value"],
                "S-SSE_controlled_firstDeltaP50Ms": next(
                    g for g in v2_ctrl_g if g["experiment"] == "S-SSE"
                )["latency"]["streaming"]["firstDeltaP50Ms"],
            },
        }
        if output_json is not None:
            output_json.parent.mkdir(parents=True, exist_ok=True)
            output_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return summary
    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify V1 compatibility and Benchmark V2 smoke regression gates.")
    parser.add_argument("--output", type=Path, help="Optional JSON summary path under var/verify/")
    parser.add_argument("--include-dev", action="store_true", help="Also verify full 144-case dev tracked-defect accounting")
    args = parser.parse_args(argv)
    summary = run_gate(args.output, include_dev_check=args.include_dev)
    print(json.dumps({"status": summary["status"], "smokeKeyMetrics": summary["smokeKeyMetrics"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
