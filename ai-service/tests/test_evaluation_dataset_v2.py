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
    assert val["charBigramOverlapWarnings"] == []
    assert val["leakageDetectionScope"] == "LEXICAL_CHAR_SIMILARITY_AND_DECLARED_FAMILY_ONLY"
    assert val["semanticLeakageVerified"] is False
    assert val["purchaseModes"] == {"SINGLE": 177, "ALTERNATIVES": 78, "BUNDLE": 12, "NONE": 93}

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


def test_case_v2_071_bundle_rejects_two_toasts_without_oat_milk_and_distinguishes_modes(v2_data):
    """真实数据反例测试：case-v2-071 要求全麦吐司+植物燕麦奶组合（<=25元），推荐两款吐司缺燕麦奶必须判 0 分。"""
    import copy
    from evaluation.metrics import recommendation_metrics, sku_map

    case_071 = next(c for c in v2_data["cases"] if c["caseId"] == "case-v2-071")
    qrel_071 = next(q for q in v2_data["qrels"] if q["caseId"] == "case-v2-071")
    facts = sku_map(v2_data)

    assert case_071["constraints"]["purchaseMode"] == "BUNDLE"
    req_groups = case_071["constraints"]["requiredGroups"]
    assert [g["groupId"] for g in req_groups] == ["whole_wheat_toast", "oat_milk"]

    toast_group = next(g for g in req_groups if g["groupId"] == "whole_wheat_toast")
    oat_group = next(g for g in req_groups if g["groupId"] == "oat_milk")
    toast_skus = sorted(toast_group["skuIds"], key=lambda sid: facts[sid]["priceCent"])
    oat_skus = sorted(oat_group["skuIds"], key=lambda sid: facts[sid]["priceCent"])
    assert len(toast_skus) >= 2 and len(oat_skus) >= 1
    assert facts[toast_skus[0]]["priceCent"] + facts[toast_skus[1]]["priceCent"] <= case_071["constraints"]["budgetCent"]

    # 反例：两款合规且各自 grade=2 的吐司（合计 <= 2500 分），但缺少燕麦奶必选商品组
    two_toasts_missing_oat = recommendation_metrics(
        v2_data,
        case_071,
        {"recommendations": [{"skuId": toast_skus[0], "quantity": 1}, {"skuId": toast_skus[1], "quantity": 1}]},
        qrel_071["sku"],
    )
    assert two_toasts_missing_oat["constraintPass"]["value"] == 1.0
    assert two_toasts_missing_oat["constraint.budget"]["value"] == 1.0
    assert two_toasts_missing_oat["bundleGroupCoverage"]["value"] == pytest.approx(0.5)
    assert two_toasts_missing_oat["recommendationCoverage"]["value"] == 0.0
    assert two_toasts_missing_oat["requestSuccess"]["value"] == 0.0

    # 正例：1 款合规吐司 + 1 款合规燕麦奶（合计 <= 2500 分），完整覆盖全部必选商品组
    valid_bundle = recommendation_metrics(
        v2_data,
        case_071,
        {"recommendations": [{"skuId": toast_skus[0], "quantity": 1}, {"skuId": oat_skus[0], "quantity": 1}]},
        qrel_071["sku"],
    )
    assert valid_bundle["bundleGroupCoverage"]["value"] == 1.0
    assert valid_bundle["recommendationCoverage"]["value"] == 1.0
    assert valid_bundle["requestSuccess"]["value"] == 1.0

    # 混入无关商品（grade=0）凑数时即使已含吐司+燕麦奶也不得判覆盖通过
    unrelated_sid = next(
        sid for sid, f in facts.items()
        if sid not in qrel_071["sku"] and f["productStatus"] == "PUBLISHED" and f["merchantStatus"] == "ACTIVE"
        and f["status"] == "ACTIVE" and f["onHand"] - f["reserved"] >= 1
        and facts[toast_skus[0]]["priceCent"] + facts[oat_skus[0]]["priceCent"] + f["priceCent"] <= 2500
    )
    padded_bundle = recommendation_metrics(
        v2_data,
        case_071,
        {
            "recommendations": [
                {"skuId": toast_skus[0], "quantity": 1},
                {"skuId": oat_skus[0], "quantity": 1},
                {"skuId": unrelated_sid, "quantity": 1},
            ]
        },
        qrel_071["sku"],
    )
    assert padded_bundle["recommendationCoverage"]["value"] == 0.0
    assert padded_bundle["requestSuccess"]["value"] == 0.0

    # 对抗反例 2：即使已含 1 款吐司 + 1 款燕麦奶，若额外塞入第 2 款同组吐司（3 件加购，违背组合各 1 件语义）或混入 grade=1 纯牛奶，也必须判 0 分
    extra_toast_bundle = recommendation_metrics(
        v2_data,
        case_071,
        {
            "recommendations": [
                {"skuId": toast_skus[0], "quantity": 1},
                {"skuId": oat_skus[0], "quantity": 1},
                {"skuId": toast_skus[1], "quantity": 1},
            ]
        },
        qrel_071["sku"],
    )
    assert extra_toast_bundle["recommendationCoverage"]["value"] == 0.0
    assert extra_toast_bundle["requestSuccess"]["value"] == 0.0

    g1_dairy_sid = next(
        sid for sid, g in qrel_071["sku"].items()
        if g == 1 and facts[sid]["status"] == "ACTIVE" and facts[sid]["onHand"] > facts[sid]["reserved"]
        and facts[toast_skus[0]]["priceCent"] + facts[oat_skus[0]]["priceCent"] + facts[sid]["priceCent"] <= 2500
    )
    riding_g1_bundle = recommendation_metrics(
        v2_data,
        case_071,
        {
            "recommendations": [
                {"skuId": toast_skus[0], "quantity": 1},
                {"skuId": oat_skus[0], "quantity": 1},
                {"skuId": g1_dairy_sid, "quantity": 1},
            ]
        },
        qrel_071["sku"],
    )
    assert riding_g1_bundle["recommendationCoverage"]["value"] == 0.0
    assert riding_g1_bundle["requestSuccess"]["value"] == 0.0

    # 未知 SKU 在有预算约束时不得当成 0 元通过 constraint.budget
    unknown_budget = recommendation_metrics(
        v2_data,
        case_071,
        {"recommendations": [{"skuId": "nonexistent-sku", "quantity": 1}]},
        qrel_071["sku"],
    )
    assert unknown_budget["constraint.budget"]["value"] == 0.0

    # 对比 SINGLE（单品采购）与 ALTERNATIVES（备选推荐）评分语义
    single_case = next(c for c in v2_data["cases"] if c["caseId"] == "case-v2-161")
    single_qr = next(q for q in v2_data["qrels"] if q["caseId"] == "case-v2-161")
    assert single_case["constraints"]["purchaseMode"] == "SINGLE"
    g2_single = [sid for sid, g in single_qr["sku"].items() if g == 2]
    g1_single = [sid for sid, g in single_qr["sku"].items() if g == 1 and facts[sid]["status"] == "ACTIVE" and facts[sid]["onHand"] > facts[sid]["reserved"]]
    # SINGLE 模式：返回唯一最优单品得 1 分，多推次优门店同款得 0 分
    assert recommendation_metrics(
        v2_data, single_case, {"recommendations": [{"skuId": g2_single[0], "quantity": 1}]}, single_qr["sku"]
    )["requestSuccess"]["value"] == 1.0
    multi_for_single = recommendation_metrics(
        v2_data,
        single_case,
        {"recommendations": [{"skuId": g2_single[0], "quantity": 1}, {"skuId": g1_single[0], "quantity": 1}]},
        single_qr["sku"],
    )
    assert multi_for_single["singleItemExact"]["value"] == 0.0
    assert multi_for_single["recommendationCoverage"]["value"] == 0.0
    assert multi_for_single["requestSuccess"]["value"] == 0.0

    # ALTERNATIVES 模式：允许返回 2 个各自不超单品预算的相关备选方案（含 >=1 个 grade=2），不按整单累加误杀预算
    alt_case = copy.deepcopy(next(
        c for c in v2_data["cases"]
        if c["constraints"].get("purchaseMode") == "ALTERNATIVES"
        and c["expectedBehavior"]["action"] == "RECOMMEND"
        and c["constraints"].get("budgetCent") is not None
    ))
    alt_qr = next(q for q in v2_data["qrels"] if q["caseId"] == alt_case["caseId"])
    alt_g2 = sorted([sid for sid, g in alt_qr["sku"].items() if g == 2], key=lambda s: facts[s]["priceCent"], reverse=True)
    assert len(alt_g2) >= 2
    alt_case["constraints"]["budgetCent"] = facts[alt_g2[0]]["priceCent"]
    pair_sum = facts[alt_g2[0]]["priceCent"] + facts[alt_g2[1]]["priceCent"]
    assert pair_sum > alt_case["constraints"]["budgetCent"]
    alt_ok = recommendation_metrics(
        v2_data,
        alt_case,
        {"recommendations": [{"skuId": alt_g2[0], "quantity": 1}, {"skuId": alt_g2[1], "quantity": 1}]},
        alt_qr["sku"],
    )
    assert alt_ok["constraint.budget"]["value"] == 1.0
    assert alt_ok["recommendationCoverage"]["value"] == 1.0
    assert alt_ok["requestSuccess"]["value"] == 1.0


def test_holdout_split_isolation_guard(v2_data):
    import copy
    from evaluation.dataset import digest

    broken = copy.deepcopy(v2_data)
    victim = broken["cases"][0]
    broken["splits"]["holdout"] = [victim["caseId"]]
    with pytest.raises(DatasetError, match="holdout split overlap"):
        validate(broken)

    # 独立 holdout 案例若复用 dev 家族必须拦截
    fam_leak = copy.deepcopy(v2_data)
    moved = fam_leak["cases"][0]
    fam_leak["splits"]["dev"].remove(moved["caseId"])
    if moved["caseId"] in fam_leak["splits"]["smoke"]:
        fam_leak["splits"]["smoke"].remove(moved["caseId"])
    fam_leak["splits"]["holdout"] = [moved["caseId"]]
    moved["split"] = "holdout"
    ann = next(a for a in fam_leak["annotations"] if a["caseId"] == moved["caseId"])
    ann["caseHash"] = digest(moved)
    with pytest.raises(DatasetError, match="family split leakage"):
        validate(fam_leak)
