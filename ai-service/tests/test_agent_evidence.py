from __future__ import annotations

import json

import pytest

from app.agent_evidence import (
    EVIDENCE_STATUSES,
    EvidenceRecorder,
    assert_isolated_collection,
    isolated_collection_name,
)


def test_isolated_collection_name_cannot_target_production():
    name = isolated_collection_name()
    assert name.startswith("campus_agent_products_")
    assert_isolated_collection(name)
    with pytest.raises(ValueError):
        assert_isolated_collection("campus_products_v1")
    with pytest.raises(ValueError):
        assert_isolated_collection("campus_agent_products_fixed")


def test_evidence_recorder_rejects_unknown_status_and_records_safe_metadata(tmp_path):
    with pytest.raises(ValueError):
        EvidenceRecorder(tmp_path / "bad.json", "run", "test", "PASS")
    recorder = EvidenceRecorder(tmp_path / "ok.json", "run", "test", "NOT_RUN")
    recorder.mark_not_run("live", "供应商凭据未配置")
    data = json.loads((tmp_path / "ok.json").read_text("utf-8"))
    assert data["evidenceStatus"] in EVIDENCE_STATUSES
    assert data["checks"][0]["outcome"] == "NOT_RUN"
