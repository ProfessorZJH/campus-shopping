"""Benchmark V2 全语料确定性 Gold 求解器。

严格独立于被测系统（不调用 app.engine / app.retrieval 排序逻辑）：
直接对完整 480 商品、1,020 SKU 与 80 篇知识文档分块执行布尔真值与硬约束求解，
区分主题相关性（grade=1）与满足全部硬约束的可行推荐/核心证据（grade=2）。
"""
from __future__ import annotations

import hashlib
from collections import Counter
from difflib import SequenceMatcher
from typing import Any

from app.retrieval import chunks
from evaluation.dataset import digest
from .taxonomy import ACTIVE_MERCHANT_IDS, CATEGORY_QUOTAS

CHUNK_LENGTH = 700
CHUNK_OVERLAP = 80


def compute_allowed_documents(
    actor_ref: str,
    knowledge_rows: list[dict[str, Any]],
    merchants_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    """按服务端 RBAC 与发布状态确定性计算当前角色可读文档集合。"""
    allowed: list[str] = []
    for doc in knowledge_rows:
        if doc["status"] != "PUBLISHED":
            continue
        vis = doc["visibility"]
        mid = doc["merchantId"]
        if vis == "PUBLIC":
            if mid is None or merchants_by_id[mid]["status"] == "ACTIVE":
                allowed.append(doc["documentId"])
        elif vis == "MERCHANT_INTERNAL":
            if actor_ref in (f"merchant-owner-{mid}", f"merchant-clerk-read-{mid}"):
                allowed.append(doc["documentId"])
        elif vis == "PLATFORM_INTERNAL":
            if actor_ref == "platform-admin":
                allowed.append(doc["documentId"])
    return sorted(allowed)


def _sku_satisfies_constraints(
    sku: dict[str, Any],
    constraints: dict[str, Any],
    gold_req_attrs: dict[str, str] | None = None,
    gold_forb_attrs: dict[str, str] | None = None,
) -> bool:
    if sku["status"] != "ACTIVE":
        return False
    qty = constraints.get("quantity")
    req_qty = qty if isinstance(qty, int) and 1 <= qty <= 99 else 1
    available = sku["onHand"] - sku["reserved"]
    if available < req_qty:
        return False
    attrs = sku.get("attributes") or {}
    merged_req = {**(gold_req_attrs or {}), **(constraints.get("requiredAttributes") or {})}
    merged_forb = {**(gold_forb_attrs or {}), **(constraints.get("forbiddenAttributes") or {})}
    for k, v in merged_req.items():
        if attrs.get(k) != v:
            return False
    for k, v in merged_forb.items():
        if attrs.get(k) == v:
            return False
    budget = constraints.get("budgetCent")
    if budget is not None and sku["priceCent"] * req_qty > budget:
        return False
    return True


def solve_dataset_gold(
    *,
    merchants_payload: dict[str, Any],
    products: list[dict[str, Any]],
    product_meta: dict[str, dict[str, Any]],
    knowledge: list[dict[str, Any]],
    knowledge_meta: dict[str, dict[str, Any]],
    blueprints: list[dict[str, Any]],
    dataset_version: str,
    annotation_version: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, list[str]], dict[str, Any]]:
    """对 360 条场景蓝图执行全语料 Gold 求解与跨划分防泄漏核验。"""
    if len(blueprints) != 360:
        raise ValueError(f"Expected 360 blueprints, got {len(blueprints)}")

    merchants_by_id = {m["merchantId"]: m for m in merchants_payload["merchants"]}
    docs_by_id = {d["documentId"]: d for d in knowledge}
    doc_chunks: dict[str, list[str]] = {
        d["documentId"]: chunks(d["content"], length=CHUNK_LENGTH, overlap=CHUNK_OVERLAP)
        for d in knowledge
    }

    # 按固定分类顺序与输入顺序编号 case-v2-001..360，确保跨运行完全确定
    category_order = list(CATEGORY_QUOTAS.keys())
    ordered_blueprints = sorted(
        enumerate(blueprints),
        key=lambda pair: (category_order.index(pair[1]["queryType"]), pair[0]),
    )

    cases: list[dict[str, Any]] = []
    qrels: list[dict[str, Any]] = []
    annotations: list[dict[str, Any]] = []
    splits: dict[str, list[str]] = {"dev": [], "test": [], "smoke": []}

    cat_split_counts: dict[str, Counter] = {c: Counter() for c in category_order}

    for idx, (_, bp) in enumerate(ordered_blueprints, start=1):
        cid = f"case-v2-{idx:03d}"
        qtype = bp["queryType"]
        split = bp["split"]
        is_smoke = bool(bp.get("smoke", False))
        cat_split_counts[qtype]["total"] += 1
        cat_split_counts[qtype][split] += 1
        if is_smoke:
            if split != "dev":
                raise ValueError(f"{cid}: smoke case must belong to dev split")
            cat_split_counts[qtype]["smoke"] += 1
            splits["smoke"].append(cid)
        splits[split].append(cid)

        actor_ref = bp["actorRef"]
        allowed_merchants = list(ACTIVE_MERCHANT_IDS)
        allowed_docs = compute_allowed_documents(actor_ref, knowledge, merchants_by_id)
        allowed_doc_set = set(allowed_docs)

        constraints = dict(bp["constraints"])
        expected_behavior = dict(bp["expectedBehavior"])
        action = expected_behavior["action"]
        spec = bp["goldSpec"]

        target_archs = list(spec.get("targetArchetypes") or [])
        combo_archs = list(spec.get("comboArchetypes") or [])
        secondary_archs = list(spec.get("secondaryArchetypes") or [])
        preferred_merchants = set(spec["preferredMerchantIds"]) if spec.get("preferredMerchantIds") else None
        prefer_cheapest = bool(spec.get("preferCheapest", False))
        force_no_match = bool(spec.get("forceNoMatch", False))

        primary_arch_set = set(target_archs) | set(combo_archs)
        secondary_arch_set = set(secondary_archs) - primary_arch_set

        product_grades: dict[str, int] = {}
        sku_grades: dict[str, int] = {}

        # 全量扫描 480 款商品与 1,020 个 SKU
        if primary_arch_set or secondary_arch_set:
            eligible_published_products = [
                p for p in products
                if p["status"] == "PUBLISHED"
                and p["merchantId"] in allowed_merchants
                and merchants_by_id[p["merchantId"]]["status"] == "ACTIVE"
            ]

            if action == "RECOMMEND" and not force_no_match:
                qty = constraints.get("quantity")
                req_qty = qty if isinstance(qty, int) and 1 <= qty <= 99 else 1
                budget = constraints.get("budgetCent")

                # 预计算所有满足基础硬约束的主原型 SKU
                feasible_by_arch: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = {
                    a: [] for a in primary_arch_set
                }
                for p in eligible_published_products:
                    arch = product_meta[p["productId"]]["archetype"]
                    if arch not in primary_arch_set:
                        continue
                    for s in p["skus"]:
                        if _sku_satisfies_constraints(
                            s,
                            constraints,
                            spec.get("goldRequiredAttributes"),
                            spec.get("goldForbiddenAttributes"),
                        ):
                            feasible_by_arch[arch].append((p, s))

                # 组合预算场景（A + B 合计 <= budgetCent）精确复核搭档最低成本
                combo_group = list(dict.fromkeys(target_archs + combo_archs))
                is_combo = bool(combo_archs) and len(combo_group) >= 2
                if is_combo and budget is not None:
                    min_cost_by_arch: dict[str, int] = {}
                    for a in combo_group:
                        candidates_a = feasible_by_arch.get(a, [])
                        if not candidates_a:
                            raise ValueError(f"{cid}: combo archetype {a} has no feasible SKUs")
                        min_cost_by_arch[a] = min(s["priceCent"] * req_qty for _, s in candidates_a)
                    filtered_by_arch: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = {}
                    for a in combo_group:
                        other_min = sum(min_cost_by_arch[o] for o in combo_group if o != a)
                        filtered_by_arch[a] = [
                            (p, s) for p, s in feasible_by_arch[a]
                            if s["priceCent"] * req_qty + other_min <= budget
                        ]
                    feasible_by_arch = filtered_by_arch

                grade2_sku_ids: set[str] = set()
                for a, pairs in feasible_by_arch.items():
                    selected_pairs = pairs
                    if preferred_merchants is not None:
                        pref = [(p, s) for p, s in selected_pairs if p["merchantId"] in preferred_merchants]
                        if pref:
                            selected_pairs = pref
                    if prefer_cheapest and selected_pairs:
                        min_price = min(s["priceCent"] for _, s in selected_pairs)
                        # 同最低价梯队（容许 <=8% 或 <=80 分微差并列最优，跨店明显高价款降为 grade=1）
                        ceiling = min_price + max(80, int(min_price * 0.08))
                        selected_pairs = [(p, s) for p, s in selected_pairs if s["priceCent"] <= ceiling]
                    for _, s in selected_pairs:
                        grade2_sku_ids.add(s["skuId"])

                if not grade2_sku_ids:
                    raise ValueError(f"{cid} ({qtype}): RECOMMEND case produced 0 grade=2 SKUs across full corpus")
                if constraints.get("minItems", 1) and int(constraints.get("minItems", 1)) > 1:
                    if len(grade2_sku_ids) < int(constraints["minItems"]):
                        raise ValueError(f"{cid}: fewer grade=2 SKUs than minItems")

                for p in eligible_published_products:
                    pid = p["productId"]
                    arch = product_meta[pid]["archetype"]
                    if arch in primary_arch_set:
                        has_g2 = False
                        for s in p["skus"]:
                            if s["skuId"] in grade2_sku_ids:
                                sku_grades[s["skuId"]] = 2
                                has_g2 = True
                            else:
                                # 同原型但因规格/库存/价格梯队未入选首选的 SKU 记为主题相关 grade=1
                                sku_grades[s["skuId"]] = 1
                        product_grades[pid] = 2 if has_g2 else 1
                    elif arch in secondary_arch_set:
                        product_grades[pid] = 1
                        for s in p["skus"]:
                            if s["status"] == "ACTIVE":
                                sku_grades[s["skuId"]] = 1
            else:
                # NO_MATCH / CLARIFY / KNOWLEDGE_ONLY（带背景原型时）：仅标注主题相关 grade=1，绝不赋予可行推荐 grade=2
                if action != "KNOWLEDGE_ONLY":
                    for p in eligible_published_products:
                        pid = p["productId"]
                        arch = product_meta[pid]["archetype"]
                        if arch in primary_arch_set or arch in secondary_arch_set:
                            product_grades[pid] = 1
                            for s in p["skus"]:
                                sku_grades[s["skuId"]] = 1

        # 全语料知识文档与分块证据求解
        doc_grades: dict[str, int] = {}
        evidence_map: dict[tuple[str, int], int] = {}

        for did, ordinal in (spec.get("primaryEvidence") or []):
            if did not in docs_by_id:
                raise ValueError(f"{cid}: unknown primaryEvidence doc {did}")
            if did not in allowed_doc_set:
                raise ValueError(f"{cid}: primaryEvidence doc {did} is not authorized for actor {actor_ref}")
            pieces = doc_chunks[did]
            if not (0 <= ordinal < len(pieces)):
                raise ValueError(f"{cid}: invalid chunk ordinal {ordinal} for {did} (len={len(pieces)})")
            doc_grades[did] = 2
            evidence_map[(did, ordinal)] = 2

        for did, ordinal in (spec.get("secondaryEvidence") or []):
            if did not in docs_by_id:
                raise ValueError(f"{cid}: unknown secondaryEvidence doc {did}")
            if did not in allowed_doc_set:
                continue
            pieces = doc_chunks[did]
            if not (0 <= ordinal < len(pieces)):
                raise ValueError(f"{cid}: invalid secondary chunk ordinal {ordinal} for {did}")
            doc_grades[did] = max(doc_grades.get(did, 0), 1)
            evidence_map[(did, ordinal)] = max(evidence_map.get((did, ordinal), 0), 1)

        evidence_list = [
            {
                "documentId": did,
                "ordinal": ordinal,
                "grade": grade,
                "chunkHash": hashlib.sha256(doc_chunks[did][ordinal].encode("utf-8")).hexdigest(),
            }
            for (did, ordinal), grade in sorted(evidence_map.items())
        ]

        task_scopes = list(bp["taskScopes"])
        if doc_grades and "knowledge" not in task_scopes:
            task_scopes.append("knowledge")

        case_row = {
            "caseId": cid,
            "familyId": bp["familyId"],
            "queryType": qtype,
            "tags": list(bp["tags"]),
            "split": split,
            "taskScopes": task_scopes,
            "originalQuery": bp["originalQuery"],
            "conversationContext": list(bp["conversationContext"]),
            "actorRef": actor_ref,
            "allowedMerchantIds": allowed_merchants,
            "allowedDocumentIds": allowed_docs,
            "intentGold": dict(bp["intentGold"]),
            "relevantProductIds": sorted(k for k, v in product_grades.items() if v > 0),
            "relevantSkuIds": sorted(k for k, v in sku_grades.items() if v > 0),
            "relevantEvidenceIds": sorted(k for k, v in doc_grades.items() if v > 0),
            "constraints": constraints,
            "expectedBehavior": expected_behavior,
            "stateTransition": bp["stateTransition"],
            "sensitive": bool(bp["sensitive"]),
            "annotatorVersion": annotation_version,
        }

        qrel_row = {
            "caseId": cid,
            "product": dict(sorted(product_grades.items())),
            "sku": dict(sorted(sku_grades.items())),
            "document": dict(sorted(doc_grades.items())),
            "evidence": evidence_list,
        }

        ann_row = {
            "caseId": cid,
            "datasetVersion": dataset_version,
            "caseHash": digest(case_row),
            "qrelsHash": digest(qrel_row),
            "annotationSource": "AI_ASSISTED",
            "reviewStatus": "DRAFT",
            "reviewer": None,
            "reviewedAt": None,
            "disputed": bool(bp.get("disputed", False)),
            "rationale": bp["rationale"],
        }

        cases.append(case_row)
        qrels.append(qrel_row)
        annotations.append(ann_row)

    # 严格核对 12 主分类及 dev/test/smoke 配比
    for qtype, expected_quota in CATEGORY_QUOTAS.items():
        actual = cat_split_counts[qtype]
        for key in ("total", "dev", "test", "smoke"):
            if actual[key] != expected_quota[key]:
                raise ValueError(f"Quota mismatch on {qtype}.{key}: expected {expected_quota[key]}, got {actual[key]}")

    # 跨划分文本与语义近重复统计
    max_seq_ratio = 0.0
    high_sim_pairs: list[tuple[str, str, float]] = []
    for i, a in enumerate(cases):
        for b in cases[i + 1:]:
            if a["split"] != b["split"]:
                ratio = SequenceMatcher(None, a["originalQuery"], b["originalQuery"]).ratio()
                if ratio > max_seq_ratio:
                    max_seq_ratio = ratio
                if ratio >= 0.80:
                    high_sim_pairs.append((a["caseId"], b["caseId"], round(ratio, 4)))

    stats = {
        "totalCases": len(cases),
        "devCount": len(splits["dev"]),
        "testCount": len(splits["test"]),
        "smokeCount": len(splits["smoke"]),
        "familyCount": len({c["familyId"] for c in cases}),
        "multiMemberFamilyCases": sum(
            1 for c in cases if sum(1 for x in cases if x["familyId"] == c["familyId"]) > 1
        ),
        "disputedCount": sum(1 for a in annotations if a["disputed"]),
        "maxCrossSplitSequenceRatio": round(max_seq_ratio, 4),
        "crossSplitPairsAbove080": high_sim_pairs,
    }
    return cases, qrels, annotations, splits, stats
