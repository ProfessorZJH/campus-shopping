"""真实FastAPI/SQLite；LLM由明确的协议替身提供，不代表真实模型效果。"""
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def api(tmp_path):
    app = create_app(Settings(api_key='spec-test-only-shared-key-32chars', db_path=str(tmp_path / 'knowledge.db')))
    with TestClient(app, headers={'X-Service-Key': 'spec-test-only-shared-key-32chars'}) as client:
        yield app, client


def offers():
    return [dict(skuId=key, merchantId='m', title='考试签字笔', specKey=spec,
                 description='家庭装和标准装均可购买', priceCent=price, available=stock)
            for key, spec, price, stock in [('family', '家庭装', 100, 30), ('standard', '标准装', 200, 5)]]


def ask(api, question, items=None, history=None, **kwargs):
    response = api[1].post('/v1/query', json=dict(question=question, offers=offers() if items is None else items,
                        allowedDocumentIds=[], history=history or [], **kwargs))
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize('question', [
    '考试签字笔要标准装，不要家庭装', '考试签字笔不要家庭装',
    '不要推荐家庭装，考试签字笔选标准装', '考试签字笔不要家庭装和礼盒装，要标准装',
    '家庭装不要，考试签字笔要标准装', '不要家庭装要标准装考试签字笔',
    '考试签字笔不喜欢家庭装', '考试签字笔不接受家庭装', '考试签字笔别买家庭装',
])
def test_explicit_spec_and_negation_cannot_be_overridden_by_ranking(api, question):
    data = ask(api, question, semanticSkuIds=['family'])
    assert [r['skuId'] for r in data['recommendations']] == ['standard']
    assert '家庭装）' not in data['answer']


@pytest.mark.parametrize('spec,other,question', [
    ('500ml', '1500ml', '考试签字笔只要500ML，不要1500ml'),
    ('颜色:黑色;包装:标准装', '颜色:红色;包装:家庭装', '考试签字笔要黑色标准装，不要红色'),
    ('礼盒装', '散装', '考试签字笔要礼盒装，不要散装'),
])
def test_specs_are_grounded_in_offer_values_not_evaluation_names(api, spec, other, question):
    items = offers()
    items[0]['specKey'], items[1]['specKey'] = other, spec
    assert [r['skuId'] for r in ask(api, question, items)['recommendations']] == ['standard']


@pytest.mark.parametrize('question', [
    '考试签字笔要标准装，也要家庭装', '考试签字笔要标准装，不要标准装',
    '考试签字笔要礼盒装', '考试签字笔要500ml', '考试签字笔不是不要标准装',
    '考试签字笔家庭装和标准装都不要',
])
def test_conflicting_or_unverifiable_specs_clarify_without_substitution(api, question):
    data = ask(api, question)
    assert not data['recommendations']
    assert '规格' in data['answer'] and '明确' in data['answer']


def test_negative_spec_requires_spec_evidence_not_description(api):
    items = offers()
    items[1]['specKey'] = '默认'
    assert not ask(api, '考试签字笔不要家庭装', items)['recommendations']


def test_unconstrained_query_keeps_normal_recommendations(api):
    assert {r['skuId'] for r in ask(api, '推荐考试签字笔')['recommendations']} == {'standard', 'family'}


def test_product_name_is_not_misparsed_as_unknown_color_spec(api):
    data = ask(api, '校园活动需要考试黑色签字笔，有哪些商品')
    assert {r['skuId'] for r in data['recommendations']} == {'standard', 'family'}
    data = ask(api, '要两件考试黑色签字笔')
    assert data['recommendations'] and all(r['quantity'] == 2 for r in data['recommendations'])
    assert '规格' not in data['warning']
    assert not ask(api, '考试签字笔规格为蓝色')['recommendations']


def test_followup_inherits_specs_but_new_dimension_value_replaces_old(api):
    history = [{'role': 'user', 'content': '考试签字笔要标准装，不要家庭装'},
               {'role': 'assistant', 'content': '家庭装更便宜'}]
    assert [r['skuId'] for r in ask(api, '这个便宜点', history=history, retrievalQuery='家庭装')['recommendations']] == ['standard']
    assert [r['skuId'] for r in ask(api, '这个换成家庭装', history=history)['recommendations']] == ['family']
    assert {r['skuId'] for r in ask(api, '推荐考试签字笔', history=history)['recommendations']} == {'family', 'standard'}


def test_budget_quantity_and_stock_still_apply_after_spec_filter(api):
    assert not ask(api, '预算3元买两件标准装考试签字笔')['recommendations']
    items = offers()
    items[1]['available'] = 1
    assert not ask(api, '预算10元买两件标准装考试签字笔', items)['recommendations']
    data = ask(api, '预算4元买两件标准装考试签字笔')
    assert [(r['skuId'], r['quantity']) for r in data['recommendations']] == [('standard', 2)]


@pytest.mark.parametrize('behavior', ['valid', 'forbidden', 'mixed', 'failure'])
def test_llm_uses_same_filtered_candidates_and_safe_fallback(api, monkeypatch, behavior):
    app, _ = api
    app.state.store.settings = replace(app.state.store.settings, llm_key='unit-test-stub')
    seen = []
    def complete(system, payload):
        seen.append(payload)
        assert [o['skuId'] for o in payload['candidates']] == ['standard']
        if behavior == 'failure': raise TimeoutError('controlled failure')
        ids = ['standard'] if behavior == 'valid' else ['family'] if behavior == 'forbidden' else ['standard', 'family']
        return dict(answer='模型不应保留的错误家庭装解释' if behavior != 'valid' else '建议标准装',
                    recommendations=[dict(skuId=s, quantity=1) for s in ids])
    monkeypatch.setattr(app.state.store.provider, 'complete', complete)
    data = ask(api, '考试签字笔要标准装，不要家庭装')
    assert seen and [r['skuId'] for r in data['recommendations']] == ['standard']
    assert data['mode'] == ('LLM' if behavior == 'valid' else 'LOCAL_FALLBACK')
    if behavior != 'valid': assert '错误家庭装解释' not in data['answer']


def test_shared_java_python_spec_contract():
    import json
    from pathlib import Path
    from app.sku_constraints import spec_constraints
    from app.engine import FOLLOWUP
    rows = json.loads((Path(__file__).resolve().parents[2] / 'campus-shopping-app/src/test/resources/sku-contract.json').read_text(encoding='utf-8'))
    for row in rows:
        items = [dict(title=row['titles'][0], specKey=s) for s in row['specs']]
        specs = spec_constraints(row['question'], [dict(role='user', content=h) for h in row['history']], items, FOLLOWUP)
        assert [s for s in row['specs'] if specs.accepts(dict(specKey=s))] == row['accepted'], row['question']


@pytest.mark.parametrize('field', ['answer', 'reason'])
def test_model_text_cannot_reintroduce_forbidden_spec(api, monkeypatch, field):
    app, _ = api
    app.state.store.settings = replace(app.state.store.settings, llm_key='unit-test-stub')
    def complete(system, payload):
        return dict(answer='建议家庭装，适合你' if field == 'answer' else '建议标准装',
                    recommendations=[dict(skuId='standard', reason='家庭装更适合' if field == 'reason' else '规格已核实')])
    monkeypatch.setattr(app.state.store.provider, 'complete', complete)
    data = ask(api, '要标准装，不要家庭装')
    assert [r['skuId'] for r in data['recommendations']] == ['standard']
    assert '家庭装' not in data['answer']
    assert all('家庭装' not in r['reason'] for r in data['recommendations'])
