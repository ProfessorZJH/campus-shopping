"""手算口径与失败分母；不是业务效果验收。"""
import copy
import math
import uuid

import pytest
from evaluation.dataset import load
from evaluation.metrics import (ranked_metrics, percentile, recommendation_metrics,
                                evidence_metrics, score, aggregate, hard_violations)
from evaluation.comparisons import paired


def test_multigold_dedup_and_graded_ndcg():
    m = ranked_metrics(["X", "B", "B", "A"], {"A": 2, "B": 1, "C": 2}, 2)
    assert m["recall"]["value"] == 1 / 3
    assert m["hit"]["value"] == 1
    assert m["mrr"]["value"] == .5
    assert m["ndcg"]["value"] == pytest.approx((1 / math.log2(3)) / (3 + 3 / math.log2(3)))
    assert ranked_metrics(["B", "B", "A"], {"A": 2, "B": 1}, 2)["recall"]["value"] == 1


def test_missing_empty_and_not_run_are_distinct():
    assert ranked_metrics([], {}, 5)["recall"]["value"] is None
    assert ranked_metrics([], {"A": 2}, 5)["recall"]["value"] == 0
    assert ranked_metrics([], {"A": 2}, 5, attempted=False)["recall"]["status"] == "NOT_RUN"
    assert percentile([], .95) is None
    assert percentile(list(range(1, 21)), .95) == 19


@pytest.fixture
def sample():
    data = load()
    return data, copy.deepcopy(data["cases"][0]), data["qrels"][0]


def test_empty_does_not_pass_coverage(sample):
    data, case, qr = sample
    m = recommendation_metrics(data, case, {}, qr["sku"])
    assert m["constraintPass"]["value"] is None
    assert m["recommendationCoverage"]["value"] == 0
    assert m["requestSuccess"]["value"] == 0


def test_group_budget_attributes_stock_and_direct_grade(sample):
    data, case, qr = sample
    sku = data["products"][0]["skus"][0]
    items = [{"skuId": "s000-0", "quantity": 1}, {"skuId": "s120-0", "quantity": 1}]
    case["constraints"]["budgetCent"] = sku["priceCent"]
    m = recommendation_metrics(data, case, {"recommendations": items}, qr["sku"])
    assert m["constraint.budget"]["value"] == 0
    assert m["recommendationCoverage"]["value"] == 0
    case["constraints"]["budgetCent"] = None
    case["constraints"]["requiredAttributes"] = {"pack": "family"}
    assert recommendation_metrics(data, case, {"recommendations": items}, qr["sku"])["constraint.attributes"]["value"] == 0
    sku["onHand"] = sku["reserved"]
    assert recommendation_metrics(data, case, {"recommendations": items[:1]}, qr["sku"])["constraint.stock"]["value"] == 0


def test_source_validity_does_not_mean_grounded(sample):
    data, case, _ = sample
    doc = data["knowledge"][0]
    result = {"answer": "与原文矛盾的退款断言", "citations": [{"documentId": doc["documentId"],
              "chunkId": str(uuid.uuid5(uuid.NAMESPACE_URL, doc["documentId"] + ":0")),
              "snippet": doc["content"][:50]}]}
    pending = evidence_metrics(data, case, result)
    assert pending["citationValidity"]["value"] == 1
    assert pending["citationGrounded"]["value"] is None
    reviewed = evidence_metrics(data, case, result, {"reviewer": "human-1", "reviewedAt": "2026-10-31",
                                                   "assertions": [{"supported": False}]})
    assert reviewed["citationGrounded"]["value"] == 0
    case["sensitive"] = True
    case["expectedBehavior"]["forbiddenFacts"] = ["EVAL-CANARY-13"]
    result['rewrittenQuery'] = '用户询问EVAL-CANARY-13'
    assert evidence_metrics(data, case, result)["unauthorizedDisclosure"]["value"] == 0
    result["answer"] += " EVAL-CANARY-13"
    assert evidence_metrics(data, case, result)["unauthorizedDisclosure"]["value"] == 1


def test_failure_stays_in_macro_and_environments_stay_separate(sample):
    data, case, qr = sample
    base = {"experiment": "R-RULE", "profile": "local", "adapter": "python", "task": "recommendation",
            "stages": {"recommendations": []}, "latencyMs": 1}
    failed = dict(base, status="FAILED")
    failed["scores"] = score(data, case, qr, failed)
    ok = dict(base, status="EXECUTED", result={"recommendations": [{"skuId": "s000-0", "quantity": 1}]})
    ok["scores"] = score(data, case, qr, ok)
    remote = dict(ok, profile="controlled")
    groups = aggregate([failed, ok, remote])
    local = next(g for g in groups if g["profile"] == "local")
    assert len(groups) == 2
    assert local["metrics"]["recommendationCoverage"]["value"] == .5
    assert local["failed"] == 1
    assert local["latency"]["firstTokenMs"] is None


