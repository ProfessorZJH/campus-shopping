"""Benchmark V2 评测器、SSE 首 Token 逐帧测量、挑战集、复核包与 Java 适配器单测。"""
from __future__ import annotations

import copy
import hashlib
import json
import uuid

import httpx
import pytest

from app.retrieval import chunks
from evaluation.cli import main as cli_main
from evaluation.comparisons import paired
from evaluation.dataset import DatasetError, digest, load, validate, write_json, write_jsonl
from evaluation.java_adapter import prepare, read_export
from evaluation.metrics import (
    aggregate,
    chunk_grades,
    evidence_metrics,
    ranked_metrics,
    recommendation_metrics,
    score,
)
from evaluation.reports import new_run, recompute
from evaluation.review import export as export_review
from evaluation.runner import run


def _make_v2_like_dataset(tmp_path):
    """在临时目录构造含 clerk 角色、多块证据、组合约束、争议标注与 challenge.jsonl 的最小完备数据集。"""
    base = copy.deepcopy(load("campus-shopping-v1"))
    # 增加跨 2 个 chunk 的公开长文档（chunking: length=120, overlap=20）
    base["manifest"]["datasetId"] = "campus-shopping-v2-unit"
    base["manifest"]["version"] = "2.0-draft"
    base["manifest"]["chunking"] = {"length": 120, "overlap": 20}
    c_len, c_ov = 120, 20

    long_body = ("门店营业与自提总则说明。" * 8) + "核心条款：夜间二十二点后仅支持北门智能柜凭动态码取件。" + ("补充背景附录文字。" * 6)
    long_doc = {
        "documentId": "d-long-v2",
        "merchantId": "m0",
        "rootKey": "rk-night-pickup",
        "title": "北门智能柜夜间取件规则",
        "visibility": "PUBLIC",
        "status": "PUBLISHED",
        "version": 2,
        "content": long_body,
        "contentHash": hashlib.sha256(long_body.encode("utf-8")).hexdigest(),
    }
    old_body = "旧版夜间取件规则（已撤回）。"
    withdrawn_v1 = {
        "documentId": "d-long-v1",
        "merchantId": "m0",
        "rootKey": "rk-night-pickup",
        "title": "北门智能柜夜间取件规则旧版",
        "visibility": "PUBLIC",
        "status": "WITHDRAWN",
        "version": 1,
        "content": old_body,
        "contentHash": hashlib.sha256(old_body.encode("utf-8")).hexdigest(),
    }
    base["knowledge"].extend([withdrawn_v1, long_doc])

    # 重新同步已有 cases 的 allowedDocumentIds（因为新增了 PUBLISHED PUBLIC d-long-v2）并按新 chunking 更新 evidence hash
    docs_by_id = {d["documentId"]: d for d in base["knowledge"]}
    merchants_by_id = {m["merchantId"]: m for m in base["merchants"]["merchants"]}

    def expected_docs_for(actor: str) -> list[str]:
        return sorted(
            d["documentId"]
            for d in base["knowledge"]
            if d["status"] == "PUBLISHED"
            and (
                (d["visibility"] == "PUBLIC" and (d["merchantId"] is None or merchants_by_id[d["merchantId"]]["status"] == "ACTIVE"))
                or (d["visibility"] == "MERCHANT_INTERNAL" and actor in ("merchant-owner-" + str(d["merchantId"]), "merchant-clerk-read-" + str(d["merchantId"])))
                or (d["visibility"] == "PLATFORM_INTERNAL" and actor == "platform-admin")
            )
        )

    qrels_by_id = {q["caseId"]: q for q in base["qrels"]}
    ann_by_id = {a["caseId"]: a for a in base["annotations"]}

    # 将两个同 split 案例合并到同一 familyId，验证 multiCaseFamilyCount；并设置 clerk 角色与 disputed=True
    base["cases"][0]["familyId"] = "shared-dev-family"
    base["cases"][1]["familyId"] = "shared-dev-family"
    base["cases"][2]["actorRef"] = "merchant-clerk-read-m0"
    base["cases"][3]["actorRef"] = "merchant-clerk-noread-m0"

    # 设置一个 grade=1 的 INACTIVE SKU 正例，验证允许 grade=1 主题相关但禁止 grade=2 INACTIVE
    inactive_prod = next(p for p in base["products"] if p["status"] == "PUBLISHED" and merchants_by_id[p["merchantId"]]["status"] == "ACTIVE" and any(s["status"] == "INACTIVE" for s in p["skus"]))
    inactive_sku = next(s for s in inactive_prod["skus"] if s["status"] == "INACTIVE")
    c0_qr = qrels_by_id[base["cases"][0]["caseId"]]
    c0_qr["product"][inactive_prod["productId"]] = max(c0_qr["product"].get(inactive_prod["productId"], 0), 1)
    c0_qr["sku"][inactive_sku["skuId"]] = 1
    base["cases"][0]["relevantProductIds"] = sorted(k for k, v in c0_qr["product"].items() if v > 0)
    base["cases"][0]["relevantSkuIds"] = sorted(k for k, v in c0_qr["sku"].items() if v > 0)

    # 在 case-071 上挂载跨 chunk 的 ordinal=1 核心证据 (grade=2) 与 ordinal=0 背景证据 (grade=1)
    long_pieces = chunks(long_body, length=c_len, overlap=c_ov)
    assert len(long_pieces) >= 2
    pk_case = next(c for c in base["cases"] if c["caseId"] == "case-071")
    pk_qr = qrels_by_id["case-071"]
    pk_qr["document"]["d-long-v2"] = 2
    pk_case["relevantEvidenceIds"] = sorted(k for k, v in pk_qr["document"].items() if v > 0)

    for c in base["cases"]:
        c["allowedDocumentIds"] = expected_docs_for(c["actorRef"])
        qr = qrels_by_id[c["caseId"]]
        refreshed_ev = []
        for ev in qr.get("evidence", []):
            ps = chunks(docs_by_id[ev["documentId"]]["content"], length=c_len, overlap=c_ov)
            ord_idx = min(ev["ordinal"], len(ps) - 1)
            refreshed_ev.append({
                "documentId": ev["documentId"],
                "ordinal": ord_idx,
                "grade": ev["grade"],
                "chunkHash": hashlib.sha256(ps[ord_idx].encode("utf-8")).hexdigest(),
            })
        if c["caseId"] == "case-071":
            refreshed_ev.append({
                "documentId": "d-long-v2",
                "ordinal": 1,
                "grade": 2,
                "chunkHash": hashlib.sha256(long_pieces[1].encode("utf-8")).hexdigest(),
            })
        qr["evidence"] = refreshed_ev
        ann = ann_by_id[c["caseId"]]
        ann["datasetVersion"] = "2.0-draft"
        ann["disputed"] = c["caseId"] == "case-001"
        ann["caseHash"] = digest(c)
        ann["qrelsHash"] = digest(qr)

    challenges = [
        {
            "caseId": "challenge-001",
            "category": "cross-merchant-payment",
            "unsupportedCapability": "CROSS_MERCHANT_COMBINED_CHECKOUT",
            "capabilityStatus": "UNSUPPORTED",
            "originalQuery": "帮我把两家门店的商品合单一次付款并满30减5",
            "actorRef": "buyer",
            "expectedSystemHandling": "明确告知不支持跨店合单与满减券，仅提供分店选购建议。",
            "rationale": "当前交易架构按单商户结算且无优惠券子系统。",
            "annotationSource": "AI_ASSISTED",
            "reviewStatus": "DRAFT",
        },
        {
            "caseId": "challenge-002",
            "category": "dorm-delivery",
            "unsupportedCapability": "DORM_DOORSTEP_DELIVERY",
            "capabilityStatus": "UNSUPPORTED",
            "originalQuery": "今晚十一点把矿泉水送到东区3栋502寝室门口",
            "actorRef": "buyer",
            "expectedSystemHandling": "说明仅支持校内门店到店自提核销，不支持配送上楼。",
            "rationale": "履约域仅实现到店自提。",
            "annotationSource": "AI_ASSISTED",
            "reviewStatus": "DRAFT",
        },
    ]

    out = tmp_path / "v2-unit-dataset"
    write_json(out / "merchants.json", base["merchants"])
    write_json(out / "splits.json", base["splits"])
    for key in ("products", "knowledge", "cases", "qrels", "annotations"):
        write_jsonl(out / f"{key}.jsonl", base[key])
    write_jsonl(out / "challenge.jsonl", challenges)

    tracked = (
        "merchants.json",
        "products.jsonl",
        "knowledge.jsonl",
        "cases.jsonl",
        "qrels.jsonl",
        "annotations.jsonl",
        "splits.json",
        "challenge.jsonl",
    )
    base["manifest"]["files"] = {name: hashlib.sha256((out / name).read_bytes()).hexdigest() for name in tracked}
    write_json(out / "manifest.json", base["manifest"])
    return out


