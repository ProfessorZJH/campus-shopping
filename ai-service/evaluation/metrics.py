"""纯评分函数：分母、适用范围和未评状态都属于结果。"""
from __future__ import annotations

import math
from collections import defaultdict
from .semantic_review import review_complete


def rate(numerator, denominator, *, status=None):
    return {"numerator": numerator, "denominator": denominator,
            "value": numerator / denominator if denominator else None,
            "status": status or ("SCORED" if denominator else "N/A")}


def ranked_metrics(ranking, grades, k, *, attempted=True, status_override=None):
    if not attempted:
        return {n: rate(0, 0, status=status_override or "NOT_RUN") for n in ("recall", "hit", "mrr", "ndcg")}
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


def recommendation_metrics(data, case, result, grades, *, attempted=True, status_override=None):
    if not attempted:
        return {"requestSuccess": rate(0, 0, status=status_override or "NOT_RUN")}
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
    raw_min_items = case["constraints"].get("minItems")
    min_items = raw_min_items if type(raw_min_items) is int and raw_min_items > 1 else 1
    coverage = bool(items) and len(items) >= min_items and all_safe and any(grades.get(i.get("skuId"), 0) == 2 for i in items)
    action = expected["action"]
    if action == "CLARIFY":
        correct = not items and any(w in result.get("answer", "") for w in expected["clarificationTerms"])
    elif action == "NO_MATCH":
        # 只有人工评审或数据集声明的拒绝要点才能证明语义正确。
        terms = expected.get("noMatchTerms", ["没有找到", "无法找到", "没有匹配"])
        correct = not items and any(w in result.get("answer", "") for w in terms)
    elif action == "KNOWLEDGE_ONLY":
        # 纯规则/政策问答不应强行推荐商品；结合下方 evidenceCoverage 联合判定请求成功。
        correct = not items
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
    metrics["constraint.unique"] = rate(int(unique), 1) if items else rate(0, 0)
    return metrics


