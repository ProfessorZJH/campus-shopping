import pytest
from app.config import Settings
from app.retrieval import KnowledgeStore
from app.engine import answer


def test_default_knowledge_snapshot_and_strategy_trace(tmp_path):
    store = KnowledgeStore(Settings('evaluation-no-external-123456', str(tmp_path / 'k.db')))
    try:
        store.index('a', '退款规则', '未提货可全额模拟退款。')
        store.index('b', '自提规则', '自提凭证有效期二十分钟。')
        default, mode = store.search('未提货退款', ['a', 'b'])
        trace = {}
        explicit, same_mode = store.search('未提货退款', ['a', 'b'], _strategy='hybrid', _trace=trace)
        assert default == explicit and mode == same_mode == 'LOCAL_CHAR_NGRAM_DEMO'
        assert [r['documentId'] for r in default] == ['a', 'b']
        assert trace['selected'] == [r['chunkId'] for r in default]
        store.provider.embed = lambda *a, **k: pytest.fail('sparse must not embed')
        sparse, _ = store.search('未提货退款', ['a', 'b'], _strategy='sparse')
        assert sparse[0]['documentId'] == 'a'
    finally:
        store.close()


def test_recommendation_stage_limits_and_default_equivalence(tmp_path):
    store = KnowledgeStore(Settings('evaluation-no-external-123456', str(tmp_path / 'k.db')))
    offers = [{'skuId': str(i), 'title': '黑色签字笔', 'specKey': '标准装', 'available': 2, 'priceCent': 100}
              for i in range(20)] + [{'skuId': 'out', 'title': '签字笔', 'specKey': '', 'available': 0, 'priceCent': 100}]
    try:
        trace = {}
        first = answer(store, '预算3元买签字笔', [], offers, [], _trace=trace)
        second = answer(store, '预算3元买签字笔', [], offers, [])
        for result in (first, second):
            result.pop('latencyMs')
        assert first == second
        assert len(trace['offers']) == 21 and len(trace['eligible']) == 20
        assert len(trace['candidates']) == 12 and len(trace['selected']) == 3
        assert trace['selected'] == ['0', '1', '2']
    finally:
        store.close()
