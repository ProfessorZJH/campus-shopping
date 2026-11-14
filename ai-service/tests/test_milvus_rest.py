import httpx
import pytest

from app.config import Settings
from app.milvus_rest import MilvusRestClient, MilvusRestError
from app.product_index import ProductIndex
from app.provider import Provider


TOKEN = "tenant:token-used-only-by-tests"


def _adapter(handler):
    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(base_url="https://milvus.test", transport=transport)
    return MilvusRestClient("https://milvus.test", TOKEN, client=http_client)


def test_rest_adapter_covers_isolated_collection_lifecycle_and_shapes():
    requests = []
    rows = {"alpha": {"id": "alpha", "vector": [1.0, 0.0, 0.0], "fingerprint": "fp-1", "model": "embed-v1"}}
    created = False

    def handler(request):
        nonlocal created
        payload = request.read()
        import json

        body = json.loads(payload or b"{}")
        requests.append((request.url.path, body, request.headers.get("authorization")))
        path = request.url.path
        if path.endswith("/collections/list"):
            return httpx.Response(200, json={"code": 0, "data": ["isolated"] if created else []})
        if path.endswith("/collections/has"):
            return httpx.Response(200, json={"code": 0, "data": {"has": created}})
        if path.endswith("/collections/create"):
            created = True
            return httpx.Response(200, json={"code": 0, "data": {}})
        if path.endswith("/collections/describe"):
            return httpx.Response(200, json={"code": 0, "data": {"fields": [
                {"name": "id", "params": [{"key": "max_length", "value": "64"}]},
                {"name": "vector", "params": [{"key": "dim", "value": "3"}]},
            ]}})
        if path.endswith("/collections/load"):
            return httpx.Response(200, json={"code": 0, "data": {}})
        if path.endswith("/entities/insert"):
            rows.update({item["id"]: {**item, "fingerprint": item.get("fingerprint", "fp"), "model": item.get("model", "embed-v1")} for item in body["data"]})
            return httpx.Response(200, json={"code": 0, "data": {"insertCount": len(body["data"])}})
        if path.endswith("/entities/upsert"):
            rows.update({item["id"]: {**item, "fingerprint": item.get("fingerprint", "fp"), "model": item.get("model", "embed-v1")} for item in body["data"]})
            return httpx.Response(200, json={"code": 0, "data": {"upsertCount": len(body["data"])}})
        if path.endswith("/entities/query"):
            return httpx.Response(200, json={"code": 0, "data": [
                {"id": item["id"], "fingerprint": item["fingerprint"], "model": item["model"]}
                for item in rows.values()
            ]})
        if path.endswith("/entities/search"):
            return httpx.Response(200, json={"code": 0, "data": [{"id": "alpha", "distance": 1.0}]})
        if path.endswith("/entities/delete"):
            return httpx.Response(200, json={"code": 0, "data": {"deleteCount": 1}})
        if path.endswith("/collections/drop"):
            created = False
            return httpx.Response(200, json={"code": 0, "data": {}})
        return httpx.Response(404, json={"code": 1})

    client = _adapter(handler)
    assert client.list_collections() == []
    assert client.create_collection("isolated", 3, id_type="string", max_length=64, auto_id=False) == {}
    assert client.has_collection("isolated")
    description = client.describe_collection("isolated")
    assert description["fields"][1]["params"] == {"dim": "3"}
    assert client.load_collection("isolated") == {}
    assert client.insert("isolated", [{"id": "alpha", "vector": [1.0, 0.0, 0.0]}])["insertCount"] == 1
    assert client.upsert("isolated", [{"id": "alpha", "vector": [0.0, 1.0, 0.0]}])["upsertCount"] == 1
    assert client.query("isolated", filter='id in ["alpha"]', output_fields=["id"], limit=10)[0]["id"] == "alpha"
    assert client.search("isolated", [[1.0, 0.0, 0.0]], filter='model == "embed-v1"', limit=2) == [[
        {"id": "alpha", "distance": 1.0}
    ]]
    assert client.delete("isolated", ids=["alpha", "alpha"]) == {"deleteCount": 1}
    assert client.drop_collection("isolated") == {}
    assert not client.has_collection("isolated")

    assert requests[1][1] == {
        "collectionName": "isolated",
        "dimension": 3,
        "idType": "VarChar",
        "primaryFieldName": "id",
        "vectorFieldName": "vector",
        "metricType": "COSINE",
        "autoId": False,
        "params": {"max_length": 64},
    }
    delete_request = next(item for item in requests if item[0].endswith("/entities/delete"))
    assert delete_request[1]["filter"] == 'id in ["alpha"]'
    assert all(item[2] == "Bearer " + TOKEN for item in requests)