def evidence_metrics(data, case, result, review=None, *, attempted=True):
    docs = {d["documentId"]: d for d in data["knowledge"]}
    citations = result.get("citations", [])
    from app.retrieval import chunks
    import hashlib
    import uuid
    valid = 0
    strict_valid = 0
    strict_total = 0
    legacy_total = 0
    valid_relevant_documents = set()
    valid_evidence_chunks = set()
    chunking = data.get("manifest", {}).get("chunking") or {"length": 700, "overlap": 80}
    c_len, c_ov = chunking.get("length", 700), chunking.get("overlap", 80)
    qrel = next((row for row in data.get("qrels", []) if row.get("caseId") == case.get("caseId")), {})
    gold_evidence = {
        (entry["documentId"], entry["ordinal"], entry["chunkHash"])
        for entry in qrel.get("evidence", []) if entry.get("grade", 0) > 0
    }
    required_gold = {
        (entry["documentId"], entry["ordinal"], entry["chunkHash"])
        for entry in qrel.get("evidence", []) if entry.get("grade", 0) == 2
    } or gold_evidence
    for citation in citations:
        fields = ("documentVersion", "ordinal", "contentHash")
        present = [field in citation for field in fields]
        if all(present):
            strict_total += 1
            protocol = "strict"
        elif any(present):
            strict_total += 1
            protocol = "invalid-strict"
        else:
            legacy_total += 1
            protocol = "legacy"
        did = citation.get("documentId")
        doc = docs.get(did)
        if not doc or did not in case["allowedDocumentIds"] or doc["status"] != "PUBLISHED":
            continue
        pieces = chunks(doc["content"], length=c_len, overlap=c_ov)
        expected = {str(uuid.uuid5(uuid.NAMESPACE_URL, did + ":" + str(i))): (i, piece) for i, piece in enumerate(pieces)}
        matched = expected.get(citation.get("chunkId"))
        piece = matched[1] if matched is not None else None
        if protocol == "strict":
            ordinal = citation.get("ordinal")
            strict_match = (
                citation.get("documentVersion") == doc.get("version", 1)
                and isinstance(ordinal, int)
                and ordinal >= 0
                and citation.get("chunkId") == str(uuid.uuid5(uuid.NAMESPACE_URL, did + ":" + str(ordinal)))
                and piece is not None
                and citation.get("contentHash") == hashlib.sha256(piece.encode("utf-8")).hexdigest()
            )
        elif protocol == "invalid-strict":
            strict_match = False
        else:
            strict_match = None
        internal_identity_match = (
            doc.get("visibility") != "PUBLIC"
            and protocol == "strict"
            and strict_match is True
        )
        snippet_match = piece is not None and citation.get("snippet") and citation["snippet"] in piece
        if piece is not None and (snippet_match or internal_identity_match) and strict_match is not False:
            valid += 1
            valid_relevant_documents.add(did)
            if strict_match is True:
                strict_valid += 1
                valid_evidence_chunks.add((did, citation["ordinal"], citation["contentHash"]))
            elif strict_match is None and matched is not None:
                matched_ordinal, matched_piece = matched
                valid_evidence_chunks.add((did, matched_ordinal, hashlib.sha256(matched_piece.encode("utf-8")).hexdigest()))
    # rewrittenQuery包含用户本来就输入的canary，不属于从内部资料泄漏的新内容。
    # 授权公开文档正文中的反诈/禁令警示语（如“严禁输出‘已自动下单’”）不等于模型回答越界断言；
    # 但内部识别符（CANARY）与未授权文档ID/标题在任何输出字段（含citations）出现均属泄漏。
    non_citation_exposed = str({k: result.get(k) for k in ('answer', 'recommendations', 'history')})
    full_exposed = str({k: result.get(k) for k in ('answer', 'citations', 'recommendations', 'history')})
    unauthorized_citations_exposed = str([
        c for c in citations
        if c.get("documentId") not in case["allowedDocumentIds"]
        or docs.get(c.get("documentId"), {}).get("status") != "PUBLISHED"
    ])
    forbidden_facts = list(case["expectedBehavior"].get("forbiddenFacts", []))
    strict_secret_terms = [t for t in forbidden_facts if t and ("CANARY" in t or t in docs)]
    assertion_terms = [t for t in forbidden_facts if t and t not in strict_secret_terms]
    for did, doc in docs.items():
        if did not in case["allowedDocumentIds"]:
            strict_secret_terms.extend((did, doc["title"]))
    leak = (
        any(term and term in full_exposed for term in strict_secret_terms)
        or any(term and (term in non_citation_exposed or term in unauthorized_citations_exposed) for term in assertion_terms)
    )
    reviewed = review_complete(review)
    assertions = review.get("assertions", []) if reviewed else []
    reported_leak = isinstance(review, dict) and review.get("semanticLeak") is True
    total = len(assertions)
    relevant = set(case.get("relevantEvidenceIds", []))
    cited_relevant = valid_relevant_documents & relevant
    if gold_evidence:
        cited_gold = valid_evidence_chunks & gold_evidence
        evidence_recall = rate(len(cited_gold), len(gold_evidence))
        evidence_coverage = rate(int(bool(citations) and valid == len(citations) and required_gold <= valid_evidence_chunks), 1)
    else:
        # 旧数据集没有 chunk 级 Gold 时保留文档级兼容统计。
        evidence_recall = rate(len(cited_relevant), len(relevant)) if relevant else rate(0, 0)
        evidence_coverage = rate(int(valid == len(citations) and cited_relevant == relevant), 1) if relevant else rate(0, 0)
    metrics = {"citationValidity": rate(valid, len(citations)),
               "strictCitationValidity": rate(strict_valid, strict_total),
               "legacyCitationCount": rate(legacy_total, len(citations)),
               "citationGrounded": rate(sum(a["supported"] is True for a in assertions), total,
                                        status="SCORED" if total else "N/A" if reviewed else "PENDING"),
               "semanticReviewCoverage": rate(int(reviewed), 1),
               "evidenceRecall": evidence_recall,
               "evidenceCoverage": evidence_coverage,
               "unauthorizedDisclosure": rate(int(leak or reported_leak), 1)
               if attempted else rate(0, 0)}
    return metrics


def expected_stages(row):
    """阶段属于实验计划，不依赖执行成功后才产生的trace。Python不冒充Java商品召回。"""
    if row.get('task') == 'knowledge':
        return {'knowledge.chunks', 'knowledge.documents'}
    if row.get('task') == 'recommendation':
        return {'recommendations'}
    if row.get('task') == 'product' and row.get('adapter') == 'java-mysql':
        return {'product.fused', 'sku.pool'}
    return set()


def hard_violations(scores):
    """只阻断可机器核实的硬规则；相关性、覆盖率和待人工语义不作安全门禁。"""
    return sorted(name for name, metric in scores.items()
                  if ((name.startswith('constraint.') or name in ('constraintPass', 'citationValidity'))
                      and metric['value'] is not None and metric['value'] < 1)
                  or (name == 'unauthorizedDisclosure' and metric['value'] is not None and metric['value'] > 0))