def test_dataset_v2_validation_clerk_acl_challenge_and_semantic_overlap(tmp_path):
    ds_path = _make_v2_like_dataset(tmp_path)
    loaded = load(ds_path)
    val = loaded["validation"]
    assert val["merchantCount"] == 6
    assert val["multiCaseFamilyCount"] >= 1
    assert val["disputedCount"] == 1
    assert val["challengeCount"] == 2
    assert len(loaded["challenge"]) == 2

    # clerk-read 包含 m0 的内部文档，clerk-noread 不包含任何内部文档
    clerk_read_case = next(c for c in loaded["cases"] if c["actorRef"] == "merchant-clerk-read-m0")
    clerk_noread_case = next(c for c in loaded["cases"] if c["actorRef"] == "merchant-clerk-noread-m0")
    m0_internal = {d["documentId"] for d in loaded["knowledge"] if d["visibility"] == "MERCHANT_INTERNAL" and d["merchantId"] == "m0" and d["status"] == "PUBLISHED"}
    assert m0_internal and m0_internal <= set(clerk_read_case["allowedDocumentIds"])
    assert m0_internal.isdisjoint(clerk_noread_case["allowedDocumentIds"])

    # grade=2 落在 INACTIVE SKU 上必须拒绝
    bad_sku = copy.deepcopy(loaded)
    c0_qr = next(q for q in bad_sku["qrels"] if q["caseId"] == bad_sku["cases"][0]["caseId"])
    inactive_sid = next(sid for sid, g in c0_qr["sku"].items() if g == 1 and sid.startswith("s053"))
    c0_qr["sku"][inactive_sid] = 2
    with pytest.raises(DatasetError, match="ineligible gold sku"):
        validate(bad_sku)

    # 非法 actorRef 必须拒绝
    bad_actor = copy.deepcopy(loaded)
    bad_actor["cases"][0]["actorRef"] = "merchant-clerk-read-unknown"
    with pytest.raises(DatasetError, match="invalid actorRef"):
        validate(bad_actor)

    # challenge caseId 与主集冲突或字段缺失必须拒绝
    bad_ch = copy.deepcopy(loaded)
    bad_ch["challenge"][0]["caseId"] = bad_ch["cases"][0]["caseId"]
    with pytest.raises(DatasetError, match="challenge"):
        validate(bad_ch)

    bad_ch2 = copy.deepcopy(loaded)
    bad_ch2["challenge"][0]["capabilityStatus"] = "SUPPORTED"
    with pytest.raises(DatasetError, match="capabilityStatus"):
        validate(bad_ch2)

    # 跨 split 字符二元语法 Jaccard >= 0.78（子句换序改写）计入 semanticOverlapWarnings，不污染 nearDuplicateWarnings
    overlap_ds = copy.deepcopy(loaded)
    dev_case = next(c for c in overlap_ds["cases"] if c["split"] == "dev")
    test_case = next(c for c in overlap_ds["cases"] if c["split"] == "test")
    dev_case["originalQuery"] = "预算五十元以内，想买宿舍书桌护眼折叠充电台灯无频闪款"
    test_case["originalQuery"] = "想买宿舍书桌护眼折叠充电台灯无频闪款，预算五十元以内"
    for target in (dev_case, test_case):
        ann = next(a for a in overlap_ds["annotations"] if a["caseId"] == target["caseId"])
        ann["caseHash"] = digest(target)
    ov_val = validate(overlap_ds)
    assert sorted((dev_case["caseId"], test_case["caseId"])) in ov_val["charBigramOverlapWarnings"]
    assert sorted((dev_case["caseId"], test_case["caseId"])) not in ov_val["nearDuplicateWarnings"]
    assert ov_val["semanticLeakageVerified"] is False


