"""容量、故障恢复和外发边界；HTTP供应商均为显式替身。"""
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.http_limits import bounded_json
from app.observability import ExecutionGate, counts, lock, observed
from app.egress import minimized

KEY = 'isolated-test-key-not-a-real-credential'


class Stream(httpx.SyncByteStream):
    def __init__(self, parts):
        self.parts, self.read, self.closed = parts, 0, False

    def __iter__(self):
        for part in self.parts:
            self.read += 1
            yield part

    def close(self):
        self.closed = True


@pytest.mark.parametrize('headers,parts,limit,ok', [
    ({}, [b'{"a":', b'1}'], 7, True),
    ({}, [b'x' * 65536, b'y' * 65536, b'unread'], 65536, False),
    ({'content-length': '1000'}, [b'unread'], 10, False),
    ({'content-encoding': 'gzip'}, [b'unread'], 10, False),
    ({'content-length': 'invalid'}, [b'unread'], 10, False),
])
def test_stream_limits_close_before_reading_remaining_body(headers, parts, limit, ok):
    stream = Stream(parts)
    transport = httpx.MockTransport(lambda req: httpx.Response(200, headers=headers, stream=stream))
    with httpx.Client(transport=transport) as client:
        if ok:
            assert bounded_json(client, 'GET', 'https://provider.test', limit=limit) == {'a': 1}
        else:
            with pytest.raises(ValueError):
                bounded_json(client, 'GET', 'https://provider.test', limit=limit)
    assert stream.closed
    if headers:
        assert stream.read == 0
    elif not ok:
        assert stream.read == 2


def test_gate_reports_capacity_rejection_and_recovery():
    gate = ExecutionGate(1)
    assert gate.acquire()
    assert not gate.acquire()
    assert gate.snapshot() == {'capacity': 1, 'active': 1, 'queued': 0, 'rejected': 1}
    gate.release()
    assert gate.acquire()
    gate.release()
    assert gate.snapshot()['active'] == 0


def test_readiness_auth_storage_and_dependency_recovery(tmp_path):
    app = create_app(Settings(KEY, str(tmp_path / 'ready.db')))
    with TestClient(app) as client:
        assert client.get('/ready').status_code == 401
        client.headers['X-Service-Key'] = KEY
        with lock:
            saved = dict(counts)
            counts.clear()
        try:
            assert client.get('/ready').json()['dependencies']['knowledge.index']['state'] == 'UNVERIFIED'
            @observed('knowledge.index')
            def dependency(fail):
                if fail:
                    raise RuntimeError('test-only')
            with pytest.raises(RuntimeError):
                dependency(True)
            assert client.get('/ready').json()['dependencies']['knowledge.index']['state'] == 'DEGRADED'
            dependency(False)
            assert client.get('/ready').json()['dependencies']['knowledge.index']['state'] == 'UP'
            app.state.store.db.close()
            assert client.get('/ready').status_code == 503
            # lifespan仍会调用close，SQLite重复close是幂等的。
        finally:
            with lock:
                counts.clear()
                counts.update(saved)


def test_private_index_never_calls_external_and_revocation_blocks_query(tmp_path, monkeypatch):
    settings = Settings(KEY, str(tmp_path / 'private.db'), embedding_url='https://embed.test',
                        embedding_key='test', embedding_model='remote-v1')
    app = create_app(settings)
    store = app.state.store
    calls = []
    monkeypatch.setattr(store.provider, 'embed', lambda texts, **kw: calls.append(texts) or [[1.0] for _ in texts])
    with TestClient(app, headers={'X-Service-Key': KEY}) as client:
        body = {'documentId': 'private', 'title': '内部', 'content': '内部退款说明'}
        assert client.post('/v1/index', json=body).status_code == 200
        assert calls == []
        store.index('direct', '内部', '库函数也默认禁止外发')
        assert calls == []
        body.update(documentId='approved', externalAllowed=True)
        assert client.post('/v1/index', json=body).status_code == 200
        assert len(calls) == 1
        store.search('退款', ['approved'], external_document_ids=[])
        assert len(calls) == 1
        store.search('退款', ['approved'], external_document_ids=['approved'])
        assert len(calls) == 2


def test_answer_payload_excludes_private_evidence_and_assistant_history(tmp_path, monkeypatch):
    from app.engine import answer
    app = create_app(Settings(KEY, str(tmp_path / 'payload.db'), llm_url='https://llm.test', llm_key='test', llm_model='test'))
    store = app.state.store
    store.index('private', '退款', '内部退款说明暗号9286')
    store.index('public', '退款', '公开退款说明')
    payloads = []
    monkeypatch.setattr(store.provider, 'complete', lambda system, payload: payloads.append(payload) or {})
    answer(store, '退款说明是什么', ['private', 'public'], [], [{'role': 'assistant', 'content': '敏感旧回答'}],
           retrieval_query='退款说明', external_document_ids=['public'])
    payload = next(p for p in payloads if 'authorizedEvidence' in p)
    assert all(e['documentId'] == 'public' for e in payload['authorizedEvidence'])
    assert '9286' not in json.dumps(payload, ensure_ascii=False)
    assert payload['history'] == []
    store.close()


def test_unapproved_index_skips_configured_qdrant_and_embedding(tmp_path, monkeypatch):
    app = create_app(Settings(KEY, str(tmp_path / 'no-egress.db'), qdrant_url='https://qdrant.test', qdrant_key='test',
                              embedding_url='https://embed.test', embedding_key='test', embedding_model='remote-v1'))
    def forbidden(*args, **kwargs):
        raise AssertionError('private content reached external dependency')
    monkeypatch.setattr(app.state.store.provider, 'embed', forbidden)
    monkeypatch.setattr(app.state.store, '_qdrant', forbidden)
    with TestClient(app, headers={'X-Service-Key': KEY}) as client:
        assert client.post('/v1/index', json={'documentId': 'private', 'title': '内部', 'content': '内部退款政策'}).status_code == 200
        result = client.post('/v1/query', json={'question': '退款政策', 'allowedDocumentIds': ['private'], 'offers': []})
        assert result.status_code == 200 and result.json()['citations']


def test_provider_redacts_content_and_logs_only_metadata(tmp_path, monkeypatch, caplog):
    from app.retrieval import Provider
    provider = Provider(Settings(KEY, str(tmp_path / 'redact.db'), llm_url='https://llm.test', llm_key='test', llm_model='test'))
    sent = []
    def receive(client, method, url, **kwargs):
        sent.append(kwargs['json'])
        return {'choices': [{'message': {'content': '{}'}}]}
    monkeypatch.setattr('app.retrieval.bounded_json', receive)
    with caplog.at_level('INFO', logger='uvicorn.error'):
        provider.complete('system', {'question': '联系13812345678，a@example.com，110101199001011234', 'history': []})
    for value in ['13812345678', 'a@example.com', '110101199001011234']:
        assert value not in json.dumps(sent)
        assert value not in caplog.text
    assert 'ai_egress provider=llm.test' in caplog.text
    assert minimized({'skuId': 'stable-id'})['skuId'] == 'stable-id'
