"""生成确定性合成评测集 campus-shopping-v2（草稿状态，保留 campus-shopping-v1 不变）。

已通过人工复核并冻结的数据集禁止覆盖。所有标注均保持 AI_ASSISTED / DRAFT，不伪造人工审批记录。
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .dataset import DATASETS, load, write_json, write_jsonl
from .v2_builder.catalog_products import build_products
from .v2_builder.challenge_cases import build_challenge_cases
from .v2_builder.gold_solver import CHUNK_LENGTH, CHUNK_OVERLAP, solve_dataset_gold
from .v2_builder.merchants_and_knowledge import build_knowledge, build_merchants
from .v2_builder.scenarios_part1 import build_scenarios_part1
from .v2_builder.scenarios_part2 import build_scenarios_part2

SEED = 20261127
SNAPSHOT_AT = "2026-11-27T00:00:00Z"
DATASET_VERSION = "2.0-draft"
ANNOTATION_VERSION = "v2-draft-1"
GENERATOR_VERSION = "v2-full-corpus-solver-1"


def generate_v2(target: str | Path | None = None) -> Path:
    path = Path(target) if target else DATASETS / "campus-shopping-v2"
    manifest_path = path / "manifest.json"
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        if existing.get("status") != "DRAFT":
            raise RuntimeError("refusing to overwrite reviewed dataset")

    merchants = build_merchants()
    products, product_meta = build_products()
    knowledge, knowledge_meta = build_knowledge()
    blueprints = build_scenarios_part1() + build_scenarios_part2()
    challenge = build_challenge_cases()

    cases, qrels, annotations, splits, solver_stats = solve_dataset_gold(
        merchants_payload=merchants,
        products=products,
        product_meta=product_meta,
        knowledge=knowledge,
        knowledge_meta=knowledge_meta,
        blueprints=blueprints,
        dataset_version=DATASET_VERSION,
        annotation_version=ANNOTATION_VERSION,
    )

    write_json(path / "merchants.json", merchants)
    write_jsonl(path / "products.jsonl", products)
    write_jsonl(path / "knowledge.jsonl", knowledge)
    write_jsonl(path / "cases.jsonl", cases)
    write_jsonl(path / "qrels.jsonl", qrels)
    write_jsonl(path / "annotations.jsonl", annotations)
    write_json(path / "splits.json", splits)
    write_jsonl(path / "challenge.jsonl", challenge)

    tracked_files = (
        "merchants.json",
        "products.jsonl",
        "knowledge.jsonl",
        "cases.jsonl",
        "qrels.jsonl",
        "annotations.jsonl",
        "splits.json",
        "challenge.jsonl",
    )
    manifest = {
        "schemaVersion": 1,
        "datasetId": "campus-shopping-v2",
        "version": DATASET_VERSION,
        "status": "DRAFT",
        "synthetic": True,
        "dataOrigin": "SYNTHETIC_BENCHMARK_ONLY",
        "annotationVersion": ANNOTATION_VERSION,
        "generatorVersion": GENERATOR_VERSION,
        "seed": SEED,
        "snapshotAt": SNAPSHOT_AT,
        "reviewedNearDuplicates": [],
        "chunking": {"length": CHUNK_LENGTH, "overlap": CHUNK_OVERLAP},
        "summaryStats": solver_stats,
        "files": {
            name: hashlib.sha256((path / name).read_bytes()).hexdigest()
            for name in tracked_files
        },
    }
    write_json(manifest_path, manifest)
    load(path)
    return path


if __name__ == "__main__":
    out = generate_v2()
    loaded = load(out)
    print(json.dumps({"path": str(out), "validation": loaded["validation"]}, ensure_ascii=False, indent=2))
