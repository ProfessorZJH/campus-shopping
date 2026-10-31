"""版本化评测输入、来源与人工审核状态校验。"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path

DATASETS = Path(__file__).parent / "datasets"
FILES = ("merchants.json", "products.jsonl", "knowledge.jsonl", "cases.jsonl",
         "qrels.jsonl", "annotations.jsonl", "splits.json")


class DatasetError(ValueError):
    pass


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":")).encode()).hexdigest()


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def write_jsonl(path, values):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("".join(json.dumps(v, ensure_ascii=False, sort_keys=True) + "\n" for v in values), encoding="utf-8", newline="\n")


def unique(rows, key):
    ids = [r[key] for r in rows]
    if len(ids) != len(set(ids)):
        raise DatasetError("duplicate " + key)
    return dict(zip(ids, rows))


def validate(data, *, formal=False):
    """拒绝坏数据；DRAFT可探索，但不得因此自动获得ACCEPTED。"""
    def require(ok, message):
        if not ok:
            raise DatasetError(message)
    manifest = data["manifest"]
    merchants = unique(data["merchants"]["merchants"], "merchantId")
    products = unique(data["products"], "productId")
    docs = unique(data["knowledge"], "documentId")
    cases = unique(data["cases"], "caseId")
    qrels = unique(data["qrels"], "caseId")
    annotations = unique(data["annotations"], "caseId")
    require(set(cases) == set(qrels) == set(annotations), "case/qrel/annotation mismatch")
    skus = {}
    for product in products.values():
        require(product["merchantId"] in merchants, "unknown merchant")
        require(product["status"] in ("DRAFT", "PUBLISHED", "UNPUBLISHED"), "invalid product status")
        for sku in product["skus"]:
            require(sku["skuId"] not in skus, "duplicate skuId")
            require(type(sku["priceCent"]) is int and sku["priceCent"] > 0, "invalid price")
            require(all(type(sku[k]) is int and sku[k] >= 0 for k in ("onHand", "reserved"))
                    and sku["reserved"] <= sku["onHand"], "invalid stock")
            require(sku["status"] in ("ACTIVE", "INACTIVE"), "invalid sku status")
            skus[sku["skuId"]] = (product, sku)
    for doc in docs.values():
        require(doc["merchantId"] is None or doc["merchantId"] in merchants, "unknown document merchant")
        require(doc['visibility'] in ('PUBLIC', 'MERCHANT_INTERNAL', 'PLATFORM_INTERNAL'), 'invalid document visibility')
        require((doc['visibility'] != 'PLATFORM_INTERNAL' or doc['merchantId'] is None)
                and (doc['visibility'] != 'MERCHANT_INTERNAL' or doc['merchantId'] in merchants), 'invalid knowledge ownership')
        require(doc["contentHash"] == hashlib.sha256(doc["content"].encode()).hexdigest(), "document hash mismatch")
    require(set(manifest["files"]) == set(FILES), "incomplete manifest")
    families, queries, near = {}, {}, []
    split_ids = data["splits"]
    require(set(split_ids["dev"]).isdisjoint(split_ids["test"]), "split overlap")
    require(set(split_ids["dev"] + split_ids["test"]) == set(cases), "split coverage")
    require(set(split_ids["smoke"]) <= set(split_ids["dev"]), "smoke outside dev")
    for case in cases.values():
        cid, split = case["caseId"], case["split"]
        require(cid in split_ids[split], "case split mismatch")
        family = case["familyId"]
        require(families.setdefault(family, split) == split, "family split leakage")
        query = re.sub(r"[\W_]+", "", case["originalQuery"]).lower()
        require(query not in queries or queries[query] == split, "normalized query split leakage")
        queries[query] = split
        require(set(case["allowedMerchantIds"]) <= set(merchants), "unknown scope merchant")
        require(set(case["allowedDocumentIds"]) <= set(docs), "unknown scope document")
        actor = case['actorRef']
        expected_scope = {d['documentId'] for d in docs.values() if d['status'] == 'PUBLISHED' and (
            (d['visibility'] == 'PUBLIC' and (d['merchantId'] is None or merchants[d['merchantId']]['status'] == 'ACTIVE'))
            or (d['visibility'] == 'MERCHANT_INTERNAL' and actor == 'merchant-owner-' + str(d['merchantId']))
            or (d['visibility'] == 'PLATFORM_INTERNAL' and actor == 'platform-admin'))}
        require(set(case['allowedDocumentIds']) == expected_scope, 'actor/scope mismatch')
        require(case["annotatorVersion"] == manifest["annotationVersion"], "annotation version mismatch")
        for unit, ids in (("product", products), ("sku", skus), ("document", docs)):
            labels = qrels[cid][unit]
            require(set(labels) <= set(ids), "dangling " + unit + " qrel")
            require(all(type(v) is int and 0 <= v <= 2 for v in labels.values()), "invalid relevance grade")
        require(set(qrels[cid]["document"]) <= set(case["allowedDocumentIds"]), "unauthorized gold document")
        for unit, field in (('product', 'relevantProductIds'), ('sku', 'relevantSkuIds'), ('document', 'relevantEvidenceIds')):
            require(set(case[field]) == {k for k, v in qrels[cid][unit].items() if v > 0}, 'case/qrel relevant set mismatch')
        for evidence in qrels[cid].get("evidence", []):
            from app.retrieval import chunks
            did, ordinal = evidence["documentId"], evidence["ordinal"]
            require(did in qrels[cid]["document"], "dangling evidence")
            pieces = chunks(docs[did]["content"])
            require(type(ordinal) is int and 0 <= ordinal < len(pieces), "invalid evidence ordinal")
            require(evidence["chunkHash"] == hashlib.sha256(pieces[ordinal].encode()).hexdigest(), "evidence hash mismatch")
            require(type(evidence["grade"]) is int and 0 <= evidence["grade"] <= 2, "invalid evidence grade")
        for pid in qrels[cid]["product"]:
            product = products[pid]
            require(product["status"] == "PUBLISHED" and product["merchantId"] in case["allowedMerchantIds"]
                    and merchants[product["merchantId"]]["status"] == "ACTIVE", "ineligible gold product")
        ann = annotations[cid]
        require(ann["datasetVersion"] == manifest["version"] and ann["caseHash"] == digest(case)
                and ann["qrelsHash"] == digest(qrels[cid]), "annotation snapshot mismatch")
        if ann["reviewStatus"] == "HUMAN_REVIEWED":
            require(bool(ann.get("reviewer")) and bool(ann.get("reviewedAt")) and not ann.get("disputed"), "invalid human review")
        if formal:
            require(ann["reviewStatus"] == "HUMAN_REVIEWED", "unreviewed gold: " + cid)
    # 仅跨split近似问题提示人工处理；精确问题上面已拒绝。
    from difflib import SequenceMatcher
    rows = list(cases.values())
    for i, a in enumerate(rows):
        for b in rows[i + 1:]:
            if a["split"] != b["split"] and SequenceMatcher(None, a["originalQuery"], b["originalQuery"]).ratio() >= .92:
                pair = sorted((a["caseId"], b["caseId"]))
                if pair not in manifest.get("reviewedNearDuplicates", []):
                    near.append(pair)
    if formal:
        require(manifest["status"] == "ACCEPTED" and not near, "dataset not frozen or unresolved near duplicates")
    return {"caseCount": len(cases), "productCount": len(products), "skuCount": len(skus),
            "documentCount": len(docs), "categories": dict(Counter(c["queryType"] for c in cases.values())),
            "reviewed": sum(a["reviewStatus"] == "HUMAN_REVIEWED" for a in annotations.values()),
            "nearDuplicateWarnings": near, "status": manifest["status"]}


def load(name="campus-shopping-v1", *, formal=False):
    path = Path(name) if Path(name).is_dir() else DATASETS / name
    manifest = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
    for filename, expected in manifest["files"].items():
        if filename not in FILES or hashlib.sha256((path / filename).read_bytes()).hexdigest() != expected:
            raise DatasetError("file hash mismatch: " + filename)
    data = {"manifest": manifest}
    for key in ("products", "knowledge", "cases", "qrels", "annotations"):
        data[key] = read_jsonl(path / (key + ".jsonl"))
    for key in ("merchants", "splits"):
        data[key] = json.loads((path / (key + ".json")).read_text(encoding="utf-8"))
    data["validation"] = validate(data, formal=formal)
    data["datasetHash"] = digest(manifest)
    return data
