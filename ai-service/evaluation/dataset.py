"""版本化评测输入、来源与人工审核状态校验。"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

DATASETS = Path(__file__).parent / "datasets"
FILES = ("merchants.json", "products.jsonl", "knowledge.jsonl", "cases.jsonl",
         "qrels.jsonl", "annotations.jsonl", "splits.json")
OPTIONAL_FILES = ("challenge.jsonl",)


def _char_bigrams(text: str) -> set[str]:
    cleaned = re.sub(r"\s+", "", text).lower()
    if len(cleaned) < 2:
        return {cleaned} if cleaned else set()
    return {cleaned[i:i + 2] for i in range(len(cleaned) - 1)}


def _char_bigram_jaccard(a: str, b: str) -> float:
    ba, bb = _char_bigrams(a), _char_bigrams(b)
    union = ba | bb
    return len(ba & bb) / len(union) if union else 0.0


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


def _valid_reviewed_at(value):
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def human_review_metadata_errors(annotation):
    """只核对评审记录结构，不能证明人类实际完成了复核。"""
    errors = []
    if annotation.get("reviewStatus") != "HUMAN_REVIEWED":
        errors.append("NOT_HUMAN_REVIEWED")
    if not isinstance(annotation.get("reviewer"), str) or not annotation["reviewer"].strip():
        errors.append("MISSING_REVIEWER")
    if not _valid_reviewed_at(annotation.get("reviewedAt")):
        errors.append("INVALID_REVIEWED_AT")
    if not isinstance(annotation.get("annotationSource"), str) or not annotation["annotationSource"].strip():
        errors.append("MISSING_ANNOTATION_SOURCE")
    if annotation.get("disputed") is not False:
        errors.append("UNRESOLVED_DISPUTE")
    return errors


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
    require(set(FILES) <= set(manifest["files"]) <= set(FILES + OPTIONAL_FILES), "incomplete manifest")
    challenge_rows = data.get("challenge") or []
    require(isinstance(challenge_rows, list), "invalid challenge list")
    challenges = unique(challenge_rows, "caseId")
    require(set(challenges).isdisjoint(cases), "challenge caseId collision")
    for ch in challenge_rows:
        for field in ("caseId", "category", "unsupportedCapability", "originalQuery",
                      "actorRef", "expectedSystemHandling", "rationale"):
            require(isinstance(ch.get(field), str) and bool(ch[field].strip()), "invalid challenge " + field)
        require(ch.get("capabilityStatus") == "UNSUPPORTED", "invalid challenge capabilityStatus")
        require(ch.get("annotationSource") == "AI_ASSISTED", "invalid challenge annotationSource")
        require(ch.get("reviewStatus") == "DRAFT", "invalid challenge reviewStatus")
    chunking = manifest.get("chunking") or {"length": 700, "overlap": 80}
    chunk_length, chunk_overlap = chunking.get("length", 700), chunking.get("overlap", 80)
    families, queries, near, char_bigram_overlap = {}, {}, [], []
    split_ids = data["splits"]
    require(set(split_ids["dev"]).isdisjoint(split_ids["test"]), "split overlap")
    holdout_ids = set(split_ids.get("holdout", []))
    require(holdout_ids.isdisjoint(split_ids["dev"]) and holdout_ids.isdisjoint(split_ids["test"]), "holdout split overlap")
    require(set(split_ids["dev"] + split_ids["test"]) | holdout_ids == set(cases), "split coverage")
    require(set(split_ids["smoke"]) <= set(split_ids["dev"]), "smoke outside dev")
    for case in cases.values():
        cid, split = case["caseId"], case["split"]
        require(split in ("dev", "test", "holdout") and cid in split_ids[split], "case split mismatch")
        family = case["familyId"]
        require(families.setdefault(family, split) == split, "family split leakage")
        query = re.sub(r"[\W_]+", "", case["originalQuery"]).lower()
        require(query not in queries or queries[query] == split, "normalized query split leakage")
        queries[query] = split
        require(set(case["allowedMerchantIds"]) <= set(merchants), "unknown scope merchant")
        require(set(case["allowedDocumentIds"]) <= set(docs), "unknown scope document")
        actor = case["actorRef"]
        require(isinstance(actor, str) and bool(actor.strip()), "invalid actorRef")
        if actor not in ("buyer", "platform-admin"):
            actor_mid = None
            for prefix in ("merchant-owner-", "merchant-clerk-read-", "merchant-clerk-noread-"):
                if actor.startswith(prefix):
                    actor_mid = actor[len(prefix):]
                    break
            require(actor_mid in merchants, "invalid actorRef")
        expected_scope = {d["documentId"] for d in docs.values() if d["status"] == "PUBLISHED" and (
            (d["visibility"] == "PUBLIC" and (d["merchantId"] is None or merchants[d["merchantId"]]["status"] == "ACTIVE"))
            or (d["visibility"] == "MERCHANT_INTERNAL" and actor in (
                "merchant-owner-" + str(d["merchantId"]),
                "merchant-clerk-read-" + str(d["merchantId"]),
            ))
            or (d["visibility"] == "PLATFORM_INTERNAL" and actor == "platform-admin"))}
        require(set(case["allowedDocumentIds"]) == expected_scope, "actor/scope mismatch")
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
            pieces = chunks(docs[did]["content"], length=chunk_length, overlap=chunk_overlap)
            require(type(ordinal) is int and 0 <= ordinal < len(pieces), "invalid evidence ordinal")
            require(evidence["chunkHash"] == hashlib.sha256(pieces[ordinal].encode()).hexdigest(), "evidence hash mismatch")
            require(type(evidence["grade"]) is int and 0 <= evidence["grade"] <= 2, "invalid evidence grade")
        for pid in qrels[cid]["product"]:
            product = products[pid]
            require(product["status"] == "PUBLISHED" and product["merchantId"] in case["allowedMerchantIds"]
                    and merchants[product["merchantId"]]["status"] == "ACTIVE", "ineligible gold product")
        for sid, grade in qrels[cid]["sku"].items():
            if grade > 0:
                product, sku = skus[sid]
                require(product["status"] == "PUBLISHED" and product["merchantId"] in case["allowedMerchantIds"]
                        and merchants[product["merchantId"]]["status"] == "ACTIVE", "ineligible gold sku")
                if grade == 2:
                    require(sku["status"] == "ACTIVE", "ineligible gold sku")
        purchase_mode = case["constraints"].get("purchaseMode")
        require(purchase_mode in (None, "SINGLE", "ALTERNATIVES", "BUNDLE"), "invalid purchaseMode")
        req_groups = case["constraints"].get("requiredGroups")
        if purchase_mode == "BUNDLE" and case["expectedBehavior"]["action"] == "RECOMMEND":
            require(isinstance(req_groups, list) and len(req_groups) >= 2, "bundle missing requiredGroups")
            seen_gids, seen_skus = set(), set()
            for grp in req_groups:
                gid = grp.get("groupId")
                g_skus = grp.get("skuIds")
                g_prods = grp.get("productIds")
                require(isinstance(gid, str) and gid.strip() and gid not in seen_gids, "invalid or duplicate bundle groupId")
                require(isinstance(g_skus, list) and bool(g_skus) and set(g_skus) <= set(skus), "invalid bundle group skuIds")
                require(isinstance(g_prods, list) and bool(g_prods) and set(g_prods) <= set(products), "invalid bundle group productIds")
                require(all(qrels[cid]["sku"].get(s) == 2 for s in g_skus), "bundle group sku must be grade=2")
                require(seen_skus.isdisjoint(g_skus), "overlapping bundle group skuIds")
                seen_gids.add(gid)
                seen_skus.update(g_skus)
        elif req_groups is not None:
            require(isinstance(req_groups, list), "invalid requiredGroups")
        ann = annotations[cid]
        require(ann["datasetVersion"] == manifest["version"] and ann["caseHash"] == digest(case)
                and ann["qrelsHash"] == digest(qrels[cid]), "annotation snapshot mismatch")
        if ann["reviewStatus"] == "HUMAN_REVIEWED":
            require(not human_review_metadata_errors(ann), "invalid human review")
        if formal:
            require(ann["reviewStatus"] == "HUMAN_REVIEWED", "unreviewed gold: " + cid)
    # 仅做词面/字符二元组近似筛查（非完整语义等价防泄漏检测；深层语义同义改写须依赖familyId人工复核与独立Holdout盲测）。
    from difflib import SequenceMatcher
    rows = list(cases.values())
    reviewed_pairs = manifest.get("reviewedNearDuplicates", [])
    for i, a in enumerate(rows):
        for b in rows[i + 1:]:
            if a["split"] != b["split"]:
                pair = sorted((a["caseId"], b["caseId"]))
                if SequenceMatcher(None, a["originalQuery"], b["originalQuery"]).ratio() >= .92:
                    if pair not in reviewed_pairs:
                        near.append(pair)
                if _char_bigram_jaccard(a["originalQuery"], b["originalQuery"]) >= .78:
                    if pair not in reviewed_pairs:
                        char_bigram_overlap.append(pair)
    if formal:
        require(manifest["status"] == "ACCEPTED" and not near, "dataset not frozen or unresolved near duplicates")
    family_counts = Counter(c["familyId"] for c in cases.values())
    purchase_modes = Counter(c["constraints"].get("purchaseMode") or "NONE" for c in cases.values())
    return {"caseCount": len(cases), "productCount": len(products), "skuCount": len(skus),
            "documentCount": len(docs), "merchantCount": len(merchants), "familyCount": len(families),
            "multiCaseFamilyCount": sum(v > 1 for v in family_counts.values()),
            "purchaseModes": dict(purchase_modes),
            "disputedCount": sum(a.get("disputed") is True for a in annotations.values()),
            "challengeCount": len(challenge_rows),
            "categories": dict(Counter(c["queryType"] for c in cases.values())),
            "reviewed": sum(a["reviewStatus"] == "HUMAN_REVIEWED" for a in annotations.values()),
            "nearDuplicateWarnings": near, "charBigramOverlapWarnings": char_bigram_overlap,
            "leakageDetectionScope": "LEXICAL_CHAR_SIMILARITY_AND_DECLARED_FAMILY_ONLY",
            "semanticLeakageVerified": False,
            "status": manifest["status"]}


def load(name="campus-shopping-v1", *, formal=False):
    path = Path(name) if Path(name).is_dir() else DATASETS / name
    manifest = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
    for filename, expected in manifest["files"].items():
        if filename not in FILES + OPTIONAL_FILES or hashlib.sha256((path / filename).read_bytes()).hexdigest() != expected:
            raise DatasetError("file hash mismatch: " + filename)
    data = {"manifest": manifest}
    for key in ("products", "knowledge", "cases", "qrels", "annotations"):
        data[key] = read_jsonl(path / (key + ".jsonl"))
    for key in ("merchants", "splits"):
        data[key] = json.loads((path / (key + ".json")).read_text(encoding="utf-8"))
    data["challenge"] = read_jsonl(path / "challenge.jsonl") if "challenge.jsonl" in manifest["files"] else []
    data["validation"] = validate(data, formal=formal)
    data["datasetHash"] = digest(manifest)
    return data
