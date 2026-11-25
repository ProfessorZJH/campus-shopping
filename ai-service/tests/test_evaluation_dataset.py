import copy
from pathlib import Path

import pytest

from evaluation.dataset import DatasetError, digest, load, validate
from evaluation.generate import generate


@pytest.fixture
def data(tmp_path):
    return load(generate(tmp_path / "dataset"))


def test_deterministic_generation_and_coverage(tmp_path):
    a, b = generate(tmp_path / "a"), generate(tmp_path / "b")
    assert {p.name: p.read_bytes() for p in a.iterdir()} == {p.name: p.read_bytes() for p in b.iterdir()}
    assert all(b'\r' not in p.read_bytes() for p in a.iterdir()), "dataset digests must survive Git LF normalization on Windows"
    d = load(a)
    assert d["validation"]["caseCount"] == 120
    assert d["validation"]["skuCount"] == 360
    assert d["validation"]["productCount"] == 240
    assert d["validation"]["documentCount"] == 24
    assert set(d["validation"]["categories"].values()) == {10}
    assert [len(d["splits"][s]) for s in ("dev", "test", "smoke")] == [48, 72, 12]
    assert sum(len(q["sku"]) > 1 for q in d["qrels"]) >= 30
    assert sum("knowledge" in c["taskScopes"] for c in d["cases"]) >= 40
    assert sum("java-safety" in c["taskScopes"] for c in d["cases"]) >= 20
    assert d["validation"]["reviewed"] == 0


@pytest.mark.parametrize("mutation,reason", [
    (lambda d: d["products"].append(d["products"][0]), "duplicate"),
    (lambda d: d["qrels"][0]["sku"].update(unknown=2), "dangling"),
    (lambda d: d["products"][0]["skus"][0].update(priceCent=-1), "price"),
    (lambda d: d["products"][0]["skus"][0].update(reserved=100), "stock"),
    (lambda d: d["annotations"][0].update(caseHash="wrong"), "snapshot"),
    (lambda d: d["cases"][4].update(familyId=d["cases"][0]["familyId"]), "family"),
    (lambda d: d["cases"][4].update(originalQuery=d["cases"][0]["originalQuery"]), "query"),
    (lambda d: d["qrels"][0]["document"].update({"d12-v1": 2}), "unauthorized"),
    (lambda d: d["annotations"][0].update(reviewStatus="HUMAN_REVIEWED"), "human review"),
])
def test_invalid_data_is_rejected(data, mutation, reason):
    mutation(data)
    with pytest.raises(DatasetError, match=reason):
        validate(data)


def test_fake_accepted_manifest_cannot_promote_unreviewed_gold(data):
    data["manifest"]["status"] = "ACCEPTED"
    with pytest.raises(DatasetError, match="unreviewed"):
        validate(data, formal=True)


@pytest.mark.parametrize("changes", [
    {"reviewer": "  "},
    {"reviewedAt": "not-a-date"},
    {"annotationSource": "  "},
    {"disputed": True},
    {"disputed": 0},
])
def test_formal_validation_rejects_malformed_human_review(data, changes):
    data["manifest"]["status"] = "ACCEPTED"
    for annotation in data["annotations"]:
        annotation.update(reviewStatus="HUMAN_REVIEWED", reviewer="human-1",
                          reviewedAt="2026-11-10T10:00:00Z", annotationSource="AI_ASSISTED",
                          disputed=False)
    data["annotations"][0].update(changes)
    with pytest.raises(DatasetError, match="invalid human review"):
        validate(data, formal=True)


def test_formal_validation_accepts_structurally_complete_review_records(data):
    data["manifest"]["status"] = "ACCEPTED"
    data["manifest"]["reviewedNearDuplicates"] = data["validation"]["nearDuplicateWarnings"]
    for annotation in data["annotations"]:
        annotation.update(reviewStatus="HUMAN_REVIEWED", reviewer="human-1",
                          reviewedAt="2026-11-10T10:00:00Z", annotationSource="AI_ASSISTED",
                          disputed=False)
    assert validate(data, formal=True)["reviewed"] == 120


def test_file_tampering_is_detected(tmp_path):
    path = generate(tmp_path / "dataset")
    with (path / "qrels.jsonl").open("a", encoding="utf-8") as f:
        f.write("{}\n")
    with pytest.raises(DatasetError, match="hash mismatch"):
        load(path)


def test_review_export_never_overwrites_human_annotations(tmp_path, data):
    from evaluation.review import export
    annotations = tmp_path / 'annotations.jsonl'
    annotations.write_text('human work in progress\n', encoding='utf-8')
    with pytest.raises(FileExistsError):
        export(tmp_path / 'new-review.html', data)
    assert annotations.read_text(encoding='utf-8') == 'human work in progress\n'
    assert not (tmp_path / 'new-review.html').exists()


def test_debiased_dataset_fixes_title_leakage_negation_and_public_knowledge_gold(data):
    products = {p["productId"]: p for p in data["products"]}
    docs = {d["documentId"]: d for d in data["knowledge"]}
    qrels = {q["caseId"]: q for q in data["qrels"]}
    assert len({p["categoryCode"] for p in data["products"]}) >= 6
    assert data["validation"]["nearDuplicateWarnings"] == []
    for case in data["cases"]:
        qr = qrels[case["caseId"]]
        if case["queryType"] == "fuzzy-use":
            for pid in case["relevantProductIds"]:
                title = products[pid]["title"]
                assert title not in case["originalQuery"]
                assert title.split("校园系列", 1)[0] not in case["originalQuery"]
        elif case["queryType"] == "followup":
            assert "校园系列" not in case["originalQuery"]
        elif case["queryType"] == "attributes-negation":
            assert case["constraints"]["forbiddenAttributes"] == {"pack": "family"}
            for sid in qr["sku"]:
                assert not sid.endswith("-1")
        elif case["queryType"] == "public-knowledge":
            assert case["expectedBehavior"]["action"] == "KNOWLEDGE_ONLY"
            assert qr["product"] == {} and qr["sku"] == {}
            assert len(qr["document"]) == 2
            doc_ids = list(qr["document"])
            # 同一政策主题的两个公开门店文档（编号相差 6），避免无关政策充当 grade-1。
            nums = sorted(int(did[1:3]) for did in doc_ids)
            assert nums[1] - nums[0] == 6
            assert all(docs[did]["visibility"] == "PUBLIC" for did in doc_ids)

