"""Agent v1.1 M0/M1 受控运行时契约测试；不连接真实供应商或业务库。"""
from __future__ import annotations

import json
import logging
import time

import httpx
import pytest

from app.agent_contract import (
    AgentScope,
    ScopeDeniedError,
    ToolArgumentError,
    UnknownToolError,
    default_registry,
)
from app.agent_runtime import AgentContractError, AgentRuntime, ToolCallAccumulator
from app.agent_evidence import EvidenceRecorder, safe_exception_code, safe_metadata
from app.config import Settings
from app.main import create_app
from app.agent_fact import revalidate_product_candidates


def scope(*, identity_kind="consumer", merchants=(), identity_id=None, expires=None):
    if expires is None:
        expires = time.time() + 600
    return AgentScope(
        user_id="user-1",
        identity_kind=identity_kind,
        identity_id=identity_id,
        authorized_merchant_ids=frozenset(merchants),
        permissions=frozenset({"catalog.product.search"}),
        authorization_source="test-java-scope",
        turn_token="turn-test",
        turn_expires_at=expires,
        lease_checker=lambda token, expires_at: token == "turn-test",
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
        "finish_reason": "tool_calls",
        "usage": {"prompt_tokens": 12, "completion_tokens": 4, "total_tokens": 16},
    }


