"""Mechanical checks for the human review handoff.

This module deliberately does not change the dataset or promote a DRAFT
manifest. It checks whether an annotation export contains the required fields
for each case, but cannot establish that a human actually reviewed it.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from .dataset import DatasetError, digest, load, read_jsonl


def _error(code: str, case_id: str | None = None) -> dict[str, str]:
    result = {"code": code}
    if case_id is not None:
        result["caseId"] = case_id
    return result


def _parse_timestamp(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def validate_review(data: dict[str, Any], annotations: list[dict[str, Any]]) -> dict[str, Any]:
    """Validate a human annotation export without mutating either input."""
    manifest = data["manifest"]
    cases = {row["caseId"]: row for row in data["cases"]}
    qrels = {row["caseId"]: row for row in data["qrels"]}
    annotations_by_case: dict[str, list[dict[str, Any]]] = {}
    invalid_rows = 0
    for row in annotations:
        case_id = row.get("caseId") if isinstance(row, dict) else None
        if isinstance(case_id, str) and case_id:
            annotations_by_case.setdefault(case_id, []).append(row)
        else:
            invalid_rows += 1

    errors: list[dict[str, str]] = []
    expected_ids = set(cases)
    received_ids = set(annotations_by_case)
    complete = 0
    for case_id in sorted(expected_ids):
        rows = annotations_by_case.get(case_id, [])
        if not rows:
            errors.append(_error("MISSING_ANNOTATION", case_id))
            continue
        if len(rows) > 1:
            errors.append(_error("DUPLICATE_ANNOTATION", case_id))
            continue

        annotation = rows[0]
        previous_errors = len(errors)
        if annotation.get("reviewStatus") != "HUMAN_REVIEWED":
            errors.append(_error("NOT_HUMAN_REVIEWED", case_id))
        if not isinstance(annotation.get("reviewer"), str) or not annotation["reviewer"].strip():
            errors.append(_error("MISSING_REVIEWER", case_id))
        if not _parse_timestamp(annotation.get("reviewedAt")):
            errors.append(_error("INVALID_REVIEWED_AT", case_id))
        if not isinstance(annotation.get("annotationSource"), str) or not annotation["annotationSource"].strip():
            errors.append(_error("MISSING_ANNOTATION_SOURCE", case_id))
        if annotation.get("disputed") is not False:
            errors.append(_error("UNRESOLVED_DISPUTE", case_id))
        if annotation.get("datasetVersion") != manifest["version"]:
            errors.append(_error("DATASET_VERSION_MISMATCH", case_id))
        if annotation.get("caseHash") != digest(cases[case_id]):
            errors.append(_error("CASE_HASH_MISMATCH", case_id))
        if annotation.get("qrelsHash") != digest(qrels[case_id]):
            errors.append(_error("QRELS_HASH_MISMATCH", case_id))
        if len(errors) == previous_errors:
            complete += 1

    # Unknown IDs come from untrusted input and may contain private text.
    for _ in received_ids - expected_ids:
        errors.append(_error("UNKNOWN_CASE"))
    for _ in range(invalid_rows):
        errors.append(_error("MISSING_CASE_ID"))

    disputed = sum(isinstance(row, dict) and row.get("disputed") is True for row in annotations)
    return {
        "status": "PASS" if not errors and len(annotations) == len(expected_ids) else "PENDING",
        "scope": "STRUCTURAL_CHECK_ONLY",
        "datasetId": manifest.get("datasetId"),
        "datasetVersion": manifest.get("version"),
        "datasetStatus": manifest.get("status"),
        "expected": len(expected_ids),
        "received": len(annotations),
        "complete": complete,
        "pending": len(expected_ids) - complete,
        "disputed": disputed,
        "errorCounts": dict(sorted(Counter(error["code"] for error in errors).items())),
        "errors": errors,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate human evaluation annotations")
    parser.add_argument("--dataset", default="campus-shopping-v1")
    parser.add_argument("--annotations", type=Path, required=True)
    parser.add_argument("--details", action="store_true", help="Include per-case validation errors")
    args = parser.parse_args(argv)
    try:
        data = load(args.dataset)
        result = validate_review(data, read_jsonl(args.annotations))
    except (DatasetError, OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        print(json.dumps({"status": "INVALID_INPUT", "errorType": type(error).__name__}))
        return 2
    if not args.details:
        result.pop("errors")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