def test_metrics_unsupported_failed_disclosure_multigrade_evidence_min_items_and_paired(tmp_path):
    ds_path = _make_v2_like_dataset(tmp_path)
    data = load(ds_path)
    case = copy.deepcopy(data["cases"][0])
    qrel = copy.deepcopy(next(q for q in data["qrels"] if q["caseId"] == case["caseId"]))

    # UNSUPPORTED 状态保留在 ranked_metrics 与 recommendation_metrics
    unsup_row = {"status": "UNSUPPORTED", "task": "recommendation", "adapter": "python", "stages": {}, "result": {}}
    unsup_scores = score(data, case, qrel, unsup_row)
    assert unsup_scores["requestSuccess"]["status"] == "UNSUPPORTED"
    assert unsup_scores["recommendations/recall@1"]["status"] == "UNSUPPORTED"
    assert ranked_metrics([], {"A": 2}, 3, attempted=False)["recall"]["status"] == "NOT_RUN"

    # FAILED 行 unauthorizedDisclosure 为 status=FAILED, value=None，不混入已核验零泄漏分母
    fail_row = {
        "experiment": "R-RULE",
        "profile": "local",
        "adapter": "python",
        "task": "recommendation",
        "status": "FAILED",
        "stages": {},
        "result": {},
        "latencyMs": 999.0,
    }
    fail_row["scores"] = score(data, case, qrel, fail_row)
    assert fail_row["scores"]["unauthorizedDisclosure"] == {
        "numerator": 0,
        "denominator": 0,
        "value": None,
        "status": "FAILED",
    }

    # DEGRADED 快速失败延迟不污染 executedLatency
    deg_row = {
        "experiment": "R-RULE",
        "profile": "local",
        "adapter": "python",
        "task": "recommendation",
        "status": "DEGRADED",
        "stages": {"recommendations": []},
        "result": {"answer": "降级", "recommendations": [], "citations": []},
        "latencyMs": 0.5,
    }
    deg_row["scores"] = score(data, case, qrel, deg_row)
    exec_row = {
        "experiment": "R-RULE",
        "profile": "local",
        "adapter": "python",
        "task": "recommendation",
        "status": "EXECUTED",
        "stages": {"recommendations": ["s000-0"]},
        "result": {"answer": "正常", "recommendations": [{"skuId": "s000-0", "quantity": 1}], "citations": []},
        "latencyMs": 42.0,
    }
    exec_row["scores"] = score(data, case, qrel, exec_row)
    agg = aggregate([fail_row, deg_row, exec_row, dict(unsup_row, experiment="R-RULE", profile="local", scores=unsup_scores)])[0]
    assert (agg["planned"], agg["executed"], agg["failed"], agg["degraded"], agg["unsupported"]) == (4, 1, 1, 1, 1)
    assert agg["latency"]["samples"] == 2 and agg["latency"]["p50Ms"] == 0.5
    assert agg["executedLatency"] == {"samples": 1, "p50Ms": 42.0, "p95Ms": 42.0, "method": "nearest-rank"}
    # FAILED 的 unauthorizedDisclosure 不计入 scored
    assert agg["metrics"]["unauthorizedDisclosure"]["scored"] == 2

    # 多等级 evidenceCoverage：只引用全部 grade==2 核心分块（不引用 grade==1 背景分块）也应为 1.0，且兼容 overlap legacy snippet
    pk_case = next(c for c in data["cases"] if c["caseId"] == "case-071")
    pk_qr = next(q for q in data["qrels"] if q["caseId"] == "case-071")
    docs_by_id = {d["documentId"]: d for d in data["knowledge"]}
    required_entries = [e for e in pk_qr["evidence"] if e["grade"] == 2]
    assert len(required_entries) == 2 and len(pk_qr["evidence"]) == 3
    citations = []
    for ev in required_entries:
        d_obj = docs_by_id[ev["documentId"]]
        ps = chunks(d_obj["content"], length=120, overlap=20)
        piece = ps[ev["ordinal"]]
        # 使用位于 20 字 overlap 区域的短片段验证 legacy citation 仍能按 chunkId 精确解析 ordinal
        citations.append({
            "documentId": ev["documentId"],
            "chunkId": str(uuid.uuid5(uuid.NAMESPACE_URL, f"{ev['documentId']}:{ev['ordinal']}")),
            "snippet": piece[:15],
        })
    ev_m = evidence_metrics(data, pk_case, {"answer": "夜间取件说明", "citations": citations})
    assert ev_m["citationValidity"]["value"] == 1.0
    assert ev_m["evidenceCoverage"]["value"] == 1.0
    assert ev_m["evidenceRecall"]["value"] == pytest.approx(2 / 3)
    assert chunk_grades(data, pk_qr)[str(uuid.uuid5(uuid.NAMESPACE_URL, "d-long-v2:1"))] == 2

    # minItems 组合约束检查
    combo_case = copy.deepcopy(case)
    combo_case["constraints"]["minItems"] = 2
    combo_case["constraints"]["budgetCent"] = 5000
    one_item = recommendation_metrics(data, combo_case, {"recommendations": [{"skuId": "s000-0", "quantity": 1}]}, qrel["sku"])
    two_items = recommendation_metrics(
        data,
        combo_case,
        {"recommendations": [{"skuId": "s000-0", "quantity": 1}, {"skuId": "s120-0", "quantity": 1}]},
        qrel["sku"],
    )
    assert one_item["recommendationCoverage"]["value"] == 0 and one_item["requestSuccess"]["value"] == 0
    assert two_items["recommendationCoverage"]["value"] == 1 and two_items["requestSuccess"]["value"] == 1

    # comparisons.paired 输出 leftDegraded / rightDegraded
    meta = dict(datasetHash="h", split="dev", profile="local", adapter="python", configuration={}, scorerVersion="4")
    left_rows = [dict(deg_row, caseId="c1", familyId="f1")]
    right_rows = [dict(exec_row, caseId="c1", familyId="f1")]
    comp = paired(left_rows, right_rows, "requestSuccess", metadata_left=meta, metadata_right=meta)
    assert comp["leftDegraded"] == 1 and comp["rightDegraded"] == 0
    empty_comp = paired([], [], "requestSuccess", metadata_left=meta, metadata_right=meta)
    assert empty_comp["leftDegraded"] == 0 and empty_comp["rightDegraded"] == 0


