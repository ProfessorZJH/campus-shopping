from dataclasses import replace

import pytest

from app.config import Settings, validate_service_url


@pytest.mark.parametrize('url', [
    'http://8.8.8.8/v1', 'http://api.example.com/v1', 'http://10.0.0.4/v1',
    'https://user:password@example.com/v1', 'https://example.com/v1?key=x',
    'https://example.com/v1#fragment', 'ftp://example.com', 'https://example.com:bad',
    'https://example.com\\@127.0.0.1', 'https://example.com/\nsecret',
])
def test_unsafe_provider_addresses_rejected(url):
    with pytest.raises(ValueError):
        validate_service_url(url, 'LLM', ())


@pytest.mark.parametrize('url', ['https://api.example.com/v1', 'http://127.0.0.1:8101/v1', 'http://[::1]:8101/v1'])
def test_tls_and_loopback_allowed(url):
    validate_service_url(url, 'LLM', ())


def test_internal_http_requires_explicit_peer():
    validate_service_url('http://embedding.internal:8101/v1', 'Embedding', ('embedding.internal',))
    with pytest.raises(ValueError):
        validate_service_url('http://embedding.internal:8101/v1', 'Embedding', ())


def test_settings_validate_all_endpoints_before_creating_store(tmp_path):
    settings = Settings('test-only-key-123456789012345', str(tmp_path / 'new' / 'k.db'))
    for prefix in ('embedding', 'llm'):
        with pytest.raises(ValueError):
            replace(settings, **{prefix + '_url': 'http://public.example.com/v1', prefix + '_key': 'fake', prefix + '_model': 'stub'}).validate()
    with pytest.raises(ValueError):
        replace(settings, qdrant_url='http://public.example.com', qdrant_key='fake').validate()
    assert not (tmp_path / 'new').exists()
    with pytest.raises(ValueError, match='凭据'):
        replace(settings, qdrant_url='http://qdrant:6333').validate()