def answer(text="已找到可核验的商品候选"):
    return {"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}


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


def test_scope_requires_complete_turn_lease():
    with pytest.raises(ValueError, match="turn_expires_at"):
        AgentScope(
            user_id="user-1",
            identity_kind="consumer",
            permissions=frozenset({"catalog.product.search"}),
            turn_token="turn-test",
        )
    with pytest.raises(ValueError, match="turn_token"):
        AgentScope(
            user_id="user-1",
            identity_kind="consumer",
            permissions=frozenset({"catalog.product.search"}),
            turn_expires_at=time.time() + 600,
        )


def test_scope_denies_ambiguous_or_foreign_merchant_and_expired_turn():
    registry = default_registry(searcher)
    with pytest.raises(ScopeDeniedError, match="MERCHANT_SCOPE_AMBIGUOUS"):
        registry.invoke("search_products", {"query": "商品"}, scope(identity_kind="merchant", merchants=("m-1", "m-2"), identity_id="m-1"))
    with pytest.raises(ScopeDeniedError, match="MERCHANT_RESOURCE_DENIED"):
        registry.invoke("search_products", {"query": "商品", "merchantId": "m-2"}, scope(identity_kind="merchant", merchants=("m-1",), identity_id="m-1"))
    with pytest.raises(ScopeDeniedError, match="TURN_LEASE_EXPIRED"):
        registry.invoke("search_products", {"query": "商品"}, scope(expires=0))
    invalid_lease = AgentScope(
        user_id="user-1",
        identity_kind="consumer",
        permissions=frozenset({"catalog.product.search"}),
        authorization_source="test-java-scope",
        turn_token="turn-test",
        turn_expires_at=time.time() + 600,
        lease_checker=lambda token, expires_at: False,
    )
    with pytest.raises(ScopeDeniedError, match="TURN_LEASE_INVALID"):
        registry.invoke("search_products", {"query": "商品"}, invalid_lease)


def test_single_merchant_scope_is_applied_when_model_omits_merchant_id():
    calls = []

    def scoped_searcher(query, limit, merchant_id, current_scope):
        calls.append(merchant_id)
        return searcher(query, limit, merchant_id, current_scope)

    result = default_registry(scoped_searcher).invoke(
        "search_products",
        {"query": "商品"},
        scope(identity_kind="merchant", merchants=("m-1",), identity_id="m-1"),
    )
    assert calls == ["m-1"]
    assert {candidate["merchantId"] for candidate in result["candidates"]} == {"m-1"}


def test_scope_rejects_candidates_outside_selected_merchant():
    def leaking_searcher(query, limit, merchant_id, current_scope):
        return [
            {"productId": "p-2", "merchantId": "m-2", "title": "越界候选", "source": "CATALOG_READ_MODEL", "verified": False}
        ]

    with pytest.raises(ScopeDeniedError, match="MERCHANT_RESOURCE_DENIED"):
        default_registry(leaking_searcher).invoke(
            "search_products",
            {"query": "商品"},
            scope(identity_kind="merchant", merchants=("m-1",), identity_id="m-1"),
        )


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


def test_runtime_accumulates_usage_across_model_rounds():
    model = FakeModel([tool_call(), {**answer(), "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7}}])
    result = AgentRuntime(model, default_registry(searcher), evidence_status="STUB").run("查商品", scope())
    assert result.status == "COMPLETED"
    assert result.usage == {"prompt_tokens": 17, "completion_tokens": 6, "total_tokens": 23}


def test_runtime_rechecks_turn_lease_after_model_call():
    class SlowModel(FakeModel):
        def complete(self, *, messages, tools, metadata):
            time.sleep(0.03)
            return super().complete(messages=messages, tools=tools, metadata=metadata)

    result = AgentRuntime(SlowModel([answer()]), default_registry(searcher), evidence_status="STUB").run(
        "查商品", scope(expires=time.time() + 0.01)
    )
    assert result.status == "FAILED"
    assert result.error_code == "TURN_LEASE_EXPIRED"

    def slow_searcher(query, limit, merchant_id, current_scope):
        time.sleep(0.03)
        return searcher(query, limit, merchant_id, current_scope)

    result = AgentRuntime(FakeModel([tool_call(), answer()]), default_registry(slow_searcher), evidence_status="STUB").run(
        "查商品", scope(expires=time.time() + 0.01)
    )
    assert result.status == "FAILED"
    assert result.error_code == "TURN_LEASE_EXPIRED"


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


def test_runtime_rejects_abnormal_native_finish_reason_and_degrades_real_contract_failures():
    abnormal = {**tool_call(), "finish_reason": "length"}
    result = AgentRuntime(FakeModel([abnormal]), default_registry(searcher), evidence_status="REAL").run("查商品", scope())
    assert result.status == "FAILED"
    assert result.error_code == "MODEL_NOT_NORMALLY_TERMINATED"
    assert result.evidence_status == "DEGRADED"

    denied = AgentRuntime(FakeModel([tool_call(name="delete_order")]), default_registry(searcher), evidence_status="REAL").run(
        "删除订单", scope()
    )
    assert denied.error_code == "UNKNOWN_TOOL"
    assert denied.evidence_status == "DEGRADED"


def test_runtime_rejects_non_function_native_calls_and_records_tool_transport_failures():
    malformed = tool_call()
    malformed["message"]["tool_calls"][0]["type"] = "custom"
    result = AgentRuntime(FakeModel([malformed]), default_registry(searcher), evidence_status="STUB").run("查商品", scope())
    assert result.error_code == "INVALID_MODEL_TOOL_CALL"

    def failing_searcher(query, limit, merchant_id, current_scope):
        raise TimeoutError("upstream")

    failed = AgentRuntime(FakeModel([tool_call()]), default_registry(failing_searcher), evidence_status="STUB").run("查商品", scope())
    assert failed.error_code == "UPSTREAM_TIMEOUT"
    assert failed.tool_calls[0].status == "FAILED"
    assert failed.tool_calls[0].error_code == "UPSTREAM_TIMEOUT"


def test_runtime_rejects_duplicate_tool_ids_before_first_execution():
    response = tool_call()
    response["message"]["tool_calls"].append(response["message"]["tool_calls"][0].copy())
    result = AgentRuntime(FakeModel([response]), default_registry(searcher), evidence_status="STUB").run("查商品", scope())
    assert result.error_code == "DUPLICATE_TOOL_CALL"
    assert result.tool_calls == []


def test_runtime_preserves_stub_status_for_unexpected_failures():
    def failing_searcher(query, limit, merchant_id, current_scope):
        raise RuntimeError("boom")

    result = AgentRuntime(FakeModel([tool_call()]), default_registry(failing_searcher), evidence_status="STUB").run("查商品", scope())
    assert result.status == "FAILED"
    assert result.evidence_status == "STUB"


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


def test_fact_revalidation_rechecks_lease_after_java_lookup():
    class SlowFactPort:
        def read_current_product_facts(self, product_ids, current_scope):
            time.sleep(0.03)
            return []

    with pytest.raises(ScopeDeniedError, match="TURN_LEASE_EXPIRED"):
        revalidate_product_candidates(["p-1"], scope(expires=time.time() + 0.01), SlowFactPort())


def test_stream_accumulator_preserves_repeated_argument_fragments():
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
                                "function": {"name": "search_products", "arguments": "{\"query\":\""},
                            }
                        ]
                    }
                }
            ]
        }
    )
    accumulator.accept({"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "ab"}}]}}]})
    accumulator.accept({"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "ab"}}]}}]})
    accumulator.accept({"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"}"}}]}}]})
    accumulator.accept({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]})
    content, calls, usage = accumulator.finish()
    assert content == ""
    assert len(calls) == 1 and calls[0].arguments == {"query": "abab"}
    assert usage == {}


def test_stream_accumulator_requires_terminal_finish_reason_and_provider_call_id():
    accumulator = ToolCallAccumulator()
    accumulator.accept(
        {
            "choices": [
                {
                    "delta": {
                        "tool_calls": [
                            {"index": 0, "function": {"name": "search_products", "arguments": '{"query":"茶"}'}}
                        ]
                    }
                }
            ]
        }
    )
    with pytest.raises(AgentContractError, match="STREAM_NOT_NORMALLY_TERMINATED"):
        accumulator.finish()

    accumulator.accept({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]})
    with pytest.raises(AgentContractError, match="INVALID_STREAM_TOOL_CALL"):
        accumulator.finish()


def test_stream_accumulator_rejects_non_function_tool_type():
    accumulator = ToolCallAccumulator()
    with pytest.raises(AgentContractError, match="INVALID_STREAM_TOOL_CALL"):
        accumulator.accept(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "type": "custom",
                                    "id": "call-1",
                                    "function": {"name": "search_products", "arguments": '{"query":"茶"}'},
                                }
                            ]
                        }
                    }
                ]
            }
        )


def test_stream_accumulator_deduplicates_only_explicit_event_replays():
    accumulator = ToolCallAccumulator()
    chunk = {
        "_event_id": "event-1",
        "choices": [{"delta": {"content": "a"}}],
    }
    accumulator.accept(chunk)
    accumulator.accept(chunk)
    accumulator.accept({"choices": [{"delta": {}, "finish_reason": "stop"}]})
    content, calls, _ = accumulator.finish()
    assert content == "a"
    assert calls == []


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


def test_runtime_rejects_native_tool_call_without_provider_id():
    runtime = AgentRuntime(FakeModel([tool_call(call_id="")]), default_registry(searcher), evidence_status="STUB")
    result = runtime.run("查商品", scope())
    assert result.status == "FAILED"
    assert result.error_code == "INVALID_MODEL_TOOL_CALL"


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
    credentials = safe_metadata({"llm_key": "secret", "embedding_key": "secret", "qdrant_key": "secret", "milvus_token": "secret"})
    assert credentials == {}
    assert safe_exception_code(httpx.ReadTimeout("timed out")) == "UPSTREAM_TIMEOUT"
    assert safe_exception_code(httpx.ConnectError("failed")) == "UPSTREAM_CONNECTION"
