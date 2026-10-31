"""在真实runner异常/返回接缝注入失败，验证自动退出及离线重算；不调用真实供应商。"""
import copy
import json
import uuid

import pytest

from evaluation.cli import main
from evaluation.dataset import load
from evaluation.reports import new_run, recompute
from evaluation.runner import run


def single_case():
    data = copy.deepcopy(load())
    case = data['cases'][0]
    data['splits']['smoke'] = [case['caseId']]
    return data, case


@pytest.mark.parametrize('experiment', ['K-B', 'K-D', 'K-H', 'R-RULE', 'R-LLM'])
def test_real_runner_exception_with_no_trace_is_scored_zero(tmp_path, monkeypatch, experiment):
    import evaluation.runner as runner
    data, case = single_case()
    if experiment.startswith('K-'):
        qr = next(q for q in data['qrels'] if q['document'] and q['evidence'])
        case = next(c for c in data['cases'] if c['caseId'] == qr['caseId'])
        data['splits']['smoke'] = [case['caseId']]
        original = runner.KnowledgeStore.search
        calls = []
        def search(store, *args, **kwargs):
            calls.append(1)
            if len(calls) > 2:
                raise TimeoutError('controlled timeout')
            return original(store, *args, **kwargs)
        monkeypatch.setattr(runner.KnowledgeStore, 'search', search)
    else:
        def answer(*args, **kwargs):
            raise TimeoutError('controlled timeout')
        monkeypatch.setattr(runner, 'answer', answer)
    path = new_run(tmp_path / 'exception')
    manifest = run(data, path, split='smoke', experiments=(experiment,), profile='controlled')
    assert manifest['exitCode'] == 1
    rows = [json.loads(s) for s in (path / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
    assert all(r['status'] == 'FAILED' and r['stages'] == {} for r in rows)
    key = 'knowledge.documents/recall@1' if experiment.startswith('K-') else 'recommendations/recall@1'
    group = json.loads((path / 'metrics.json').read_text(encoding='utf-8'))[0]
    assert group['metrics'][key]['value'] == 0
    assert group['metrics'][key]['scored'] == group['planned'] == len(rows)
    assert recompute(path)[0]['metrics'][key] == group['metrics'][key]


@pytest.mark.parametrize('attack,expected', [
    ('budget', 'constraint.budget'), ('quantity', 'constraint.quantity'),
    ('attributes', 'constraint.attributes'), ('forbiddenAttributes', 'constraint.attributes'),
    ('duplicate', 'constraint.unique'), ('unknown', 'constraint.knownSku'),
    ('stock', 'constraint.stock'), ('publication', 'constraint.publication'), ('merchant', 'constraint.merchant'),
    ('unauthorizedCitation', 'citationValidity'), ('invalidCitation', 'citationValidity'), ('withdrawnCitation', 'citationValidity'),
    ('forbiddenFact', 'unauthorizedDisclosure'),
])
def test_hard_rule_violations_fail_runner_and_recompute(tmp_path, monkeypatch, attack, expected):
    import evaluation.runner as runner
    data, case = single_case()
    case['sensitive'] = False
    sku = data['products'][0]['skus'][0]
    items = [{'skuId': sku['skuId'], 'quantity': 1}]
    citations = []
    text = 'synthetic response'
    if attack == 'budget': case['constraints']['budgetCent'] = sku['priceCent'] - 1
    elif attack == 'quantity': case['constraints']['quantity'] = 2
    elif attack == 'attributes': case['constraints']['requiredAttributes'] = {'pack': 'family'}
    elif attack == 'forbiddenAttributes': case['constraints']['forbiddenAttributes'] = {'pack': 'standard'}
    elif attack == 'duplicate': items *= 2
    elif attack == 'unknown': items[0]['skuId'] = 'not-a-real-sku'
    elif attack == 'stock': sku['onHand'] = sku['reserved']
    elif attack == 'publication': data['products'][0]['status'] = 'UNPUBLISHED'
    elif attack == 'merchant': data['merchants']['merchants'][0]['status'] = 'SUSPENDED'
    elif attack in ('unauthorizedCitation', 'invalidCitation', 'withdrawnCitation'):
        doc = next(d for d in data['knowledge'] if d['status'] == 'PUBLISHED' and
                   (d['documentId'] not in case['allowedDocumentIds']) == (attack == 'unauthorizedCitation'))
        citations = [dict(documentId=doc['documentId'], title=doc['title'], snippet=doc['content'][:20],
                          chunkId=str(uuid.uuid5(uuid.NAMESPACE_URL, doc['documentId'] + ':0')) if attack != 'invalidCitation' else 'invalid-chunk')]
        if attack == 'withdrawnCitation': doc['status'] = 'WITHDRAWN'
    elif attack == 'forbiddenFact':
        case['expectedBehavior']['forbiddenFacts'] = ['CANARY-PRIVATE-UNIT-FIXTURE']
        text += ' CANARY-PRIVATE-UNIT-FIXTURE'
    def answer(*args, _trace, **kwargs):
        _trace.update(selected=[i['skuId'] for i in items], candidates=[sku['skuId']])
        return dict(answer=text, mode='LOCAL_RETRIEVAL_DEMO', citations=citations, recommendations=items)
    monkeypatch.setattr(runner, 'answer', answer)
    path = new_run(tmp_path / attack)
    manifest = run(data, path, split='smoke', experiments=('R-RULE',))
    assert manifest['exitCode'] == 1 and manifest['status'] == 'FAILED'
    assert expected in manifest['boundaryViolationDetails'][0]['metrics']
    # 即便manifest中的旧状态错误地标为成功，离线重算仍必须依据原始返回重新阻断。
    manifest.update(exitCode=0, status='PARTIAL', boundaryViolations=[], boundaryViolationDetails=[])
    (path / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    assert main(['--recompute', str(path)]) == 1
    recomputed = json.loads((path / 'manifest.json').read_text(encoding='utf-8'))
    assert recomputed['status'] == 'FAILED' and expected in recomputed['boundaryViolationDetails'][0]['metrics']


def test_empty_response_is_low_coverage_and_not_a_safety_failure(tmp_path, monkeypatch):
    import evaluation.runner as runner
    data, _ = single_case()
    def answer(*args, _trace, **kwargs):
        _trace.update(selected=[], candidates=[])
        return dict(answer='没有找到', mode='LOCAL_RETRIEVAL_DEMO', citations=[], recommendations=[])
    monkeypatch.setattr(runner, 'answer', answer)
    path = new_run(tmp_path / 'empty')
    manifest = run(data, path, split='smoke', experiments=('R-RULE',))
    assert manifest['exitCode'] == 0 and not manifest['boundaryViolations']
    assert json.loads((path / 'metrics.json').read_text(encoding='utf-8'))[0]['metrics']['requestSuccess']['value'] == 0


def test_old_scorer_report_cannot_be_silently_reinterpreted(tmp_path):
    path = new_run(tmp_path / 'old')
    (path / 'manifest.json').write_text(json.dumps({'scorerVersion': '1'}), encoding='utf-8')
    with pytest.raises(ValueError, match='scorer version mismatch'):
        recompute(path)