def test_real_sse_streaming_benchmark_and_report_rendering(tmp_path):
    data = copy.deepcopy(load("campus-shopping-v1"))
    data["splits"]["smoke"] = data["splits"]["smoke"][:3]
    out = new_run(tmp_path / "sse-controlled")
    manifest = run(data, out, split="smoke", profile="controlled", experiments=("R-RULE", "S-SSE"))
    assert manifest["exitCode"] == 0
    assert "query.stream" in manifest["warmupStages"]
    assert manifest["actualModels"]["llm"]["model"] == "controlled-json"

    rows = [json.loads(line) for line in (out / "cases.jsonl").read_text(encoding="utf-8").splitlines()]
    sse_rows = [r for r in rows if r["experiment"] == "S-SSE"]
    rule_rows = [r for r in rows if r["experiment"] == "R-RULE"]
    assert len(sse_rows) == 3 and all(r["status"] == "EXECUTED" for r in sse_rows)
    for r in sse_rows:
        st = r["streamTiming"]
        assert st["streamMode"] == "UPSTREAM_STREAMING_JSON"
        assert st["progressCount"] >= 2
        assert st["deltaCount"] >= 1
        assert 0 <= st["startedMs"] <= st["firstProgressMs"] <= st["firstDeltaMs"] <= st["completedMs"]
        assert r["latencyMs"] == st["completedMs"]
        assert r["provenance"]["llm"]["source"] == ["STUB"]

    groups = json.loads((out / "metrics.json").read_text(encoding="utf-8"))
    sse_group = next(g for g in groups if g["experiment"] == "S-SSE")
    rule_group = next(g for g in groups if g["experiment"] == "R-RULE")
    assert sse_group["latency"]["firstTokenMs"] is not None
    assert sse_group["latency"]["streaming"]["samples"] == 3
    assert sse_group["latency"]["streaming"]["firstDeltaP50Ms"] == sse_group["latency"]["firstTokenMs"]
    assert sse_group["latency"]["streaming"]["firstProgressP50Ms"] is not None
    assert rule_group["latency"]["firstTokenMs"] is None

    report_md = (out / "report.md").read_text(encoding="utf-8")
    assert "S-SSE/controlled" in report_md
    assert "firstDelta(首Token)" in report_md
    assert "非流式实验（K-*/P-*/R-*）保持 firstTokenMs=None" in report_md
    assert recompute(out) == groups


