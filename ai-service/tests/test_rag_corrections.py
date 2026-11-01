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


def test_indexed_citations_keep_document_version(tmp_path):
    store = KnowledgeStore(Settings('test-only-service-key-123456', str(tmp_path / 'knowledge.db')))
    try:
        store.index('versioned', '退款说明', '版本三的退款说明。', version=3)
        citations, _ = store.search('退款说明', ['versioned'])
        assert citations and all(item['documentVersion'] == 3 for item in citations)
    finally:
        store.close()
