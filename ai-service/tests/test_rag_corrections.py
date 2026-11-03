import copy
import hashlib
import json
import sqlite3
import uuid

from app.engine import FOLLOWUP
from app.config import Settings
from app.retrieval import KnowledgeStore
from app.sqlite_migration import migrate
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


def test_new_citation_protocol_checks_version_and_chunk_hash():
    data = load()
    case = copy.deepcopy(data['cases'][0])
    doc = data['knowledge'][0]
    piece = doc['content']
    chunk_id = str(uuid.uuid5(uuid.NAMESPACE_URL, doc['documentId'] + ':0'))
    result = {'answer': '回答', 'citations': [{'documentId': doc['documentId'], 'chunkId': chunk_id,
                                                'snippet': piece[:50], 'documentVersion': 99,
                                                'ordinal': 0, 'contentHash': hashlib.sha256(piece.encode()).hexdigest()}]}
    metrics = evidence_metrics(data, case, result)
    assert metrics['citationValidity']['value'] == 0
    assert metrics['strictCitationValidity']['value'] == 0
    assert metrics['legacyCitationCount']['value'] == 0


def test_strict_citation_denominator_includes_unauthorized_new_protocol():
    data = load()
    case = copy.deepcopy(data['cases'][0])
    allowed = data['knowledge'][0]
    unauthorized = next(doc for doc in data['knowledge'] if doc['documentId'] not in case['allowedDocumentIds'])
    allowed_piece = allowed['content']
    unauthorized_piece = unauthorized['content']
    result = {'answer': '回答', 'citations': [
        {'documentId': allowed['documentId'], 'chunkId': str(uuid.uuid5(uuid.NAMESPACE_URL, allowed['documentId'] + ':0')),
         'snippet': allowed_piece[:20], 'documentVersion': allowed['version'], 'ordinal': 0,
         'contentHash': hashlib.sha256(allowed_piece.encode()).hexdigest()},
        {'documentId': unauthorized['documentId'], 'chunkId': str(uuid.uuid5(uuid.NAMESPACE_URL, unauthorized['documentId'] + ':0')),
         'snippet': unauthorized_piece[:20], 'documentVersion': unauthorized['version'], 'ordinal': 0,
         'contentHash': hashlib.sha256(unauthorized_piece.encode()).hexdigest()},
    ]}
    metrics = evidence_metrics(data, case, result)
    assert metrics['strictCitationValidity']['numerator'] == 1
    assert metrics['strictCitationValidity']['denominator'] == 2


def test_legacy_citation_count_once_with_mixed_authorization_and_protocols():
    data = load()
    case = copy.deepcopy(data['cases'][0])
    allowed = data['knowledge'][0]
    unauthorized = next(doc for doc in data['knowledge'] if doc['documentId'] not in case['allowedDocumentIds'])

    def legacy(doc):
        return {'documentId': doc['documentId'],
                'chunkId': str(uuid.uuid5(uuid.NAMESPACE_URL, doc['documentId'] + ':0')),
                'snippet': doc['content'][:20]}

    strict = {**legacy(allowed), 'documentVersion': allowed['version'], 'ordinal': 0,
              'contentHash': hashlib.sha256(allowed['content'].encode()).hexdigest()}
    result = {'answer': '回答', 'citations': [legacy(allowed), legacy(unauthorized), strict]}
    metrics = evidence_metrics(data, case, result)
    assert metrics['legacyCitationCount']['numerator'] == 2
    assert metrics['legacyCitationCount']['denominator'] == 3
    assert metrics['strictCitationValidity']['numerator'] == 1
    assert metrics['strictCitationValidity']['denominator'] == 1
    assert metrics['citationValidity']['numerator'] == 2
    assert metrics['citationValidity']['denominator'] == 3


def test_indexed_citations_keep_document_version(tmp_path):
    store = KnowledgeStore(Settings('test-only-service-key-123456', str(tmp_path / 'knowledge.db')))
    try:
        store.index('versioned', '退款说明', '版本三的退款说明。', version=3)
        citations, _ = store.search('退款说明', ['versioned'])
        assert citations and all(item['documentVersion'] == 3 for item in citations)
    finally:
        store.close()


def test_chunks_strip_unicode_space_and_preserve_emoji():
    pieces = __import__('app.retrieval', fromlist=['chunks']).chunks('\u3000\u00a0😀 退款规则\u00a0\u3000')
    assert pieces == ['😀 退款规则']


def test_legacy_sqlite_rows_are_not_claimed_as_version_one(tmp_path):
    path = tmp_path / 'legacy.db'
    db = sqlite3.connect(path)
    db.execute('CREATE TABLE docs(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,model TEXT NOT NULL,updated REAL NOT NULL,version INTEGER NOT NULL DEFAULT 1)')
    db.execute('CREATE TABLE chunks(id TEXT PRIMARY KEY,doc_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,ordinal INTEGER NOT NULL,embedding TEXT NOT NULL,model TEXT NOT NULL)')
    body = '旧版本知识'
    db.execute('INSERT INTO docs VALUES(?,?,?,?,?)', ('legacy', hashlib.sha256(('标题\0' + body).encode()).hexdigest(), 'local-char-ngram-v1', 0, 1))
    db.execute('INSERT INTO chunks VALUES(?,?,?,?,?,?,?)', ('chunk', 'legacy', '标题', body, 0, json.dumps([1.0]), 'local-char-ngram-v1'))
    db.commit(); db.close()
    migrate(str(path))
    store = KnowledgeStore(Settings('test-only-service-key-123456', str(path)))
    try:
        citations, _ = store.search('旧版本', ['legacy'])
        assert citations == []
        store.index('legacy', '标题', body, version=7)
        citations, _ = store.search('旧版本', ['legacy'])
        assert citations and citations[0]['documentVersion'] == 7
    finally:
        store.close()


def test_evidence_recall_uses_gold_chunks_when_available():
    data = load()
    case = copy.deepcopy(next(c for c in data['cases'] if c['caseId'] == 'case-073'))
    doc = next(d for d in data['knowledge'] if d['documentId'] == 'd02-v1')
    pieces = __import__('app.retrieval', fromlist=['chunks']).chunks(doc['content'])
    case['relevantEvidenceIds'] = [doc['documentId']]
    qrel = next(q for q in data['qrels'] if q['caseId'] == case['caseId'])
    qrel['evidence'] = [{'documentId': doc['documentId'], 'ordinal': 1,
                         'chunkHash': hashlib.sha256(pieces[1].encode()).hexdigest(), 'grade': 2}]
    chunk_id = str(uuid.uuid5(uuid.NAMESPACE_URL, doc['documentId'] + ':0'))
    result = {'answer': '回答', 'citations': [{'documentId': doc['documentId'], 'chunkId': chunk_id,
                                                'snippet': pieces[0][:20], 'documentVersion': doc['version'],
                                                'ordinal': 0, 'contentHash': hashlib.sha256(pieces[0].encode()).hexdigest()}]}
    metrics = evidence_metrics(data, case, result)
    assert metrics['evidenceRecall']['value'] == 0
    assert metrics['evidenceRecall']['denominator'] == 1


def test_non_bmp_chunk_hash_uses_code_points():
    from app.retrieval import chunks

    text = '😀' * 700 + '尾'
    piece = chunks(text)[0]
    assert len(piece) == 700
    assert hashlib.sha256(piece.encode('utf-8')).hexdigest() == hashlib.sha256(('😀' * 700).encode('utf-8')).hexdigest()


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
