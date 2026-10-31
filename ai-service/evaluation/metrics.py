"""纯评分函数：分母、适用范围和未评状态都属于结果。"""
from __future__ import annotations

import math
from collections import defaultdict


def rate(numerator, denominator, *, status=None):
    return {"numerator": numerator, "denominator": denominator,
            "value": numerator / denominator if denominator else None,
            "status": status or ("SCORED" if denominator else "N/A")}


def ranked_metrics(ranking, grades, k, *, attempted=True):
    if not attempted:
        return {n: rate(0, 0, status="NOT_RUN") for n in ("recall", "hit", "mrr", "ndcg")}
    relevant = {key for key, value in grades.items() if value > 0}
    if not relevant:
        return {n: rate(0, 0) for n in ("recall", "hit", "mrr", "ndcg")}
    ids = list(dict.fromkeys(ranking))[:k]
    hits = len(set(ids) & relevant)
    first = next((i for i, key in enumerate(ids, 1) if key in relevant), None)
    dcg = sum((2 ** grades.get(key, 0) - 1) / math.log2(i + 1) for i, key in enumerate(ids, 1))
    ideal = sum((2 ** g - 1) / math.log2(i + 1)
                for i, g in enumerate(sorted(grades.values(), reverse=True)[:k], 1))
    return {"recall": rate(hits, len(relevant)), "hit": rate(int(bool(hits)), 1),
            "mrr": rate(0 if first is None else 1 / first, 1), "ndcg": rate(dcg, ideal)}


def percentile(values, p):
    if not values:
        return None
    return sorted(values)[max(0, math.ceil(p * len(values)) - 1)]


def sku_map(data):
    merchants = {m["merchantId"]: m for m in data["merchants"]["merchants"]}
    return {s["skuId"]: dict(s, productId=p["productId"], merchantId=p["merchantId"],
                            productStatus=p["status"], merchantStatus=merchants[p["merchantId"]]["status"])
            for p in data["products"] for s in p["skus"]}


def item_checks(item, facts, constraints, merchants):
    q = item.get("quantity")
    valid_qty = type(q) is int and 1 <= q <= 99
    expected_qty = constraints.get("quantity")
    return {
        "knownSku": bool(facts),
        "quantity": valid_qty and (expected_qty is None or q == expected_qty),
        "stock": bool(facts) and valid_qty and q <= facts["onHand"] - facts["reserved"],
        "publication": bool(facts) and facts["productStatus"] == "PUBLISHED" and facts["status"] == "ACTIVE",
        "merchant": bool(facts) and facts["merchantStatus"] == "ACTIVE" and facts["merchantId"] in merchants,
        "attributes": bool(facts) and all(facts["attributes"].get(k) == v for k, v in constraints.get("requiredAttributes", {}).items())
        and all(facts["attributes"].get(k) != v for k, v in constraints.get("forbiddenAttributes", {}).items()),
    }