def test_rest_adapter_rejects_dimension_mismatch_after_normalizing_describe():
    def handler(request):
        import json

        path = request.url.path
        if path.endswith("/collections/has"):
            return httpx.Response(200, json={"code": 0, "data": {"has": True}})
        if path.endswith("/collections/describe"):
            return httpx.Response(200, json={"code": 0, "data": {"fields": [
                {"name": "vector", "params": [{"key": "dim", "value": "2"}]},
            ]}})
        if path.endswith("/entities/query"):
            return httpx.Response(200, json={"code": 0, "data": []})
        return httpx.Response(404, json={"code": 1})

    settings = Settings(
        "test-service-key-123456789012345678",
        ":memory:",
        embedding_url="https://embedding.test",
        embedding_key="embedding-test-key",
        embedding_model="embed-v1",
        milvus_uri="https://milvus.test",
        milvus_token=TOKEN,
        product_collection="isolated",
        milvus_transport="rest",
    )

    class ProviderStub:
        model_tag = "embed-v1"

        def embed(self, texts, input_type="passage"):
            return [[1.0, 0.0, 0.0] for _ in texts]

    adapter = _adapter(handler)
    with pytest.raises(ValueError, match="维度"):
        ProductIndex(settings, ProviderStub(), adapter)._collection(3)


@pytest.mark.parametrize("failure", ["http", "code", "json"])
def test_rest_adapter_redacts_credentials_and_downstream_error_body(failure):
    secret = "secret-token-must-not-escape"
    downstream = "private-downstream-error-body"

    def handler(request):
        if failure == "http":
            return httpx.Response(502, text=downstream)
        if failure == "code":
            return httpx.Response(200, json={"code": 7, "message": downstream})
        return httpx.Response(200, text=downstream)

    client = _adapter(handler)
    client._token = secret
    with pytest.raises(MilvusRestError) as caught:
        client.has_collection("isolated")
    message = str(caught.value)
    assert secret not in message and downstream not in message


def test_nvidia_embedding_retries_batch_limit_as_single_inputs(tmp_path, monkeypatch):
    requests = []

    def handler(request):
        import json

        payload = json.loads(request.read())
        requests.append(payload["input"])
        if len(payload["input"]) > 1:
            return httpx.Response(500, json={"error": "batch limit"})
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.2, 0.8]}]})

    original = httpx.Client
    monkeypatch.setattr(
        "app.provider.httpx.Client",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    settings = Settings(
        "test-service-key-123456789012345678",
        str(tmp_path / "embedding.db"),
        embedding_url="https://embedding.test/v1",
        embedding_key="embedding-test-key",
        embedding_model="nvidia/nemotron-3.5-embed-1b",
    )
    assert Provider(settings).embed(["a", "b"], input_type="passage") == [[0.2, 0.8], [0.2, 0.8]]
    assert [len(value) for value in requests] == [2, 1, 1]


def test_nvidia_embedding_does_not_split_rate_limit_errors(tmp_path, monkeypatch):
    requests = []

    def handler(request):
        import json

        requests.append(json.loads(request.read())["input"])
        return httpx.Response(429, json={"error": "rate limited"})

    original = httpx.Client
    monkeypatch.setattr(
        "app.provider.httpx.Client",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )
    settings = Settings(
        "test-service-key-123456789012345678",
        str(tmp_path / "embedding.db"),
        embedding_url="https://embedding.test/v1",
        embedding_key="embedding-test-key",
        embedding_model="nvidia/nemotron-3.5-embed-1b",
    )
    with pytest.raises(httpx.HTTPStatusError):
        Provider(settings).embed(["a", "b"], input_type="passage")
    assert [len(value) for value in requests] == [2]


def test_milvus_transport_setting_is_explicit_and_validated(tmp_path):
    base = dict(
        embedding_url="https://embedding.test",
        embedding_key="embedding-test-key",
        embedding_model="embed-v1",
        milvus_uri="https://milvus.test",
        milvus_token=TOKEN,
    )
    assert Settings("test-service-key-123456789012345678", str(tmp_path / "ok.db"), **base).validate() is None
    with pytest.raises(ValueError, match="MILVUS_TRANSPORT"):
        Settings(
            "test-service-key-123456789012345678",
            str(tmp_path / "bad.db"),
            milvus_transport="invalid",
            **base,
        ).validate()
