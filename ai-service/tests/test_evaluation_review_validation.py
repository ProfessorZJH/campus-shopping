import copy
import json

import pytest

from evaluation.dataset import load, write_jsonl
from evaluation.review_validation import main, validate_review


@pytest.fixture(scope="module")
def dataset():
    return load("campus-shopping-v1")


@pytest.fixture
def completed_annotations(dataset):
    annotations = copy.deepcopy(dataset["annotations"])
    for row in annotations:
        row.update(reviewStatus="HUMAN_REVIEWED", reviewer="test-reviewer", reviewedAt="2026-11-10T12:00:00+08:00")
    return annotations


def test_draft_handoff_reports_all_cases_pending(dataset):
    result = validate_review(dataset, dataset["annotations"])
    assert result["status"] == "PENDING"
    assert (result["expected"], result["received"], result["complete"], result["pending"]) == (120, 120, 0, 120)
    assert result["errorCounts"] == {"INVALID_REVIEWED_AT": 120, "MISSING_REVIEWER": 120, "NOT_HUMAN_REVIEWED": 120}


def test_complete_metadata_is_only_a_structural_check(dataset, completed_annotations):
    result = validate_review(dataset, completed_annotations)
    assert result["status"] == "PASS"
    assert result["scope"] == "STRUCTURAL_CHECK_ONLY"
    assert result["datasetStatus"] == "DRAFT"
    assert result["complete"] == 120
    assert result["pending"] == 0
    assert dataset["validation"]["reviewed"] == 0


@pytest.mark.parametrize("changes,code", [
    ({"caseHash": "wrong"}, "CASE_HASH_MISMATCH"),
    ({"qrelsHash": "wrong"}, "QRELS_HASH_MISMATCH"),
    ({"datasetVersion": "wrong"}, "DATASET_VERSION_MISMATCH"),
    ({"disputed": True}, "UNRESOLVED_DISPUTE"),
    ({"disputed": 0}, "UNRESOLVED_DISPUTE"),
    ({"annotationSource": "  "}, "MISSING_ANNOTATION_SOURCE"),
    ({"reviewer": "  "}, "MISSING_REVIEWER"),
    ({"reviewedAt": "not-a-date"}, "INVALID_REVIEWED_AT"),
])
def test_each_invalid_review_stays_pending(dataset, completed_annotations, changes, code):
    completed_annotations[0].update(changes)
    result = validate_review(dataset, completed_annotations)
    assert result["status"] == "PENDING"
    assert result["complete"] == 119
    assert result["pending"] == 1
    assert result["errorCounts"][code] == 1


def test_missing_duplicate_and_unknown_cases_are_rejected(dataset, completed_annotations):
    completed_annotations.pop()
    completed_annotations.append(copy.deepcopy(completed_annotations[0]))
    completed_annotations.append({"caseId": "private-text-should-not-be-reported"})
    completed_annotations.append(None)
    result = validate_review(dataset, completed_annotations)
    assert result["status"] == "PENDING"
    assert result["complete"] == 118
    assert result["errorCounts"] == {
        "DUPLICATE_ANNOTATION": 1,
        "MISSING_ANNOTATION": 1,
        "MISSING_CASE_ID": 1,
        "UNKNOWN_CASE": 1,
    }
    assert "private-text-should-not-be-reported" not in json.dumps(result)


def test_cli_is_read_only_and_reports_pending(dataset, tmp_path, capsys):
    path = tmp_path / "annotations.jsonl"
    write_jsonl(path, dataset["annotations"])
    before = path.read_bytes()
    assert main(["--annotations", str(path)]) == 1
    report = json.loads(capsys.readouterr().out)
    assert report["status"] == "PENDING"
    assert report["complete"] == 0
    assert report["pending"] == 120
    assert "errors" not in report
    assert path.read_bytes() == before


def test_cli_reports_invalid_input_without_echoing_path(tmp_path, capsys):
    assert main(["--annotations", str(tmp_path / "private-file")]) == 2
    report = json.loads(capsys.readouterr().out)
    assert report == {"status": "INVALID_INPUT", "errorType": "FileNotFoundError"}
