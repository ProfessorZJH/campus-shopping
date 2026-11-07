import json

from fastapi.testclient import TestClient

import app.main as main
from app.config import Settings
from app.retrieval import Provider
from app.observability import counts

KEY = 'stream-test-service-key-not-for-production'


def events(body):
    rows = []
    for block in body.split('\n\n'):
        lines = block.splitlines()
        if not lines:
            continue
        name = next(line[7:] for line in lines if line.startswith('event: '))
        data = json.loads(next(line[6:] for line in lines if line.startswith('data: ')))
        rows.append((name, data))
    return rows


def test_query_stream_without_model_is_explicit_full_response(tmp_path):
    app = main.create_app(Settings(api_key=KEY, db_path=str(tmp_path / 'stream.db')))

    with TestClient(app, headers={'X-Service-Key': KEY}) as client:
        response = client.post('/v1/query/stream', json={'question': '测试', 'allowedDocumentIds': [], 'offers': []})

    assert response.status_code == 200
    assert response.headers['content-type'].startswith('text/event-stream')
    rows = events(response.text)
    assert [name for name, _ in rows] == ['started', 'completed']
    assert rows[0][1]['mode'] == 'FULL_RESPONSE'
    assert 'delta' not in response.text
    assert app.state.gate.snapshot()['active'] == 0


def test_query_stream_exposes_provider_progress_without_leaking_json_fragments(tmp_path, monkeypatch):
    app = main.create_app(
        Settings(api_key=KEY, db_path=str(tmp_path / 'stream.db'), llm_url='http://localhost:9999', llm_key='configured', llm_model='model')
    )

    def controlled_answer(*args, **kwargs):
        assert kwargs['_stream_progress'](17) is False
        return {'answer': '完成', 'mode': 'LLM'}

    monkeypatch.setattr(main, 'answer', controlled_answer)
    with TestClient(app, headers={'X-Service-Key': KEY}) as client:
        response = client.post('/v1/query/stream', json={'question': '测试', 'allowedDocumentIds': [], 'offers': []})

    rows = events(response.text)
    assert [name for name, _ in rows] == ['started', 'progress', 'completed']
    assert rows[0][1]['mode'] == 'UPSTREAM_STREAMING_JSON'
    assert rows[1][1] == {'bytes': 17}
    assert '完成' in response.text
    assert app.state.gate.snapshot()['active'] == 0


def test_provider_stream_parser_accumulates_bounded_sse_content(monkeypatch):
    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def raise_for_status(self):
            return None

        def iter_lines(self):
            yield 'data: {"choices":[{"delta":{"content":"{\\"answer\\":\\""}}]}'
            yield 'data: {"choices":[{"delta":{"content":"完成\\"}"},"finish_reason":"stop"}]}'
            yield 'data: [DONE]'

    class Client:
        def __init__(self, **_):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def stream(self, *_, **__):
            return Response()

    monkeypatch.setattr('app.retrieval.httpx.Client', Client)
    settings = Settings(api_key=KEY, db_path='var/stream-parser.db', llm_url='http://localhost:9999', llm_key='configured', llm_model='model')
    provider = Provider(settings)

    assert ''.join(provider.stream_complete('system', {'question': '测试'})) == '{"answer":"完成"}'
    assert counts['llm.calls'] >= 1
    assert counts['llm.last_success_at'] > 0


def test_provider_stream_parser_rejects_done_without_success_finish(monkeypatch):
    class Response:
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def raise_for_status(self): return None
        def iter_lines(self):
            yield 'data: {"choices":[{"delta":{"content":"{}"}}]}'
            yield 'data: [DONE]'

    class Client:
        def __init__(self, **_): pass
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def stream(self, *_, **__): return Response()

    monkeypatch.setattr('app.retrieval.httpx.Client', Client)
    settings = Settings(KEY, 'var/stream-parser-terminal.db', llm_url='http://localhost:9999', llm_key='configured', llm_model='model')
    provider = Provider(settings)
    import pytest
    with pytest.raises(ValueError, match='未正常结束'):
        ''.join(provider.stream_complete('system', {'question': '测试'}))