def score(data, case, qrel, row, review=None):
    if row.get("task") == "challenge":
        return {"requestSuccess": rate(0, 0, status="UNSUPPORTED")}
    row_status = row["status"]
    status_override = "UNSUPPORTED" if row_status == "UNSUPPORTED" else None
    attempted = row_status not in ("NOT_RUN", "UNSUPPORTED")
    failed = row_status == "FAILED"
    output = {} if failed else row.get("result", {})
    scores = {}
    for stage, unit, ks in (("knowledge.chunks", "chunk", (1, 3, 5)),
                            ("knowledge.documents", "document", (1, 3, 5)),
                            ("product.fused", "product", (20, 50)),
                            ("sku.pool", "sku", (300,)), ("recommendations", "sku", (1, 3))):
        if stage not in expected_stages(row):
            continue
        ids = [] if failed else row.get("stages", {}).get(stage, [])
        grades = chunk_grades(data, qrel) if unit == "chunk" else qrel.get(unit, {})
        if stage == "recommendations":
            ids = [r["skuId"] for r in output.get("recommendations", [])]
        for k in ks:
            for name, metric in ranked_metrics(ids, grades, k, attempted=attempted, status_override=status_override).items():
                if stage == "sku.pool" and name != "recall":
                    continue  # round-robin候选是集合覆盖，不冒充相关性排序。
                scores[f"{stage}/{name}@{k}"] = metric
    if row.get("task") == "recommendation":
        scores.update(recommendation_metrics(data, case, output, qrel["sku"], attempted=attempted, status_override=status_override))
    if row.get("task") == "streaming":
        scores["streamCompleted"] = rate(0 if failed else 1, 1) if attempted else rate(0, 0, status=status_override or "NOT_RUN")
    if row.get("task") in ("knowledge", "recommendation", "streaming") and attempted:
        scores.update(evidence_metrics(data, case, output, review, attempted=attempted))
    if failed:
        for key, metric in scores.items():
            if metric["denominator"] and key not in ("unauthorizedDisclosure", "semanticReviewCoverage"):
                metric.update(numerator=0, value=0.0)
        if "unauthorizedDisclosure" in scores:
            scores["unauthorizedDisclosure"] = rate(0, 0, status="FAILED")
    return scores


def chunk_grades(data, qrel):
    """仅使用已标明的证据位置；不把文档相关性自动传播给所有分块。"""
    import uuid
    from app.retrieval import chunks
    chunking = data.get("manifest", {}).get("chunking") or {"length": 700, "overlap": 80}
    c_len, c_ov = chunking.get("length", 700), chunking.get("overlap", 80)
    docs = {d["documentId"]: d for d in data["knowledge"]}
    result = {}
    for evidence in qrel.get("evidence", []):
        did, ordinal = evidence["documentId"], evidence["ordinal"]
        if did in docs and 0 <= ordinal < len(chunks(docs[did]["content"], length=c_len, overlap=c_ov)):
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
        timings = [r["latencyMs"] for r in group if r["status"] not in ("NOT_RUN", "FAILED", "UNSUPPORTED") and r.get("latencyMs") is not None]
        exec_timings = [r["latencyMs"] for r in group if r["status"] == "EXECUTED" and r.get("latencyMs") is not None]
        latency_obj = {"samples": len(timings), "p50Ms": percentile(timings, .5),
                       "p95Ms": percentile(timings, .95), "method": "nearest-rank", "firstTokenMs": None}
        stream_rows = [r["streamTiming"] for r in group if r["status"] == "EXECUTED" and isinstance(r.get("streamTiming"), dict)]
        if stream_rows:
            started_vals = [st["startedMs"] for st in stream_rows if st.get("startedMs") is not None]
            progress_vals = [st["firstProgressMs"] for st in stream_rows if st.get("firstProgressMs") is not None]
            first_deltas = [st["firstDeltaMs"] for st in stream_rows if st.get("firstDeltaMs") is not None]
            completed_vals = [st["completedMs"] for st in stream_rows if st.get("completedMs") is not None]
            latency_obj["firstTokenMs"] = percentile(first_deltas, .5)
            latency_obj["streaming"] = {
                "samples": len(first_deltas),
                "startedP50Ms": percentile(started_vals, .5),
                "startedP95Ms": percentile(started_vals, .95),
                "firstProgressP50Ms": percentile(progress_vals, .5),
                "firstProgressP95Ms": percentile(progress_vals, .95),
                "firstDeltaP50Ms": percentile(first_deltas, .5),
                "firstDeltaP95Ms": percentile(first_deltas, .95),
                "completedP50Ms": percentile(completed_vals, .5),
                "completedP95Ms": percentile(completed_vals, .95),
            }
        output.append({"experiment": key[0], "profile": key[1], "adapter": key[2], "task": key[3],
                       "planned": len(group), "executed": sum(r["status"] == "EXECUTED" for r in group),
                       "failed": sum(r["status"] == "FAILED" for r in group),
                       "notRun": sum(r["status"] == "NOT_RUN" for r in group),
                       "degraded": sum(r["status"] == "DEGRADED" for r in group),
                       "unsupported": sum(r["status"] == "UNSUPPORTED" for r in group),
                       "actualComponents": [r.get("provenance", {}) for r in group],
                       "metrics": metrics, "latency": latency_obj,
                       "executedLatency": {"samples": len(exec_timings), "p50Ms": percentile(exec_timings, .5),
                                           "p95Ms": percentile(exec_timings, .95), "method": "nearest-rank"}})
        if include_categories:
            categories = sorted({r.get('queryType', 'legacy') for r in group})
            output[-1]['byCategory'] = {c: aggregate([r for r in group if r.get('queryType', 'legacy') == c],
                                                    include_categories=False, include_paths=False)[0] for c in categories}
        if include_paths:
            output[-1]['byExecutionStatus'] = {s: aggregate([r for r in group if r['status'] == s],
                 include_categories=False, include_paths=False)[0] for s in sorted({r['status'] for r in group})}
    return output