def recommendation_metrics(data, case, result, grades, *, attempted=True):
    if not attempted:
        return {"requestSuccess": rate(0, 0, status="NOT_RUN")}
    facts = sku_map(data)
    items = result.get("recommendations", [])
    checks = [item_checks(i, facts.get(i.get("skuId")), case["constraints"], case["allowedMerchantIds"]) for i in items]
    spent = sum(facts[i["skuId"]]["priceCent"] * i["quantity"] for i in items
                if i.get("skuId") in facts and type(i.get("quantity")) is int)
    budget = case["constraints"].get("budgetCent")
    budget_ok = budget is None or spent <= budget
    unique = len({i.get("skuId") for i in items}) == len(items)
    all_safe = all(all(c.values()) for c in checks) and budget_ok and unique
    eligible = [key for key, grade in grades.items() if grade == 2 and
                all(item_checks({"quantity": case["constraints"].get("quantity") or 1}, facts[key],
                                case["constraints"], case["allowedMerchantIds"]).values())
                and (budget is None or facts[key]["priceCent"] * (case["constraints"].get("quantity") or 1) <= budget)]
    expected = case["expectedBehavior"]
    coverage = bool(items) and all_safe and any(grades.get(i.get("skuId"), 0) == 2 for i in items)
    action = expected["action"]
    if action == "CLARIFY":
        correct = not items and any(w in result.get("answer", "") for w in expected["clarificationTerms"])
    elif action == "NO_MATCH":
        # 只有人工评审或数据集声明的拒绝要点才能证明语义正确。
        terms = expected.get("noMatchTerms", ["没有找到", "无法找到", "没有匹配"])
        correct = not items and any(w in result.get("answer", "") for w in terms)
    else:
        correct = coverage
    if case["relevantEvidenceIds"]:
        evidence = evidence_metrics(data, case, result)
        correct = correct and evidence["evidenceCoverage"]["value"] == 1
    metrics = {"constraintPass": rate(sum(all(c.values()) and budget_ok and unique for c in checks), len(items)),
               "recommendationCoverage": rate(int(coverage), int(bool(eligible))) if eligible else rate(0, 0),
               "requestSuccess": rate(int(correct), 1),
               "noMatchAccuracy": rate(int(correct), 1) if action == "NO_MATCH" else rate(0, 0),
               "clarificationAccuracy": rate(int(correct), 1) if action == "CLARIFY" else rate(0, 0)}
    for key in ("knownSku", "quantity", "stock", "publication", "merchant", "attributes"):
        metrics["constraint." + key] = rate(sum(c[key] for c in checks), len(checks))
    metrics["constraint.budget"] = rate(int(budget_ok), 1) if budget is not None and items else rate(0, 0)
    return metrics


def evidence_metrics(data, case, result, review=None, *, attempted=True):
    docs = {d["documentId"]: d for d in data["knowledge"]}
    citations = result.get("citations", [])
    from app.retrieval import chunks
    import uuid
    valid = 0
    for citation in citations:
        did = citation.get("documentId")
        doc = docs.get(did)
        if not doc or did not in case["allowedDocumentIds"] or doc["status"] != "PUBLISHED":
            continue
        expected = {str(uuid.uuid5(uuid.NAMESPACE_URL, did + ":" + str(i))): piece for i, piece in enumerate(chunks(doc["content"]))}
        piece = expected.get(citation.get("chunkId"))
        if piece is not None and citation.get("snippet") and citation["snippet"] in piece:
            valid += 1
    # rewrittenQuery包含用户本来就输入的canary，不属于从内部资料泄漏的新内容。
    exposed = str({k: result.get(k) for k in ('answer', 'citations', 'recommendations', 'history')})
    forbidden = list(case["expectedBehavior"].get("forbiddenFacts", []))
    for did, doc in docs.items():
        if did not in case["allowedDocumentIds"]:
            forbidden.extend((did, doc["title"]))
    leak = any(term and term in exposed for term in forbidden)
    reviewed = bool(review and review.get("reviewer") and review.get("reviewedAt"))
    assertions = review.get("assertions", []) if reviewed else []
    total = len(assertions)
    metrics = {"citationValidity": rate(valid, len(citations)),
               "citationGrounded": rate(sum(a["supported"] is True for a in assertions), total,
                                        status="SCORED" if total else "PENDING"),
               "semanticReviewCoverage": rate(int(reviewed), 1),
               "evidenceCoverage": rate(int(bool(citations) and valid == len(citations)), 1)
               if case["relevantEvidenceIds"] else rate(0, 0),
               "unauthorizedDisclosure": rate(int(leak or bool(reviewed and review.get("semanticLeak"))), 1)
               if case.get("sensitive") and attempted else rate(0, 0)}
    return metrics


