"""Small Milvus REST v2 adapter used by the isolated product index.

The application only needs a narrow subset of the Milvus client API. Keeping
that subset here lets secure deployments use the HTTPS endpoint even when the
gRPC endpoint is unavailable, while preserving the existing ProductIndex
contract and keeping transport failures free of response bodies and secrets.
"""
from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

import httpx


class MilvusRestError(RuntimeError):
    """A redacted Milvus REST transport or API error."""


class MilvusRestClient:
    """Adapt the Milvus REST v2 API to the methods ProductIndex uses."""

    _PATHS = {
        "list_collections": "/v2/vectordb/collections/list",
        "has_collection": "/v2/vectordb/collections/has",
        "create_collection": "/v2/vectordb/collections/create",
        "describe_collection": "/v2/vectordb/collections/describe",
        "load_collection": "/v2/vectordb/collections/load",
        "drop_collection": "/v2/vectordb/collections/drop",
        "query": "/v2/vectordb/entities/query",
        "insert": "/v2/vectordb/entities/insert",
        "upsert": "/v2/vectordb/entities/upsert",
        "search": "/v2/vectordb/entities/search",
        "delete": "/v2/vectordb/entities/delete",
    }

    def __init__(self, uri: str, token: str, timeout: float = 10, client: httpx.Client | None = None):
        if not uri or not token:
            raise ValueError("Milvus REST requires an endpoint and token")
        self._token = token
        self._owns_client = client is None
        self._client = client or httpx.Client(
            base_url=uri.rstrip("/"),
            timeout=timeout,
            trust_env=False,
            follow_redirects=False,
        )

    def _post(self, operation: str, payload: dict[str, Any]) -> Any:
        try:
            response = self._client.post(
                self._PATHS[operation],
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._token}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            body = response.json()
        except httpx.HTTPStatusError as exc:
            raise MilvusRestError(f"Milvus REST returned HTTP {exc.response.status_code}") from None
        except (httpx.HTTPError, ValueError):
            raise MilvusRestError("Milvus REST request failed") from None

        if not isinstance(body, dict) or body.get("code") != 0:
            raise MilvusRestError("Milvus REST request rejected")
        return body.get("data")

    @staticmethod
    def _collection_payload(collection_name: str) -> dict[str, str]:
        if not isinstance(collection_name, str) or not collection_name:
            raise ValueError("Milvus collection name is required")
        return {"collectionName": collection_name}

    def list_collections(self) -> list[str]:
        data = self._post("list_collections", {})
        return list(data or [])

    def has_collection(self, collection_name: str) -> bool:
        data = self._post("has_collection", self._collection_payload(collection_name))
        return bool(isinstance(data, dict) and data.get("has"))

    def create_collection(
        self,
        collection_name: str,
        dimension: int,
        id_type: str = "string",
        max_length: int = 64,
        metric_type: str = "COSINE",
        auto_id: bool = False,
        **kwargs: Any,
    ) -> Any:
        if not isinstance(dimension, int) or dimension <= 0:
            raise ValueError("Milvus vector dimension must be positive")
        id_kind = str(id_type).lower().replace("_", "")
        normalized_id_type = {"string": "VarChar", "varchar": "VarChar", "int64": "Int64"}.get(
            id_kind,
            id_type,
        )
        params: dict[str, Any] = {}
        if normalized_id_type == "VarChar":
            params["max_length"] = int(max_length)
        payload = {
            "collectionName": collection_name,
            "dimension": dimension,
            "idType": normalized_id_type,
            "primaryFieldName": kwargs.get("primary_field_name", "id"),
            "vectorFieldName": kwargs.get("vector_field_name", "vector"),
            "metricType": metric_type,
            "autoId": bool(auto_id),
            "params": params,
        }
        return self._post("create_collection", payload)

    def describe_collection(self, collection_name: str) -> dict[str, Any]:
        data = self._post("describe_collection", self._collection_payload(collection_name))
        if not isinstance(data, dict):
            return {}
        fields = data.get("fields")
        if isinstance(fields, list):
            normalized_fields = []
            for field in fields:
                if not isinstance(field, dict):
                    normalized_fields.append(field)
                    continue
                normalized = dict(field)
                params = normalized.get("params")
                if isinstance(params, list):
                    normalized["params"] = {
                        item.get("key"): item.get("value")
                        for item in params
                        if isinstance(item, dict) and item.get("key") is not None
                    }
                normalized_fields.append(normalized)
            data = dict(data)
            data["fields"] = normalized_fields
        return data

    def load_collection(self, collection_name: str) -> Any:
        return self._post("load_collection", self._collection_payload(collection_name))

    def query(
        self,
        collection_name: str,
        filter: str = "",
        output_fields: Sequence[str] | None = None,
        limit: int = 100,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        payload: dict[str, Any] = self._collection_payload(collection_name)
        payload.update({"filter": filter, "outputFields": list(output_fields or []), "limit": limit})
        if kwargs.get("consistency_level") is not None:
            payload["consistencyLevel"] = kwargs["consistency_level"]
        data = self._post("query", payload)
        return list(data or [])

    def insert(self, collection_name: str, data: Sequence[dict[str, Any]], **kwargs: Any) -> Any:
        return self._post("insert", {"collectionName": collection_name, "data": list(data)})

    def upsert(self, collection_name: str, data: Sequence[dict[str, Any]], **kwargs: Any) -> Any:
        return self._post("upsert", {"collectionName": collection_name, "data": list(data)})

    def search(
        self,
        collection_name: str,
        data: Sequence[Sequence[float]],
        filter: str = "",
        limit: int = 10,
        output_fields: Sequence[str] | None = None,
        consistency_level: str | None = None,
        metric_type: str = "COSINE",
        **kwargs: Any,
    ) -> list[list[dict[str, Any]]]:
        payload: dict[str, Any] = {
            "collectionName": collection_name,
            "data": [list(vector) for vector in data],
            "annsField": kwargs.get("anns_field", "vector"),
            "limit": limit,
            "outputFields": list(output_fields or []),
            "searchParams": kwargs.get("search_params", {"metricType": metric_type, "params": {}}),
        }
        if filter:
            payload["filter"] = filter
        if consistency_level is not None:
            payload["consistencyLevel"] = consistency_level
        result = self._post("search", payload)
        if not isinstance(result, list):
            return [[]]
        if result and isinstance(result[0], list):
            return result
        return [result]

    @staticmethod
    def _ids_filter(ids: Sequence[str]) -> str:
        values = list(dict.fromkeys(ids))
        if not values or any(not isinstance(value, str) or not value for value in values):
            raise ValueError("Milvus delete requires at least one valid id")
        return "id in " + json.dumps(values, ensure_ascii=False, separators=(",", ":"))

    def delete(
        self,
        collection_name: str,
        ids: Sequence[str] | None = None,
        filter: str = "",
        **kwargs: Any,
    ) -> Any:
        if ids is not None:
            filter = self._ids_filter(ids)
        if not filter:
            raise ValueError("Milvus delete requires ids or a filter")
        payload = self._collection_payload(collection_name)
        payload["filter"] = filter
        return self._post("delete", payload)

    def drop_collection(self, collection_name: str) -> Any:
        return self._post("drop_collection", self._collection_payload(collection_name))

    def get_server_version(self) -> str:
        """Return the protocol identifier; REST v2 exposes no server version here."""
        return "rest-v2"

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

