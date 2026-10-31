"""跨接口容量回归；外部模型、索引及 PDF 子进程执行使用可控阻塞替身。"""
import base64
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.config import Settings

KEY = 'capacity-test-service-key-not-for-production'
OPERATIONS = [
    ('knowledge_index', 'POST', '/v1/index', {'documentId': 'doc', 'title': '标题', 'content': '内容'}),
    ('knowledge_delete', 'DELETE', '/v1/index/doc', None),
    ('recall', 'POST', '/v1/recall', {'question': '测试'}),
    ('query', 'POST', '/v1/query', {'question': '测试', 'allowedDocumentIds': [], 'offers': []}),
    ('product_index', 'POST', '/v1/products/index', {'products': [
        {'productId': 'p', 'merchantId': 'm', 'title': '商品', 'categoryCode': 'c', 'specs': ['规格']}]}),
    ('product_search', 'POST', '/v1/products/search', {'query': '测试'}),
    ('product_delete', 'POST', '/v1/products/delete', {'productIds': ['p']}),
    ('extract', 'POST', '/v1/extract', {'filename': 'test.pdf', 'base64': base64.b64encode(b'controlled-pdf-fixture').decode()}),
]


@pytest.mark.parametrize('operation', OPERATIONS, ids=[o[0] for o in OPERATIONS])
@pytest.mark.parametrize('fails', [False, True], ids=['success', 'failure'])
def test_all_resource_operations_share_capacity_until_execution_finishes(tmp_path, monkeypatch, operation, fails):
    name, method, path, payload = operation
    app = main.create_app(Settings(api_key=KEY, db_path=str(tmp_path / 'capacity.db'), max_concurrent_requests=1))
    entered, release = threading.Event(), threading.Event()
    calls = []
    results = {
        'knowledge_index': 1, 'knowledge_delete': None,
        'recall': {'query': '测试', 'terms': ['测试']}, 'query': {'answer': '测试'},
        'product_index': {'indexed': 1}, 'product_search': {'productIds': []},
        'product_delete': {'deleted': 1},
        'extract': SimpleNamespace(returncode=0, stdout=b'{"text":"extracted text"}'),
    }

    def work(*args, **kwargs):
        calls.append(name)
        if len(calls) == 1:
            entered.set()
            assert release.wait(10), 'test did not release the controlled worker'
            if fails:
                if name == 'extract':
                    raise subprocess.TimeoutExpired('controlled-pdf-worker', 8)
                raise RuntimeError('controlled dependency failure')
        return results[name]

    targets = {
        'knowledge_index': (app.state.store, 'index'), 'knowledge_delete': (app.state.store, 'delete'),
        'recall': (main, 'recall_terms'), 'query': (main, 'answer'),
        'product_index': (app.state.products, 'upsert'), 'product_search': (app.state.products, 'search'),
        'product_delete': (app.state.products, 'delete'), 'extract': (main.subprocess, 'run'),
    }
    monkeypatch.setattr(*targets[name], work)
    with TestClient(app, headers={'X-Service-Key': KEY}) as client, ThreadPoolExecutor(1) as executor:
        future = executor.submit(client.request, method, path, json=payload)
        try:
            assert entered.wait(5), 'resource operation did not start'
            for _, other_method, other_path, other_payload in OPERATIONS:
                response = client.request(other_method, other_path, json=other_payload)
                assert response.status_code == 429, (name, other_path, response.status_code)
            assert client.get('/health').status_code == 200
            assert client.post('/v1/extract', headers={'X-Service-Key': 'invalid'}, json=OPERATIONS[-1][3]).status_code == 401
            assert len(calls) == 1  # 饱和时不会启动额外执行或 PDF 子进程。
        finally:
            release.set()
        response = future.result(timeout=5)
        expected_status = (400 if name == 'extract' else 503) if fails else 200
        assert response.status_code == expected_status
        assert client.request(method, path, json=payload).status_code == 200
        assert len(calls) == 2  # 成功、依赖失败和 PDF 超时后均归还容量。
