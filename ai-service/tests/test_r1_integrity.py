import copy
import json
import re
from pathlib import Path

import pytest

from app.engine import purchase_constraints, answer
from app.config import Settings
from app.retrieval import KnowledgeStore
from evaluation.dataset import load
from evaluation.java_adapter import read_export
from evaluation.runner import run
from evaluation.reports import new_run


def test_shared_purchase_contract():
    rows = json.loads((Path(__file__).resolve().parents[2] / 'campus-shopping-app/src/test/resources/purchase-contract.json').read_text('utf-8'))
    for row in rows:
        b, q = purchase_constraints(row['question'], [dict(role='user', content=s) for s in row['history']])
        assert b[0] == row['budgetCent'] and q[0] == row['quantity'], row
        assert (b[1] in ('AMBIGUOUS', 'INVALID') or q[1] in ('AMBIGUOUS', 'INVALID')) == row['clarify'], row


@pytest.mark.parametrize('with_evidence', [False, True])
def test_model_cannot_claim_transaction_completion_without_quotes(tmp_path, with_evidence):
    from dataclasses import replace
    store = KnowledgeStore(Settings('test-only-service-key-123456', str(tmp_path / 'k.db')))
    try:
        store.index('policy', '退款说明', '申请退款需要在订单页填写售后原因。')
        store.settings = replace(store.settings, llm_key='test-only')
        store.provider.complete = lambda *args: dict(answer='已付款并退款成功', recommendations=[])
        result = answer(store, '怎么申请退款', ['policy'] if with_evidence else [], [], [])
        assert '已付款' not in result['answer'] and '退款成功' not in result['answer']
        if with_evidence: assert '填写售后原因' in result['answer']
    finally:
        store.close()


@pytest.mark.parametrize('mutation', ['missing-stage', 'bad-stage', 'missing-proof', 'zero-success', 'failed-proof', 'none'])
def test_java_executed_requires_stages_and_successful_proof(tmp_path, mutation):
    data = load()
    rows = [dict(caseId=cid, experiment='P-L', status='EXECUTED', stages={'product.fused': [], 'sku.pool': []},
                 provenance={'javaMysql': dict(source=['REAL'], attempts=1, success=1, failure=0)}) for cid in data['splits']['smoke']]
    if mutation == 'missing-stage': rows[0]['stages'].pop('sku.pool')
    if mutation == 'bad-stage': rows[0]['stages']['sku.pool'] = None
    if mutation == 'missing-proof': rows[0]['provenance'] = {}
    if mutation == 'zero-success': rows[0]['provenance']['javaMysql'].update(attempts=0, success=0)
    if mutation == 'failed-proof': rows[0]['provenance']['javaMysql'].update(attempts=2, failure=1)
    path = tmp_path / 'java.json'
    path.write_text(json.dumps(dict(datasetHash=data['datasetHash'], adapter='java-mysql', profile='local', split='smoke',
                                   database='campus_shopping_it', fixtureLoadedViaDomains=True, rows=rows)), 'utf-8')
    if mutation == 'none':
        assert len(read_export(path, data, profile='local', split='smoke', experiments=('P-L',))) == len(rows)
    else:
        with pytest.raises(ValueError):
            read_export(path, data, profile='local', split='smoke', experiments=('P-L',))


def test_imported_cleanup_failure_affects_exit_code(tmp_path):
    data = load()
    rows = [dict(caseId=cid, experiment='P-L', status='EXECUTED', stages={'product.fused': [], 'sku.pool': []},
                 provenance={'javaMysql': dict(source=['REAL'], attempts=1, success=1, failure=0)}) for cid in data['splits']['smoke']]
    result = run(data, new_run(tmp_path / 'run'), split='smoke', adapter='java-mysql', experiments=('P-L',), java_rows=rows,
                 java_metadata={'resources': [dict(cleanup='FAILED:TimeoutError')]})
    assert result['exitCode'] == 1 and result['status'] == 'FAILED' and not result['cleanupSuccessful']


def test_release_strict_rejects_draft_without_claiming_pass(tmp_path):
    from evaluation.cli import main
    assert main(['--dataset', 'campus-shopping-v1', '--release-strict', '--output-dir', str(tmp_path / 'run')]) == 2
    assert not (tmp_path / 'run').exists()


def test_review_export_uses_safe_anchors_for_all_untrusted_ids(tmp_path):
    from evaluation.review import export
    data = copy.deepcopy(load())
    for kind, key, qrel in [('products', 'productId', 'product'), ('knowledge', 'documentId', 'document'), ('cases', 'caseId', None)]:
        old = data[kind][0][key]
        malicious = old + '\" onclick=\"alert(1)\"><script>alert(1)</script>'
        data[kind][0][key] = malicious
        for q in data['qrels']:
            if qrel and old in q[qrel]: q[qrel][malicious] = q[qrel].pop(old)
            if not qrel and q['caseId'] == old: q['caseId'] = malicious
    path = export(tmp_path / 'review.html', data)
    html = path.read_text('utf-8')
    assert '<script>' not in html and ' onclick="' not in html
    assert all(re.fullmatch(r'(case|product|document)-[a-f0-9]{64}', value) for value in re.findall(r'\bid="([^"]+)"', html))
