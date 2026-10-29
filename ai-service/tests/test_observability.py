import logging

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

KEY = 'observability-test-service-key-only'


def test_failures_are_correlated_and_redacted(tmp_path, caplog):
    app = create_app(Settings(KEY, str(tmp_path/'knowledge.db')))
    secret = 'PRIVATE_CREDENTIAL_IN_EXCEPTION'

    def unavailable(*args, **kwargs):
        raise RuntimeError(secret)

    app.state.products.search = unavailable
    with TestClient(app, headers={'X-Service-Key': KEY}) as client:
        response = client.post('/v1/products/search', json={'query': 'tea'}, headers={'X-Request-ID': 'request-test-12345678'})
        assert response.status_code == 503
        assert response.headers['X-Request-ID'] == 'request-test-12345678'
        assert secret not in response.text
        assert 'exception_type=RuntimeError' in caplog.text
        assert 'request_id=request-test-12345678' in caplog.text
        assert secret not in caplog.text and KEY not in caplog.text
        assert client.get('/v1/diagnostics').json()['product.search.failures'] >= 1
    with TestClient(create_app(Settings(KEY, str(tmp_path/'other.db')))) as client:
        assert client.get('/v1/diagnostics').status_code == 401
