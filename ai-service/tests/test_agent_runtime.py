"""Agent v1.1 M0/M1 受控运行时契约测试；不连接真实供应商或业务库。"""
from __future__ import annotations

import json
import logging

import pytest

from app.agent_contract import (
    AgentScope,
    ScopeDeniedError,
    ToolArgumentError,
    UnknownToolError,
    default_registry,
)
from app.agent_runtime import AgentRuntime, ToolCallAccumulator
from app.agent_evidence import EvidenceRecorder, safe_metadata
from app.config import Settings
from app.main import create_app
from app.agent_fact import revalidate_product_candidates


def scope(*, identity_kind="consumer", merchants=(), identity_id=None, expires=None):
    return AgentScope(
        user_id="user-1",
        identity_kind=identity_kind,
        identity_id=identity_id,
        authorized_merchant_ids=frozenset(merchants),
        permissions=frozenset({"catalog.product.search"}),
        turn_token="turn-test",
        turn_expires_at=expires,
    )


def searcher(query, limit, merchant_id, current_scope):
    assert query
    assert current_scope.user_id == "user-1"
    candidates = [
        {"productId": "p-1", "merchantId": "m-1", "title": "考试签字笔", "source": "MILVUS_CANDIDATE", "verified": True},
        {"productId": "p-2", "merchantId": "m-2", "title": "无糖茶", "source": "CATALOG_READ_MODEL", "verified": True},
    ]
    if merchant_id:
        candidates = [item for item in candidates if item["merchantId"] == merchant_id]
    return candidates[:limit]


class FakeModel:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def complete(self, *, messages, tools, metadata):
        self.requests.append((messages, tools, metadata))
        return self.responses.pop(0)

    def stream(self, *, messages, tools, metadata):
        self.requests.append((messages, tools, metadata))
        response = self.responses.pop(0)
        yield from response


def tool_call(call_id="call-1", name="search_products", arguments=None):
    return {
        "message": {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": call_id,
                    "type": "function",
                    "function": {"name": name, "arguments": json.dumps(arguments or {"query": "签字笔"}, ensure_ascii=False)},
                }
            ],
        },
        "usage": {"prompt_tokens": 12, "completion_tokens": 4, "total_tokens": 16},
    }


def answer(text="已找到可核验的商品候选"):
    return {"message": {"role": "assistant", "content": text}}


def test_registry_exposes_only_read_only_search_tool():
    registry = default_registry(searcher)
    definitions = registry.definitions()
    assert [item["function"]["name"] for item in definitions] == ["search_products"]
    schema = definitions[0]["function"]["parameters"]
    assert schema["additionalProperties"] is False
    assert "query" in schema["required"]
    with pytest.raises(UnknownToolError):
        registry.invoke("add_to_cart", {}, scope())
    with pytest.raises(ToolArgumentError):
        registry.invoke("search_products", {"query": "茶", "unknown": True}, scope())
    with pytest.raises(ToolArgumentError):
        registry.invoke("search_products", {}, scope())


def test_scope_denies_ambiguous_or_foreign_merchant_and_expired_turn():
    registry = default_registry(searcher)
    with pytest.raises(ScopeDeniedError, match="MERCHANT_SCOPE_AMBIGUOUS"):
        registry.invoke("search_products", {"query": "商品"}, scope(identity_kind="merchant", merchants=("m-1", "m-2"), identity_id="m-1"))
    with pytest.raises(ScopeDeniedError, match="MERCHANT_RESOURCE_DENIED"):
        registry.invoke("search_products", {"query": "商品", "merchantId": "m-2"}, scope(identity_kind="merchant", merchants=("m-1",), identity_id="m-1"))
    with pytest.raises(ScopeDeniedError, match="TURN_LEASE_EXPIRED"):
        registry.invoke("search_products", {"query": "商品"}, scope(expires=0))


def test_runtime_executes_native_tool_once_then_continues():
    model = FakeModel([tool_call(), answer()])
    runtime = AgentRuntime(model, default_registry(searcher), model_name="test-model", evidence_status="STUB")
    result = runtime.run("我要找考试签字笔", scope())
    assert result.status == "COMPLETED"
    assert result.answer == "已找到可核验的商品候选"
    assert [(call.name, call.status) for call in result.tool_calls] == [("search_products", "SUCCEEDED")]
    assert len(model.requests) == 2
    assert model.requests[0][1][0]["function"]["name"] == "search_products"
    assert result.usage["total_tokens"] == 16


def test_runtime_rejects_plain_text_that_pretends_to_call_tool():
    runtime = AgentRuntime(FakeModel([answer("我将调用 search_products 查询商品")]), default_registry(searcher), evidence_status="STUB")
    result = runtime.run("查商品", scope())
    assert result.status == "FAILED"
    assert result.error_code == "PLAIN_TEXT_TOOL_CALL_REJECTED"
    assert result.tool_calls == []