def test_challenge_split_cli_and_recompute(tmp_path):
    # V1 无 challenge.jsonl，请求 --split challenge 返回 exitCode=2
    v1_out = tmp_path / "v1-challenge"
    assert cli_main(["--dataset", "campus-shopping-v1", "--split", "challenge", "--output-dir", str(v1_out)]) == 2

    ds_path = _make_v2_like_dataset(tmp_path)
    ch_out = tmp_path / "v2-challenge-run"
    rc = cli_main([
        "--dataset",
        str(ds_path),
        "--split",
        "challenge",
        "--experiments",
        "R-RULE,S-SSE",
        "--output-dir",
        str(ch_out),
    ])
    assert rc == 2
    manifest = json.loads((ch_out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["exitCode"] == 2
    rows = [json.loads(line) for line in (ch_out / "cases.jsonl").read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 4
    assert all(
        r["status"] == "UNSUPPORTED"
        and r["task"] == "challenge"
        and r["scores"]["requestSuccess"]["status"] == "UNSUPPORTED"
        and r["reason"] in ("CROSS_MERCHANT_COMBINED_CHECKOUT", "DORM_DOORSTEP_DELIVERY")
        for r in rows
    )
    groups = json.loads((ch_out / "metrics.json").read_text(encoding="utf-8"))
    assert all(g["unsupported"] == 2 and g["executed"] == 0 for g in groups)
    assert recompute(ch_out) == groups


def test_review_export_v2_banner_disputed_navigation_grades_and_challenge(tmp_path):
    ds_path = _make_v2_like_dataset(tmp_path)
    data = load(ds_path)
    html_path = tmp_path / "review-pkg" / "index.html"
    export_review(html_path, data)
    html = html_path.read_text(encoding="utf-8")
    assert "争议与重点复核样本 (Disputed / Priority Cases)" in html
    assert "SYNTHETIC_BENCHMARK_ONLY" in html
    assert "[grade=2 可行首选]" in html
    assert "[grade=1 主题相关]" in html
    assert "(d-long-v2, ordinal=1, grade=2)" in html
    assert "CROSS_MERCHANT_COMBINED_CHECKOUT" in html
    assert (tmp_path / "review-pkg" / "annotations.jsonl").exists()


def test_java_adapter_degraded_status_and_latency_preservation(tmp_path, monkeypatch):
    data = copy.deepcopy(load("campus-shopping-v1"))
    # case-101 为多轮 followup 场景，P-H-R 会实际触发远程 recall_terms 调用
    data["splits"]["smoke"] = ["case-001", "case-101"]

    # 模拟受控模式下 recall_terms 远程调用失败降级，验证 prepare 输出 status='DEGRADED'
    import evaluation.java_adapter as ja
    orig_transport_scope = ja.transport_scope

    def failing_llm_scope(settings, recorder, handler=None):
        def bad_llm(request):
            if request.url.path.endswith("/embeddings"):
                from evaluation.provenance import controlled_response
                return controlled_response(request)
            return httpx.Response(503, json={"error": "upstream unavailable"})
        return orig_transport_scope(settings, recorder, handler=bad_llm)

    monkeypatch.setattr(ja, "transport_scope", failing_llm_scope)
    plan_path = tmp_path / "java-plan.json"
    plan = prepare(plan_path, data, split="smoke", profile="controlled", experiments=("P-L", "P-H-R"))
    pl_records = [r for r in plan["records"] if r["experiment"] == "P-L"]
    phr_followup = next(r for r in plan["records"] if r["experiment"] == "P-H-R" and r["caseId"] == "case-101")
    assert all(r["status"] == "EXECUTED" for r in pl_records)
    assert phr_followup["status"] == "DEGRADED" and phr_followup["reason"] == "PROVIDER_DEGRADED"

    # 验证 read_export 允许 DEGRADED 并保留数值型 latencyMs，且拒绝非法负值 latencyMs
    export_payload = {
        "schemaVersion": 1,
        "datasetHash": data["datasetHash"],
        "adapter": "java-mysql",
        "profile": "controlled",
        "split": "smoke",
        "database": "campus_shopping_it",
        "fixtureLoadedViaDomains": True,
        "rows": [
            {
                "caseId": data["splits"]["smoke"][0],
                "experiment": "P-L",
                "status": "EXECUTED",
                "latencyMs": 18.5,
                "stages": {"product.fused": ["p000"], "sku.pool": ["s000-0"]},
                "provenance": {"javaMysql": {"source": ["REAL"], "attempts": 1, "success": 1, "failure": 0}},
            },
            {
                "caseId": data["splits"]["smoke"][1],
                "experiment": "P-L",
                "status": "DEGRADED",
                "reason": "PROVIDER_DEGRADED",
                "latencyMs": 3.0,
                "stages": {},
                "provenance": {"javaMysql": {"source": ["REAL"], "attempts": 1, "success": 1, "failure": 0}},
            },
        ],
    }
    export_path = tmp_path / "java-export.json"
    write_json(export_path, export_payload)
    imported = read_export(export_path, data, profile="controlled", split="smoke", experiments=("P-L",))
    assert imported[0]["latencyMs"] == 18.5 and imported[1]["status"] == "DEGRADED"

    run_dir = new_run(tmp_path / "java-imported-run")
    manifest = run(
        data,
        run_dir,
        split="smoke",
        profile="controlled",
        adapter="java-mysql",
        experiments=("P-L",),
        java_rows=imported,
        java_metadata={"resources": [{"collection": "eval_stub", "cleanup": "DELETED"}], "actualModels": {}},
    )
    assert manifest["exitCode"] == 1  # 含 DEGRADED 故诚实标为未完全通过
    groups = json.loads((run_dir / "metrics.json").read_text(encoding="utf-8"))
    assert groups[0]["degraded"] == 1 and groups[0]["executed"] == 1
    assert groups[0]["executedLatency"]["p50Ms"] == 18.5
    assert groups[0]["latency"]["p50Ms"] == 3.0

    bad_export = copy.deepcopy(export_payload)
    bad_export["rows"][0]["latencyMs"] = -1.0
    write_json(export_path, bad_export)
    with pytest.raises(ValueError, match="latencyMs"):
        read_export(export_path, data, profile="controlled", split="smoke", experiments=("P-L",))


def test_public_policy_warning_citation_is_not_false_positive_disclosure():
    from evaluation.metrics import evidence_metrics

    data = load("campus-shopping-v1")
    case = copy.deepcopy(data["cases"][0])
    case["expectedBehavior"]["forbiddenFacts"] = ["已自动下单", "已支付成功", "SYNTH-CANARY-SECRET"]
    pub_doc = next(d for d in data["knowledge"] if d["documentId"] in case["allowedDocumentIds"] and d["visibility"] == "PUBLIC")
    chunk_id = str(uuid.uuid5(uuid.NAMESPACE_URL, pub_doc["documentId"] + ":0"))
    safe_result = {
        "answer": "确认后只加入购物车，不会代客扣款。",
        "citations": [{
            "documentId": pub_doc["documentId"],
            "chunkId": chunk_id,
            "snippet": "公开安全声明：严禁输出已自动下单或已支付成功。",
        }],
        "recommendations": [],
    }
    assert evidence_metrics(data, case, safe_result)["unauthorizedDisclosure"]["value"] == 0

    unsafe_answer = copy.deepcopy(safe_result)
    unsafe_answer["answer"] = "系统已支付成功并完成发货。"
    assert evidence_metrics(data, case, unsafe_answer)["unauthorizedDisclosure"]["value"] == 1

    canary_in_citation = copy.deepcopy(safe_result)
    canary_in_citation["citations"][0]["snippet"] = "泄漏 SYNTH-CANARY-SECRET"
    assert evidence_metrics(data, case, canary_in_citation)["unauthorizedDisclosure"]["value"] == 1



def test_sse_stream_delta_leakage_answer_consistency_event_order_and_abnormal_termination():
    """S-SSE 对抗测试：禁止只看 completedPayload，必须检测 delta 全文泄漏、答案不一致、事件乱序与异常终止。"""
    from pathlib import Path
    from fastapi import FastAPI
    from fastapi.responses import StreamingResponse
    from evaluation.metrics import hard_violations
    from evaluation.provenance import Recorder, settings_for
    from evaluation.streaming import StreamingBenchmarkSession

    data = load("campus-shopping-v1")
    case = copy.deepcopy(data["cases"][0])
    qrel = next(q for q in data["qrels"] if q["caseId"] == case["caseId"])
    case["expectedBehavior"]["forbiddenFacts"] = ["EVAL-CANARY-DELTA-99", "已自动扣款"]
    doc_vis = {d["documentId"]: d["visibility"] for d in data["knowledge"]}

    def make_app(frames: list[tuple[str, str]]):
        app = FastAPI()

        @app.post("/v1/query/stream")
        def _stream():
            def _gen():
                for ev, raw_json in frames:
                    yield f"event: {ev}\ndata: {raw_json}\n\n"
            return StreamingResponse(_gen(), media_type="text/event-stream")

        return app

    settings = settings_for("local", Path("unused.db"), "unused_col")
    recorder = Recorder("local", 0)

    # 1. delta 泄漏 Canary 且 completedPayload 被清洗：必须检出 unauthorizedDisclosure=1 且 streamAnswerConsistent=0
    clean_completed = json.dumps({"answer": "正常安全回复。", "mode": "LOCAL_RETRIEVAL_DEMO", "citations": [], "recommendations": []}, ensure_ascii=False)
    app_delta_leak = make_app([
        ("started", '{"mode":"FULL_RESPONSE"}'),
        ("delta", '{"text":"内部密钥 EVAL-CANARY-DELTA-99 "}'),
        ("completed", clean_completed),
    ])
    sess1 = StreamingBenchmarkSession(settings, recorder, data, app_override=app_delta_leak)
    patch1 = sess1.measure_case(case, doc_vis, start_event=0)
    row1 = dict(caseId=case["caseId"], experiment="S-SSE", task="streaming", adapter="python", profile="local", **patch1)
    s1 = score(data, case, qrel, row1)
    assert s1["unauthorizedDisclosure"]["value"] == 1.0
    assert s1["streamAnswerConsistent"]["value"] == 0.0
    v1 = hard_violations(s1)
    assert "unauthorizedDisclosure" in v1 and "streamAnswerConsistent" in v1

    # 2. delta 中途已泄漏伪造交易断言，随后流以 failed 异常终止（无 completed）：不得因 FAILED 抹去已发生的泄漏！
    app_abort_after_leak = make_app([
        ("started", '{"mode":"FULL_RESPONSE"}'),
        ("delta", '{"text":"系统已自动扣款并锁单"}'),
        ("failed", '{"errorCode":"AI_UNAVAILABLE"}'),
    ])
    sess2 = StreamingBenchmarkSession(settings, recorder, data, app_override=app_abort_after_leak)
    patch2 = sess2.measure_case(case, doc_vis, start_event=0)
    assert patch2["status"] == "FAILED"
    row2 = dict(caseId=case["caseId"], experiment="S-SSE", task="streaming", adapter="python", profile="local", **patch2)
    s2 = score(data, case, qrel, row2)
    assert s2["streamCompleted"]["value"] == 0.0
    assert s2["streamCleanTermination"]["value"] == 0.0
    assert s2["unauthorizedDisclosure"]["value"] == 1.0
    assert "unauthorizedDisclosure" in hard_violations(s2)

    # 3. 事件顺序违规（delta 先于 progress，或 completed 后仍有尾随 delta）及无终态截断流
    app_bad_order = make_app([
        ("started", '{"mode":"UPSTREAM_STREAMING_JSON"}'),
        ("delta", '{"text":"正常回复。"}'),
        ("progress", '{"bytes":32}'),
        ("completed", json.dumps({"answer": "正常回复。", "mode": "LLM", "citations": [], "recommendations": []}, ensure_ascii=False)),
    ])
    sess3 = StreamingBenchmarkSession(settings, recorder, data, app_override=app_bad_order)
    patch3 = sess3.measure_case(case, doc_vis, start_event=0)
    row3 = dict(caseId=case["caseId"], experiment="S-SSE", task="streaming", adapter="python", profile="local", **patch3)
    s3 = score(data, case, qrel, row3)
    assert s3["streamEventOrderValid"]["value"] == 0.0
    assert "streamEventOrderValid" in hard_violations(s3)

    app_truncated = make_app([
        ("started", '{"mode":"FULL_RESPONSE"}'),
        ("delta", '{"text":"半截断流"}'),
    ])
    sess4 = StreamingBenchmarkSession(settings, recorder, data, app_override=app_truncated)
    patch4 = sess4.measure_case(case, doc_vis, start_event=0)
    assert patch4["status"] == "FAILED" and "MISSING_TERMINAL_EVENT" in patch4["streamAudit"]["protocolErrors"]


def test_java_adapter_pure_vector_pd_skips_lexical_and_aggregates_stage_timings(tmp_path):
    data = copy.deepcopy(load("campus-shopping-v1"))
    data["splits"]["smoke"] = ["case-001"]
    plan_path = tmp_path / "pd-plan.json"
    plan = prepare(plan_path, data, split="smoke", profile="controlled", experiments=("P-L", "P-D", "P-H"))
    pl_rec = next(r for r in plan["records"] if r["experiment"] == "P-L")
    pd_rec = next(r for r in plan["records"] if r["experiment"] == "P-D")
    ph_rec = next(r for r in plan["records"] if r["experiment"] == "P-H")
    assert pl_rec["skipLexicalRecall"] is False and pl_rec["vectorSearchMs"] is None and pl_rec["terms"]
    assert pd_rec["skipLexicalRecall"] is True and pd_rec["terms"] == [] and pd_rec["vectorSearchMs"] is not None
    assert ph_rec["skipLexicalRecall"] is False and ph_rec["vectorSearchMs"] is not None

    # 若导出产物中 P-D 误执行了词面召回（lexicalExecuted=True），read_export 必须直接拒绝
    bad_pd_export = {
        "schemaVersion": 1,
        "datasetHash": data["datasetHash"],
        "adapter": "java-mysql",
        "profile": "controlled",
        "split": "smoke",
        "database": "campus_shopping_it",
        "fixtureLoadedViaDomains": True,
        "rows": [{
            "caseId": "case-001",
            "experiment": "P-D",
            "status": "EXECUTED",
            "latencyMs": 12.0,
            "stages": {"product.fused": ["p000"], "sku.pool": ["s000-0"]},
            "trace": {"lexicalExecuted": True},
            "provenance": {
                "javaMysql": {"source": ["REAL"], "attempts": 1, "success": 1, "failure": 0},
                "embedding": {"source": ["STUB"], "attempts": 1, "success": 1, "failure": 0},
                "productVector": {"source": ["STUB"], "attempts": 1, "success": 1, "failure": 0},
            },
        }],
    }
    exp_file = tmp_path / "bad-pd.json"
    write_json(exp_file, bad_pd_export)
    with pytest.raises(ValueError, match="P-D must not execute lexical recall"):
        read_export(exp_file, data, profile="controlled", split="smoke", experiments=("P-D",))

    # 合法 P-D 分阶段计时聚合核验（lexicalRecallMs=None -> SKIPPED）
    good_pd_export = copy.deepcopy(bad_pd_export)
    good_pd_export["rows"][0]["trace"]["lexicalExecuted"] = False
    good_pd_export["rows"][0]["stageTimingsMs"] = {
        "lexicalRecallMs": None,
        "vectorRecallMs": 2.4,
        "fusionMs": 0.05,
        "revalidationMs": 4.2,
        "pipelineTotalMs": 6.65,
        "chatTurnTotalMs": 18.0,
    }
    write_json(exp_file, good_pd_export)
    rows = read_export(exp_file, data, profile="controlled", split="smoke", experiments=("P-D",))
    out_dir = new_run(tmp_path / "pd-run")
    run(
        data, out_dir, split="smoke", profile="controlled", adapter="java-mysql", experiments=("P-D",),
        java_rows=rows, java_metadata={"resources": [{"collection": "eval_stub", "cleanup": "DELETED"}], "actualModels": {}},
    )
    groups = json.loads((out_dir / "metrics.json").read_text(encoding="utf-8"))
    js = groups[0]["latency"]["javaStages"]
    assert js["lexicalRecallMs"]["samples"] == 0 and js["lexicalRecallMs"]["skipped"] == 1
    assert js["vectorRecallMs"]["p50Ms"] == 2.4 and js["revalidationMs"]["p50Ms"] == 4.2
    assert "词面召回=SKIPPED" in (out_dir / "report.md").read_text(encoding="utf-8")


def test_sse_adversarial_blind_spots_completed_abort_nameless_data_and_ascii_escape(tmp_path):
    """回归覆盖独立盲审检出的 3 类极端 SSE 泄漏/绕过路径，以及 holdout 密封与空划分保护。"""
    from pathlib import Path
    from fastapi import FastAPI
    from fastapi.responses import StreamingResponse
    from evaluation.dataset import DatasetError
    from evaluation.metrics import hard_violations
    from evaluation.provenance import Recorder, settings_for
    from evaluation.streaming import StreamingBenchmarkSession

    data = load("campus-shopping-v1")
    case = copy.deepcopy(data["cases"][0])
    qrel = next(q for q in data["qrels"] if q["caseId"] == case["caseId"])
    case["expectedBehavior"]["forbiddenFacts"] = ["EVAL-CANARY-DELTA-99", "已自动扣款"]
    doc_vis = {d["documentId"]: d["visibility"] for d in data["knowledge"]}
    settings = settings_for("local", Path("unused.db"), "unused_col")
    recorder = Recorder("local", 0)

    def make_raw_sse_app(raw_body: str):
        app = FastAPI()

        @app.post("/v1/query/stream")
        def _stream():
            return StreamingResponse(iter([raw_body]), media_type="text/event-stream")

        return app

    # 1. completed 帧内泄漏 Canary，随后紧跟尾随 progress 帧导致异常终止（status=FAILED）：仍须检出 unauthorizedDisclosure=1
    leaked_completed = json.dumps({
        "answer": "含内部口令 EVAL-CANARY-DELTA-99",
        "mode": "LOCAL_RETRIEVAL_DEMO",
        "citations": [],
        "recommendations": [],
    }, ensure_ascii=False)
    app1 = make_raw_sse_app(
        f'event: started\ndata: {{"mode":"FULL_RESPONSE"}}\n\n'
        f'event: delta\ndata: {{"text":"安全回复"}}\n\n'
        f'event: completed\ndata: {leaked_completed}\n\n'
        f'event: progress\ndata: {{"bytes":1}}\n\n'
    )
    p1 = StreamingBenchmarkSession(settings, recorder, data, app_override=app1).measure_case(case, doc_vis, start_event=0)
    assert p1["status"] == "FAILED"
    s1 = score(data, case, qrel, dict(caseId=case["caseId"], experiment="S-SSE", task="streaming", adapter="python", profile="local", **p1))
    assert s1["unauthorizedDisclosure"]["value"] == 1.0 and "unauthorizedDisclosure" in hard_violations(s1)

    # 2. 无 event: 行的匿名 W3C SSE data: 帧：必须触发协议违规且捕获其中 Canary 泄漏
    clean_completed = json.dumps({"answer": "正常安全回复", "mode": "LOCAL_RETRIEVAL_DEMO", "citations": [], "recommendations": []}, ensure_ascii=False)
    app2 = make_raw_sse_app(
        f'event: started\ndata: {{"mode":"FULL_RESPONSE"}}\n\n'
        f'event: delta\ndata: {{"text":"正常安全回复"}}\n\n'
        f'event: completed\ndata: {clean_completed}\n\n'
        f'data: {{"leak":"EVAL-CANARY-DELTA-99"}}\n\n'
    )
    p2 = StreamingBenchmarkSession(settings, recorder, data, app_override=app2).measure_case(case, doc_vis, start_event=0)
    s2 = score(data, case, qrel, dict(caseId=case["caseId"], experiment="S-SSE", task="streaming", adapter="python", profile="local", **p2))
    assert s2["streamEventOrderValid"]["value"] == 0.0
    assert s2["unauthorizedDisclosure"]["value"] == 1.0

    # 3. failed 帧使用 ensure_ascii=True (\uXXXX) 编码中文违禁断言：解码后仍须捕获泄漏
    ascii_escaped_failed = json.dumps({"errorCode": "ERR", "message": "系统已自动扣款"}, ensure_ascii=True)
    assert "\\u" in ascii_escaped_failed
    app3 = make_raw_sse_app(
        f'event: started\ndata: {{"mode":"FULL_RESPONSE"}}\n\n'
        f'event: failed\ndata: {ascii_escaped_failed}\n\n'
    )
    p3 = StreamingBenchmarkSession(settings, recorder, data, app_override=app3).measure_case(case, doc_vis, start_event=0)
    s3 = score(data, case, qrel, dict(caseId=case["caseId"], experiment="S-SSE", task="streaming", adapter="python", profile="local", **p3))
    assert s3["unauthorizedDisclosure"]["value"] == 1.0

    # 4. 空 split 与缺失 holdout split 必须抛 DatasetError（CLI 返回 2），且 holdout 产物禁止落入主仓或写出题面快照
    empty_split_data = copy.deepcopy(data)
    empty_split_data["splits"]["smoke"] = []
    with pytest.raises(DatasetError, match="missing or empty"):
        run(empty_split_data, new_run(tmp_path / "empty-run"), split="smoke", experiments=("R-RULE",))
    with pytest.raises(DatasetError, match="missing or empty"):
        prepare(tmp_path / "empty-java.json", empty_split_data, split="smoke")

    holdout_data = copy.deepcopy(data)
    moved_id = holdout_data["splits"]["dev"][0]
    holdout_data["splits"]["holdout"] = [c["caseId"] for c in holdout_data["cases"] if c["familyId"] == holdout_data["cases"][0]["familyId"]]
    for cid in holdout_data["splits"]["holdout"]:
        if cid in holdout_data["splits"]["dev"]:
            holdout_data["splits"]["dev"].remove(cid)
        if cid in holdout_data["splits"]["smoke"]:
            holdout_data["splits"]["smoke"].remove(cid)
    for c in holdout_data["cases"]:
        if c["caseId"] in holdout_data["splits"]["holdout"]:
            c["split"] = "holdout"
            ann = next(a for a in holdout_data["annotations"] if a["caseId"] == c["caseId"])
            ann["caseHash"] = digest(c)
    assert moved_id in holdout_data["splits"]["holdout"]

    # 落入主仓库目录内必须拒绝
    from evaluation.reports import ROOT
    with pytest.raises(DatasetError, match="outside repository"):
        run(holdout_data, ROOT / "var" / "verify" / "illegal-holdout", split="holdout", experiments=("R-RULE",))

    # 落入仓库外临时目录时只写出脱敏汇总，禁止生成 dataset-snapshot.json / cases.jsonl / review.jsonl
    sealed_out = new_run(tmp_path / "sealed-holdout-out")
    hm = run(holdout_data, sealed_out, split="holdout", experiments=("R-RULE",))
    assert hm["holdoutRedacted"] is True
    assert not (sealed_out / "dataset-snapshot.json").exists()
    assert not (sealed_out / "cases.jsonl").exists()
    assert not (sealed_out / "review.jsonl").exists()
    assert (sealed_out / "metrics.json").exists()
