from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from app.agent_contract import AgentScope


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/smoke-agent-v1-1-m1-milvus-java-fact.py"
SPEC = importlib.util.spec_from_file_location("m1_milvus_java_fact", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def _scope() -> AgentScope:
    return AgentScope(
        user_id="test-user",
        identity_kind="consumer",
        permissions=frozenset({"catalog.product.search"}),
        turn_token="turn",
        turn_expires_at=4_000_000_000,
        lease_checker=lambda token, expires: token == "turn" and expires == 4_000_000_000,
    )


def test_java_products_to_index_keeps_published_active_skus_for_later_stock_revalidation():
    products = [
        {
            "productId": "p-live",
            "merchantId": "m-1",
            "title": "Notebook",
            "description": "paper",
            "categoryCode": "stationery",
            "status": "PUBLISHED",
            "skus": [
                {"specKey": "A5", "priceCent": 100, "available": 3, "status": "ACTIVE"},
                {"specKey": "A4", "priceCent": 100, "available": 0, "status": "ACTIVE"},
            ],
        },
        {
            "productId": "p-draft",
            "merchantId": "m-2",
            "title": "Draft",
            "status": "DRAFT",
            "skus": [{"specKey": "A5", "priceCent": 100, "available": 3, "status": "ACTIVE"}],
        },
        {
            "productId": "p-empty",
            "merchantId": "m-3",
            "title": "Empty",
            "status": "PUBLISHED",
            "skus": [{"specKey": "A5", "priceCent": 100, "available": 0, "status": "ACTIVE"}],
        },
    ]

    assert MODULE.java_products_to_index(products) == [
        {
            "productId": "p-live",
            "merchantId": "m-1",
            "title": "Notebook",
            "description": "paper",
            "categoryCode": "stationery",
            "specs": ["A5", "A4"],
        },
        {
            "productId": "p-empty",
            "merchantId": "m-3",
            "title": "Empty",
            "description": "",
            "categoryCode": "uncategorized",
            "specs": ["A5"],
        },
    ]


def test_java_product_to_fact_rows_preserves_current_sku_facts():
    rows = MODULE.java_product_to_fact_rows(
        {
            "productId": "p-1",
            "merchantId": "m-1",
            "title": "Notebook",
            "status": "PUBLISHED",
            "skus": [{"skuId": "s-1", "priceCent": 120, "available": 4, "status": "ACTIVE"}],
        }
    )

    assert rows == [
        {
            "productId": "p-1",
            "merchantId": "m-1",
            "title": "Notebook",
            "skuId": "s-1",
            "priceCent": 120,
            "available": 4,
            "published": True,
            "merchantEligible": True,
        }
    ]


def test_java_product_to_fact_rows_omits_inactive_skus_and_marks_unpublished_product():
    rows = MODULE.java_product_to_fact_rows(
        {
            "productId": "p-1",
            "merchantId": "m-1",
            "title": "Draft",
            "status": "DRAFT",
            "skus": [
                {"skuId": "s-off", "priceCent": 120, "available": 4, "status": "INACTIVE"},
                {"skuId": "s-live", "priceCent": 120, "available": 4, "status": "ACTIVE"},
            ],
        }
    )

    assert rows == [
        {
            "productId": "p-1",
            "merchantId": "m-1",
            "title": "Draft",
            "skuId": "s-live",
            "priceCent": 120,
            "available": 4,
            "published": False,
            "merchantEligible": False,
        }
    ]


def test_revalidation_deduplicates_ids_and_drops_unavailable_facts():
    class Port:
        def __init__(self):
            self.ids = None

        def read_current_product_facts(self, ids, scope):
            self.ids = ids
            return [
                {
                    "productId": "p-live",
                    "merchantId": "m-1",
                    "title": "Notebook",
                    "skuId": "s-1",
                    "priceCent": 120,
                    "available": 4,
                    "published": True,
                    "merchantEligible": True,
                },
                {
                    "productId": "p-empty",
                    "merchantId": "m-1",
                    "title": "Empty",
                    "skuId": "s-2",
                    "priceCent": 120,
                    "available": 0,
                    "published": True,
                    "merchantEligible": True,
                },
            ]

    port = Port()
    result = MODULE.revalidate_product_candidates(["p-live", "p-live", "p-empty"], _scope(), port)

    assert port.ids == ["p-live", "p-empty"]
    assert result == [
        {
            "productId": "p-live",
            "merchantId": "m-1",
            "title": "Notebook",
            "source": "MILVUS_CANDIDATE",
            "verified": True,
        },
        {
            "productId": "p-live",
            "merchantId": "m-1",
            "title": "Notebook",
            "source": "MILVUS_CANDIDATE",
            "verified": True,
        },
    ]


def test_detail_port_reads_only_candidate_ids_and_redacts_missing_products(monkeypatch):
    seen = []

    def fake_request(base_url, method, path, *, tolerate_not_found=False):
        seen.append((base_url, method, path, tolerate_not_found))
        if path.endswith("missing"):
            return None
        return {
            "code": "0000",
            "data": {
                "productId": "p-1",
                "merchantId": "m-1",
                "title": "Notebook",
                "status": "PUBLISHED",
                "skus": [{"skuId": "s-1", "priceCent": 120, "available": 2, "status": "ACTIVE"}],
            },
        }

    monkeypatch.setattr(MODULE, "_request_json", fake_request)
    port = MODULE.JavaDetailFactPort("http://127.0.0.1:8091")
    rows = port.read_current_product_facts(["p-1", "p-1", "missing"], _scope())

    assert [entry[2] for entry in seen] == ["/api/v1/products/p-1", "/api/v1/products/missing"]
    assert rows[0]["productId"] == "p-1"
    assert port.detail_reads == 1
    assert port.detail_not_found == 1
    assert port.not_found_product_ids == {"missing"}


def test_assert_loopback_rejects_credentials_and_remote_hosts():
    with pytest.raises(ValueError):
        MODULE.assert_loopback("https://example.invalid", "Java base URL")
    with pytest.raises(ValueError):
        MODULE.assert_loopback("http://user:password@127.0.0.1:8091", "Java base URL")


def test_collection_name_is_isolated_from_production_collection():
    name = MODULE.isolated_collection_name()
    MODULE.assert_isolated_collection(name, MODULE.PRODUCTION_COLLECTION)
    assert name != MODULE.PRODUCTION_COLLECTION