def test_runtime_rejects_unknown_tool_without_business_write():
    runtime = AgentRuntime(FakeModel([tool_call(name="delete_order")]), default_registry(searcher), evidence_status="STUB")
    result = runtime.run("删除订单", scope())
    assert result.status == "FAILED"
    assert result.error_code == "UNKNOWN_TOOL"
    assert result.tool_calls[0].status == "REJECTED"
    assert result.tool_calls[0].error_code == "UNKNOWN_TOOL"


def test_m0_does_not_add_public_agent_route_or_business_write_port(tmp_path):
    app = create_app(Settings("agent-route-test-key-not-production", str(tmp_path / "route.db")))
    paths = {route.path for route in app.routes}
    assert not any(path.startswith("/v1/agent") or path.startswith("/agent") for path in paths)
    assert "/v1/query" in paths and "/v1/query/stream" in paths
    tables = app.state.store.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_run'").fetchall()
    assert tables == []
    app.state.store.close()


def test_fact_revalidation_filters_stale_candidates_without_copying_transaction_rules():
    class FactPort:
        def read_current_product_facts(self, product_ids, current_scope):
            assert product_ids == ["p-1", "p-2", "p-3"]
            assert current_scope.user_id == "user-1"
            return [
                {"productId": "p-1", "merchantId": "m-1", "title": "可售", "skuId": "sku-1", "priceCent": 100, "available": 2, "published": True, "merchantEligible": True},
                {"productId": "p-2", "merchantId": "m-1", "title": "缺货", "skuId": "sku-2", "priceCent": 100, "available": 0, "published": True, "merchantEligible": True},
                {"productId": "p-3", "merchantId": "m-1", "title": "已下架", "skuId": "sku-3", "priceCent": 100, "available": 2, "published": False, "merchantEligible": True},
            ]

    candidates = revalidate_product_candidates(["p-1", "p-2", "p-3"], scope(), FactPort())
    assert [candidate["productId"] for candidate in candidates] == ["p-1"]
    assert candidates[0]["verified"] is True


def test_stream_accumulator_assembles_fragments_and_deduplicates_duplicate_fragment():
    accumulator = ToolCallAccumulator()
    accumulator.accept(
        {
            "choices": [
                {
                    "delta": {
                        "tool_calls": [
                            {
                                "index": 0,
                                "id": "call-1",
                                "function": {"name": "search_products", "arguments": "{\"query\":"},
                            }
                        ]
                    }
                }
            ]
        }
    )
    fragment = {
        "choices": [
            {"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"茶\"}"}}]}}
        ]
    }
    accumulator.accept(fragment)
    accumulator.accept(fragment)
    accumulator.accept({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]})
    content, calls, usage = accumulator.finish()
    assert content == ""
    assert len(calls) == 1 and calls[0].arguments == {"query": "茶"}
    assert usage == {}


def test_stream_runtime_executes_tool_once_and_handles_invalid_json_safely():
    stream = [
        [
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "id": "call-1",
                                    "function": {"name": "search_products", "arguments": "{\"query\":"},
                                }
                            ]
                        }
                    }
                ]
            },
            {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"茶\"}"}}]}}]},
            {"choices": [{"delta": {}, "finish_reason": "tool_calls"}]},
        ],
        [{"choices": [{"delta": {"content": "完成"}, "finish_reason": "stop"}]}],
    ]
    runtime = AgentRuntime(FakeModel(stream), default_registry(searcher), evidence_status="STUB")
    result = runtime.run_stream("查茶", scope())
    assert result.status == "COMPLETED"
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].status == "SUCCEEDED"

    bad = ToolCallAccumulator()
    bad.accept(
        {
            "choices": [
                {
                    "delta": {
                        "tool_calls": [
                            {"index": 0, "function": {"name": "search_products", "arguments": "{bad"}}
                        ]
                    },
                    "finish_reason": "tool_calls",
                }
            ]
        }
    )
    with pytest.raises(Exception):
        bad.finish()


def test_evidence_metadata_redacts_credentials_prompts_and_downstream_body(tmp_path, caplog):
    output = tmp_path / "agent-evidence.json"
    recorder = EvidenceRecorder(output, "run-test", "contract", "STUB")
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        recorder.add(
            "redaction",
            "PASS",
            authorization="Bearer SECRET",
            prompt="private prompt",
            response_body="downstream private body",
            count=2,
        )
    payload = json.loads(output.read_text("utf-8"))
    serialized = json.dumps(payload, ensure_ascii=False)
    assert "SECRET" not in serialized
    assert "private prompt" not in serialized
    assert "downstream private body" not in serialized
    assert "SECRET" not in caplog.text
    assert "token" not in safe_metadata({"token": "secret", "count": 2})
