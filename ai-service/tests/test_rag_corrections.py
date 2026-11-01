import copy
import uuid

from app.engine import FOLLOWUP
from app.config import Settings
from app.retrieval import KnowledgeStore
from app.sku_constraints import spec_constraints
from evaluation.dataset import load
from evaluation.metrics import evidence_metrics


def test_structured_attributes_are_required_for_semantic_negation():
    offers = [
        {'title': '无糖茶', 'specKey': '500ml', 'attributes': {'sugar': '无糖'}},
        {'title': '茶', 'specKey': '500ml', 'attributes': {}},
    ]
    constraint = spec_constraints('不要含糖饮料', [], offers, FOLLOWUP)
    assert constraint.active
    assert constraint.accepts(offers[0]) is False
    assert constraint.accepts(offers[1]) is False


def test_evidence_recall_does_not_equal_citation_validity():
    data = load()
    case = copy.deepcopy(data['cases'][0])
    doc = data['knowledge'][0]
    case['relevantEvidenceIds'] = [doc['documentId'], 'missing-gold-document']
    chunk_id = str(uuid.uuid5(uuid.NAMESPACE_URL, doc['documentId'] + ':0'))
    result = {'answer': '回答', 'citations': [{'documentId': doc['documentId'], 'chunkId': chunk_id,
                                                'snippet': doc['content'][:50]}]}
    metrics = evidence_metrics(data, case, result)
    assert metrics['citationValidity']['value'] == 1
    assert metrics['evidenceRecall']['value'] == .5
    assert metrics['evidenceCoverage']['value'] == 0


def test_invalid_relevant_chunk_does_not_count_as_evidence_recall():
    data = load()
    case = copy.deepcopy(data['cases'][0])
    doc = data['knowledge'][0]
    case['relevantEvidenceIds'] = [doc['documentId']]
    result = {'answer': '回答', 'citations': [{'documentId': doc['documentId'], 'chunkId': 'wrong',
                                                'snippet': doc['content'][:50]}]}
    metrics = evidence_metrics(data, case, result)
    assert metrics['citationValidity']['value'] == 0
    assert metrics['evidenceRecall']['value'] == 0


def test_indexed_citations_keep_document_version(tmp_path):
    store = KnowledgeStore(Settings('test-only-service-key-123456', str(tmp_path / 'knowledge.db')))
    try:
        store.index('versioned', '退款说明', '版本三的退款说明。', version=3)
        citations, _ = store.search('退款说明', ['versioned'])
        assert citations and all(item['documentVersion'] == 3 for item in citations)
    finally:
        store.close()


def test_semantic_rank_uses_trusted_input_order():
    """Python must preserve Java's semantic SKU order instead of eligible offer order."""
    from app.engine import answer

    class Store:
        settings = Settings('test-only-service-key-123456', ':memory:')

        class Provider:
            pass

        provider = Provider()

        def search(self, *args, **kwargs):
            return [], 'LOCAL_CHAR_NGRAM_DEMO'

    result = answer(Store(), 'xyz', [], [
        {'skuId': 'a', 'merchantId': 'm', 'title': '苹果', 'specKey': '标准装', 'description': '', 'priceCent': 100, 'available': 1},
        {'skuId': 'b', 'merchantId': 'm', 'title': '香蕉', 'specKey': '标准装', 'description': '', 'priceCent': 100, 'available': 1},
    ], [], semantic_sku_ids=['b', 'a'])
    assert result['recommendations'][0]['skuId'] == 'b'


def test_unknown_negative_attribute_stays_ambiguous_with_known_positive_attribute():
    offers = [
        {'title': '茶', 'specKey': '标准装', 'attributes': {}},
    ]
    constraint = spec_constraints('要标准装，不要含糖饮料', [], offers, FOLLOWUP)
    assert constraint.ambiguous
