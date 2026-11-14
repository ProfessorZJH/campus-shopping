from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("agent_m2_http", ROOT / "scripts/smoke-agent-v1-1-m2-http.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def java_response(items):
    return {"code": "0000", "info": "success", "data": {"items": items, "page": 1, "size": 20, "total": len(items), "hasNext": False}}


def test_java_product_snapshot_maps_only_current_sellable_skus():
    products = [
        {
            "productId": "p-1",
            "merchantId": "m-1",
            "title": "Notebook",
            "description": "paper",
            "status": "PUBLISHED",
            "skus": [
                {"skuId": "s-live", "specKey": "A5", "priceCent": 100, "available": 3, "status": "ACTIVE"},
                {"skuId": "s-empty", "specKey": "A4", "priceCent": 100, "available": 0, "status": "ACTIVE"},
                {"skuId": "s-off", "specKey": "A6", "priceCent": 100, "available": 2, "status": "INACTIVE"},
            ],
        },
        {
            "productId": "p-2",
            "merchantId": "m-2",
            "title": "Draft",
            "description": "hidden",
            "status": "DRAFT",
            "skus": [{"skuId": "s-draft", "specKey": "A5", "priceCent": 100, "available": 3, "status": "ACTIVE"}],
        },
    ]

    offers = MODULE.java_products_to_offers(java_response(products))

    assert [offer["skuId"] for offer in offers] == ["s-live"]
    assert offers[0]["merchantId"] == "m-1"
    assert offers[0]["available"] == 3


def test_java_product_snapshot_rejects_non_success_response():
    with pytest.raises(MODULE.ProbeNotRun):
        MODULE.java_products_to_offers({"code": "A0001", "data": []})


def test_harness_rejects_non_loopback_java_url():
    with pytest.raises(ValueError):
        MODULE.assert_loopback("https://example.invalid", "Java base URL")
