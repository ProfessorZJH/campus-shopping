"""Campus Shopping Benchmark V2 数据集契约、确定性全语料 Gold 与防泄漏回归测试。"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from evaluation.cli import main
from evaluation.dataset import DATASETS, DatasetError, load, validate
from evaluation.generate_v2 import generate_v2
from evaluation.review_validation import validate_review


@pytest.fixture(scope="module")
def v2_data():
    return load("campus-shopping-v2")


def test_v2_deterministic_generation_and_v1_untouched(tmp_path):
    v1_manifest = (DATASETS / "campus-shopping-v1" / "manifest.json").read_bytes()
    out_a = generate_v2(tmp_path / "v2a")
    out_b = generate_v2(tmp_path / "v2b")
    bytes_a = {p.name: p.read_bytes() for p in out_a.iterdir()}
    bytes_b = {p.name: p.read_bytes() for p in out_b.iterdir()}
    assert bytes_a == bytes_b
    assert all(b"\r" not in raw for raw in bytes_a.values()), "V2 files must use LF line endings"
    repo_bytes = {
        p.name: p.read_bytes()
        for p in (DATASETS / "campus-shopping-v2").iterdir()
        if p.name != "README.md"
    }
    assert bytes_a == repo_bytes
    assert (DATASETS / "campus-shopping-v1" / "manifest.json").read_bytes() == v1_manifest


def test_v2_scale_splits_families_and_anti_leakage(v2_data):
    val = v2_data["validation"]
    assert val["status"] == "DRAFT"
    assert v2_data["manifest"]["synthetic"] is True
    assert v2_data["manifest"]["dataOrigin"] == "SYNTHETIC_BENCHMARK_ONLY"
    assert val["caseCount"] == 360
    assert val["productCount"] == 480
    assert val["skuCount"] == 1020
    assert val["documentCount"] == 80
    assert val["merchantCount"] == 10
    assert val["challengeCount"] == 24
    assert val["reviewed"] == 0
    assert val["disputedCount"] == 22
    assert val["multiCaseFamilyCount"] >= 70
    assert val["nearDuplicateWarnings"] == []
    assert val["semanticOverlapWarnings"] == []

    expected_categories = {
        "exact-product-spec": 30,
        "fuzzy-need-scenario": 40,
        "budget-combo-constraint": 35,
        "attribute-quantity-negation": 30,
        "oos-discontinued-nomatch": 25,
        "cross-merchant-compare": 20,
        "public-knowledge-multievidence": 35,
        "multiturn-clarification": 40,
        "colloquial-typo-ambiguity": 25,
        "knowledge-acl-privacy": 25,
        "prompt-injection-hallucination": 25,
        "proposal-safety-mutation": 30,
    }
    assert val["categories"] == expected_categories
    splits = v2_data["splits"]
    assert len(splits["dev"]) == 144
    assert len(splits["test"]) == 216
    assert len(splits["smoke"]) == 24
    assert set(splits["smoke"]) <= set(splits["dev"])


def test_v2_zero_serial_cheating_and_no_oracle_merchant_prefilter(v2_data):
    serial_pattern = re.compile(r"校园系列\d+|vp\d{3}|vs\d{3}", re.IGNORECASE)
    for p in v2_data["products"]:
        assert not serial_pattern.search(p["title"])
        assert not serial_pattern.search(p["description"])
        for s in p["skus"]:
            assert s["specKey"].split() and set(s["specKey"].split()) == set(s["attributes"].values())

    active_merchants = sorted(
        m["merchantId"] for m in v2_data["merchants"]["merchants"] if m["status"] == "ACTIVE"
    )
    for c in v2_data["cases"]:
        assert not serial_pattern.search(c["originalQuery"])
        # 消费者与内部角色均不通过 allowedMerchantIds 预先裁剪单店候选池
        assert sorted(c["allowedMerchantIds"]) == active_merchants


def test_v2_multiversion_multichunk_clerk_rbac_and_rewrite_coverage(v2_data):
    from app.retrieval import chunks

    docs = {d["documentId"]: d for d in v2_data["knowledge"]}
    qrels = {q["caseId"]: q for q in v2_data["qrels"]}

    multi_chunk_docs = [d for d in docs.values() if len(chunks(d["content"], length=700, overlap=80)) >= 2]
    assert len(multi_chunk_docs) >= 20
    version2_docs = [d for d in docs.values() if d.get("version", 1) >= 2]
    assert len(version2_docs) >= 9

    deep_ordinal_cases = [
        q["caseId"]
        for q in v2_data["qrels"]
        if any(ev["ordinal"] >= 1 and ev["grade"] == 2 for ev in q.get("evidence", []))
    ]
    assert len(deep_ordinal_cases) >= 12

    multiturn_knowledge_cases = [
        c["caseId"]
        for c in v2_data["cases"]
        if c["conversationContext"] and qrels[c["caseId"]]["document"]
    ]
    assert len(multiturn_knowledge_cases) >= 10

    actors = {c["actorRef"] for c in v2_data["cases"]}
    assert any(a.startswith("merchant-clerk-read-") for a in actors)
    assert any(a.startswith("merchant-clerk-noread-") for a in actors)
    assert any(a.startswith("merchant-owner-") for a in actors)
    assert "platform-admin" in actors
    assert "buyer" in actors


def test_v2_draft_governance_and_challenge_split_execution(v2_data, tmp_path):
    review_check = validate_review(v2_data, v2_data["annotations"])
    assert review_check["status"] == "PENDING"
    assert review_check["expected"] == 360
    assert review_check["complete"] == 0
    assert review_check["pending"] == 360
    assert review_check["disputed"] == 22

    with pytest.raises(DatasetError, match="unreviewed"):
        load("campus-shopping-v2", formal=True)

    out_dir = tmp_path / "challenge-run"
    code = main([
        "--dataset", "campus-shopping-v2",
        "--split", "challenge",
        "--experiments", "R-RULE",
        "--output-dir", str(out_dir),
    ])
    assert code == 2
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in (out_dir / "cases.jsonl").read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 24
    assert all(r["status"] == "UNSUPPORTED" for r in rows)
    assert manifest["exitCode"] == 2