@pytest.mark.parametrize('experiment,task,adapter,stage,metric,unit', [
    ('K-B', 'knowledge', 'python', 'knowledge.documents', 'recall@1', 'document'),
    ('K-D', 'knowledge', 'python', 'knowledge.chunks', 'mrr@1', 'chunk'),
    ('K-H', 'knowledge', 'python', 'knowledge.documents', 'ndcg@3', 'document'),
    ('P-L', 'product', 'java-mysql', 'product.fused', 'recall@20', 'product'),
    ('P-D', 'product', 'java-mysql', 'sku.pool', 'recall@300', 'sku'),
    ('P-H', 'product', 'java-mysql', 'product.fused', 'hit@20', 'product'),
    ('R-RULE', 'recommendation', 'python', 'recommendations', 'recall@1', 'sku'),
    ('R-LLM', 'recommendation', 'python', 'recommendations', 'mrr@1', 'sku'),
])
def test_failed_empty_stages_keeps_ranked_macro_and_paired_denominators(sample, experiment, task, adapter, stage, metric, unit):
    from evaluation.metrics import chunk_grades
    data, case, qr = sample
    if task == 'knowledge':
        qr = next(q for q in data['qrels'] if q['document'] and q['evidence'])
        case = next(c for c in data['cases'] if c['caseId'] == qr['caseId'])
    base = dict(experiment=experiment, task=task, adapter=adapter, profile='local',
                caseId=case['caseId'], familyId=case['familyId'], latencyMs=None)
    failed = dict(base, status='FAILED', stages={})
    failed['scores'] = score(data, case, qr, failed)
    key = stage + '/' + metric
    assert failed['scores'][key]['value'] == 0
    assert failed['scores'][key]['denominator'] > 0
    grades = chunk_grades(data, qr) if unit == 'chunk' else qr[unit]
    ranking = sorted(grades, key=lambda k: grades[k], reverse=True)
    good = dict(base, status='EXECUTED', stages={stage: ranking}, result={'recommendations': [{'skuId': ranking[0], 'quantity': 1}]})
    good['scores'] = score(data, case, qr, good)
    not_run = dict(base, status='NOT_RUN', stages={})
    not_run['scores'] = score(data, case, qr, not_run)
    assert not_run['scores'][key]['status'] == 'NOT_RUN'
    group = aggregate([failed, good, not_run])[0]
    m = group['metrics'][key]
    assert (group['planned'], group['failed'], group['notRun'], m['scored'], m['notApplicableOrPending']) == (3, 1, 1, 2, 1)
    assert m['value'] == pytest.approx(good['scores'][key]['value'] / 2)
    metadata = dict(datasetHash='unit-fixture', split='dev', profile='local', adapter=adapter, configuration={})
    comparison = paired([good], [failed], key, metadata_left=metadata, metadata_right=metadata)
    assert comparison['pairedCases'] == 1 and comparison['meanDelta'] == -good['scores'][key]['value']
    no_gold = dict(qr, **{unit: {}}) if unit != 'chunk' else dict(qr, evidence=[])
    assert score(data, case, no_gold, failed)[key]['value'] is None


def test_python_recommendation_and_unrun_java_stages_do_not_masquerade_as_product_recall(sample):
    data, case, qr = sample
    row = dict(task='recommendation', experiment='R-RULE', adapter='python', status='FAILED', stages={})
    assert not any(k.startswith(('product.', 'sku.pool')) for k in score(data, case, qr, row))
    row.update(task='product', experiment='P-H', status='NOT_RUN')
    assert not any(k.startswith(('product.', 'sku.pool')) for k in score(data, case, qr, row))


def test_low_quality_and_empty_recommendations_are_not_hard_violations(sample):
    data, case, qr = sample
    empty = recommendation_metrics(data, case, {}, qr['sku'])
    assert empty['requestSuccess']['value'] == 0 and not hard_violations(empty)
    low_quality = ranked_metrics([], qr['sku'], 3)
    assert low_quality['recall']['value'] == 0 and not hard_violations(low_quality)
    with pytest.raises(ValueError, match='scorerVersion'):
        paired([], [], 'recall', metadata_left={'scorerVersion': '1'}, metadata_right={'scorerVersion': '2'})
