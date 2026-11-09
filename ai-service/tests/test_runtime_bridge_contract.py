from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.agent_contract import SearchProductsArguments, default_registry
from app.runtime_bridge import RuntimeBridgeError, RuntimeToolDefinition

import importlib.util
SMOKE = importlib.util.spec_from_file_location("runtime_bridge_smoke", Path(__file__).resolve().parents[2] / "scripts/smoke-agent-v1-1-m2-runtime-bridge.py")
assert SMOKE and SMOKE.loader
SMOKE_MODULE = importlib.util.module_from_spec(SMOKE)
SMOKE.loader.exec_module(SMOKE_MODULE)

FIXTURE = Path(__file__).parent / "fixtures" / "agent-runtime-contract.json"


def contract():
    return json.loads(FIXTURE.read_text(encoding="utf-8-sig"))


def test_shared_fixture_freezes_search_products_and_error_categories():
    data = contract()
    assert data["protocolVersion"] == "1.0"
    assert data["tool"]["name"] == "search_products"
    assert data["tool"]["readOnly"] is True
    parsed = SearchProductsArguments.model_validate(data["tool"]["input"], strict=True)
    assert parsed.query == "茶" and parsed.limit == 5 and parsed.merchantId is None
    assert set(data["statuses"]) == {"TOOL_CALLS", "FINAL", "FAILED"}
    assert all(isinstance(code, str) and code for code in data["errors"])


def test_old_search_products_registry_remains_compatible():
    registry = default_registry(lambda query, limit, merchant_id, scope: [])
    definition = registry.definitions()
    assert [item["function"]["name"] for item in definition] == ["search_products"]
    params = definition[0]["function"]["parameters"]
    assert "query" in params["properties"]
    assert "limit" in params["properties"]
    result = registry.invoke("search_products", {"query": "茶", "limit": 5}, type("Scope", (), {"assert_product_search": lambda self, merchant: merchant, "assert_active": lambda self: None})())
    assert result["tool"] == "search_products" and result["readOnly"] is True


def test_schema_mismatch_fails_closed_for_unknown_tool_and_extra_fields():
    with pytest.raises(Exception):
        RuntimeToolDefinition.model_validate({"name": "search_products", "readOnly": True, "unexpected": "field"}, strict=True)
    valid, reason = SMOKE_MODULE.validate_protocol_response({"protocolVersion": "1.0", "runId": "run", "requestId": "req", "status": "TOOL_CALLS", "toolCalls": [{"callId": "c", "name": "delete_order", "arguments": {}}]}, "run", "req")
    assert not valid and reason == "unknown_tool"


def test_error_categories_are_stable_and_do_not_expose_body():
    error = RuntimeBridgeError("UPSTREAM_5XX", 503)
    assert error.code == "UPSTREAM_5XX" and error.status == 503
    assert "provider secret" not in str(error)
