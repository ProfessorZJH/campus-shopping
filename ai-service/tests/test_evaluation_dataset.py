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