def score(data, case, qrel, row, review=None):
    attempted = row["status"] not in ("NOT_RUN", "UNSUPPORTED")
    failed = row["status"] == "FAILED"
    output = {} if failed else row.get("result", {})
    scores = {}
    for stage, unit, ks in (("knowledge.chunks", "chunk", (1, 3, 5)),
                            ("knowledge.documents", "document", (1, 3, 5)),
                            ("product.fused", "product", (20, 50)),
                            ("sku.pool", "sku", (300,)), ("recommendations", "sku", (1, 3))):
        if stage not in row.get("stages", {}):
            continue
        ids = [] if failed else row["stages"][stage]
        grades = chunk_grades(data, qrel) if unit == "chunk" else qrel.get(unit, {})
        if stage == "recommendations":
            ids = [r["skuId"] for r in output.get("recommendations", [])]
        for k in ks:
            for name, metric in ranked_metrics(ids, grades, k, attempted=attempted).items():
                if stage == "sku.pool" and name != "recall":
                    continue  # round-robin候选是集合覆盖，不冒充相关性排序。
                scores[f"{stage}/{name}@{k}"] = metric
    if row.get("task") == "recommendation":
        scores.update(recommendation_metrics(data, case, output, qrel["sku"], attempted=attempted))
    if row.get("task") in ("knowledge", "recommendation") and attempted:
        scores.update(evidence_metrics(data, case, output, review, attempted=attempted))
    if failed:
        for key, metric in scores.items():
            if metric["denominator"] and key not in ("unauthorizedDisclosure", "semanticReviewCoverage"):
                metric.update(numerator=0, value=0.0)
    return scores


def chunk_grades(data, qrel):
    """仅使用已标明的证据位置；不把文档相关性自动传播给所有分块。"""
    import uuid
    from app.retrieval import chunks
    docs = {d["documentId"]: d for d in data["knowledge"]}
    result = {}
    for evidence in qrel.get("evidence", []):
        did, ordinal = evidence["documentId"], evidence["ordinal"]
        if did in docs and 0 <= ordinal < len(chunks(docs[did]["content"])):
            result[str(uuid.uuid5(uuid.NAMESPACE_URL, did + ":" + str(ordinal)))] = evidence["grade"]
    return result


def aggregate(rows, *, include_categories=True, include_paths=True):
    groups = defaultdict(list)
    for row in rows:
        key = (row["experiment"], row["profile"], row["adapter"], row["task"])
        groups[key].append(row)
    output = []
    for key, group in sorted(groups.items()):
        metric_names = sorted({name for row in group for name in row.get("scores", {})})
        metrics = {}
        for name in metric_names:
            values = [r["scores"][name] for r in group if name in r.get("scores", {})]
            scored = [v for v in values if v["value"] is not None]
            metrics[name] = {"value": sum(v["value"] for v in scored) / len(scored) if scored else None,
                             "caseNumerators": [v["numerator"] for v in scored],
                             "caseDenominators": [v["denominator"] for v in scored],
                             "scored": len(scored), "notApplicableOrPending": len(values) - len(scored)}
        timings = [r["latencyMs"] for r in group if r["status"] not in ("NOT_RUN", "FAILED") and r.get("latencyMs") is not None]
        output.append({"experiment": key[0], "profile": key[1], "adapter": key[2], "task": key[3],
                       "planned": len(group), "failed": sum(r["status"] == "FAILED" for r in group),
                       "notRun": sum(r["status"] == "NOT_RUN" for r in group),
                       "degraded": sum(r["status"] == "DEGRADED" for r in group),
                       "actualComponents": [r.get("provenance", {}) for r in group],
                       "metrics": metrics, "latency": {"samples": len(timings), "p50Ms": percentile(timings, .5),
                       "p95Ms": percentile(timings, .95), "method": "nearest-rank", "firstTokenMs": None}})
        if include_categories:
            categories = sorted({r.get('queryType', 'legacy') for r in group})
            output[-1]['byCategory'] = {c: aggregate([r for r in group if r.get('queryType', 'legacy') == c],
                                                    include_categories=False, include_paths=False)[0] for c in categories}
        if include_paths:
            output[-1]['byExecutionStatus'] = {s: aggregate([r for r in group if r['status'] == s],
                 include_categories=False, include_paths=False)[0] for s in sorted({r['status'] for r in group})}
    return output
