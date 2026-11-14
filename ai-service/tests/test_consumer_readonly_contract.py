"""M3 consumer read-only tool contracts remain opt-in until Java sync."""
from __future__ import annotations

import json
import logging
from pathlib import Path
import time

import httpx
import pytest

from app.agent_contract import AgentScope, default_registry
from app.agent_evidence import EvidenceRecorder, safe_exception_code
from app.agent_runtime import AgentModelError, AgentRuntime
from app.consumer_readonly_contract import (
    GET_MY_ORDERS_NAME,
    GET_MY_ORDERS_VERSION,
    KNOWLEDGE_QA_NAME,
    KNOWLEDGE_QA_VERSION,
    GetMyOrdersArguments,
    GetMyOrdersResult,
    KnowledgeQaArguments,
    KnowledgeQaResult,
    consumer_readonly_registry,
)


FIXTURES = Path(__file__).parent / "fixtures" / "consumer_readonly_tools"
CONTRACTS = Path(__file__).parents[1] / "contracts" / "consumer_readonly" / "v1"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def active_scope() -> AgentScope:
    return AgentScope(
        user_id="fixture-user",
        identity_kind="consumer",
        permissions=frozenset(),
        authorization_source="fixture-java-scope",
        turn_token="fixture-turn",
        turn_expires_at=time.time() + 600,
        lease_checker=lambda token, expires_at: token == "fixture-turn",
    )


class FakeModel:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests: list[tuple[list[dict], list[dict], dict]] = []

    def complete(self, *, messages, tools, metadata):
        self.requests.append((messages, tools, metadata))
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response

    def stream(self, *, messages, tools, metadata):
        self.requests.append((messages, tools, metadata))
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        yield from response


def native_call(name: str, call_id: str, arguments: dict) -> dict:
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {"name": name, "arguments": json.dumps(arguments)},
                        }
                    ],
                },
                "finish_reason": "tool_calls",
            }
        ]
    }


def final_answer(text: str = "The read-only result is ready.") -> dict:
    return {
        "choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}]
    }


def handlers() -> tuple:
    knowledge_result = fixture("knowledge_qa_result.json")
    orders_result = fixture("get_my_orders_result.json")
    seen: dict[str, object] = {}

    def knowledge(arguments, scope):
        seen["knowledge"] = arguments
        assert scope.user_id == "fixture-user"
        return knowledge_result

    def orders(arguments, scope):
        seen["orders"] = arguments
        assert scope.user_id == "fixture-user"
        return orders_result

    return knowledge, orders, seen


def test_versioned_fixtures_load_into_strict_models():
    knowledge_call = fixture("knowledge_qa_call.json")
    knowledge_result = fixture("knowledge_qa_result.json")
    orders_call = fixture("get_my_orders_call.json")
    orders_result = fixture("get_my_orders_result.json")

    assert (knowledge_call["tool"], knowledge_call["version"], knowledge_call["readOnly"]) == (
        KNOWLEDGE_QA_NAME,
        KNOWLEDGE_QA_VERSION,
        True,
    )
    assert (orders_call["tool"], orders_call["version"], orders_call["readOnly"]) == (
        GET_MY_ORDERS_NAME,
        GET_MY_ORDERS_VERSION,
        True,
    )
    assert KnowledgeQaArguments.model_validate(knowledge_call["arguments"], strict=True).question.startswith("How")
    assert GetMyOrdersArguments.model_validate(orders_call["arguments"], strict=True).state == "PAID"
    assert KnowledgeQaResult.model_validate(knowledge_result, strict=True).readOnly is True
    assert GetMyOrdersResult.model_validate(orders_result, strict=True).items[0].items[0].quantity == 1

    knowledge_schema = KnowledgeQaArguments.model_json_schema()
    orders_schema = GetMyOrdersArguments.model_json_schema()
    assert knowledge_schema["additionalProperties"] is False
    assert orders_schema["additionalProperties"] is False
    assert knowledge_schema["required"] == ["question"]
    assert set(orders_schema["properties"]) == {"state", "page", "size"}

    manifest = json.loads((CONTRACTS / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["schemaVersion"] == "1.0"
    assert [(item["name"], item["version"], item["readOnly"]) for item in manifest["tools"]] == [
        (KNOWLEDGE_QA_NAME, KNOWLEDGE_QA_VERSION, True),
        (GET_MY_ORDERS_NAME, GET_MY_ORDERS_VERSION, True),
    ]
    assert json.loads((CONTRACTS / "knowledge_qa.arguments.schema.json").read_text(encoding="utf-8")) == knowledge_schema
    assert json.loads((CONTRACTS / "get_my_orders.arguments.schema.json").read_text(encoding="utf-8")) == orders_schema
    assert json.loads((CONTRACTS / "knowledge_qa.result.schema.json").read_text(encoding="utf-8")) == KnowledgeQaResult.model_json_schema()
    assert json.loads((CONTRACTS / "get_my_orders.result.schema.json").read_text(encoding="utf-8")) == GetMyOrdersResult.model_json_schema()


def test_strict_arguments_reject_unknown_or_unsafe_scope_fields():
    with pytest.raises(ValueError):
        KnowledgeQaArguments.model_validate({"question": "pickup", "documentIds": ["other-user-doc"]}, strict=True)
    with pytest.raises(ValueError):
        KnowledgeQaArguments.model_validate({}, strict=True)
    with pytest.raises(ValueError):
        GetMyOrdersArguments.model_validate({"state": "PAID", "page": 1}, strict=True)
    with pytest.raises(ValueError):
        GetMyOrdersArguments.model_validate({"state": "PAID", "page": 1, "size": 20, "buyerId": "other-user"}, strict=True)
    with pytest.raises(ValueError):
        GetMyOrdersArguments.model_validate({"state": "PAID", "page": True, "size": 1}, strict=True)


def test_strict_results_reject_version_write_and_summary_overrides():
    knowledge = fixture("knowledge_qa_result.json")
    knowledge["readOnly"] = False
    with pytest.raises(ValueError):
        KnowledgeQaResult.model_validate(knowledge, strict=True)

    knowledge = fixture("knowledge_qa_result.json")
    knowledge["citations"][0]["snippet"] = " "
    with pytest.raises(ValueError):
        KnowledgeQaResult.model_validate(knowledge, strict=True)

    orders = fixture("get_my_orders_result.json")
    orders["items"][0]["items"][0]["quantity"] = 100
    with pytest.raises(ValueError):
        GetMyOrdersResult.model_validate(orders, strict=True)

    orders = fixture("get_my_orders_result.json")
    orders["items"][0]["buyerId"] = "other-user"
    with pytest.raises(ValueError):
        GetMyOrdersResult.model_validate(orders, strict=True)


def test_new_tools_are_feature_gated_and_default_registry_stays_search_only():
    disabled = consumer_readonly_registry()
    assert disabled.definitions() == []
    with pytest.raises(ValueError):
        consumer_readonly_registry(enabled=True)

    knowledge, orders, _ = handlers()
    enabled = consumer_readonly_registry(knowledge, orders, enabled=True)
    assert [item["function"]["name"] for item in enabled.definitions()] == [GET_MY_ORDERS_NAME, KNOWLEDGE_QA_NAME]
    assert enabled.get(KNOWLEDGE_QA_NAME).version == KNOWLEDGE_QA_VERSION
    assert enabled.get(GET_MY_ORDERS_NAME).version == GET_MY_ORDERS_VERSION
    assert all(item["function"]["parameters"]["additionalProperties"] is False for item in enabled.definitions())

    default = default_registry(lambda query, limit, merchant_id, scope: [])
    assert [item["function"]["name"] for item in default.definitions()] == ["search_products"]


def test_runtime_executes_native_knowledge_and_order_calls_with_versioned_results():
    knowledge_call = fixture("knowledge_qa_call.json")["arguments"]
    orders_call = fixture("get_my_orders_call.json")["arguments"]
    native = fixture("native_tool_calls.json")
    knowledge, orders, seen = handlers()
    registry = consumer_readonly_registry(knowledge, orders, enabled=True)
    model = FakeModel(
        [
            native[KNOWLEDGE_QA_NAME],
            native[GET_MY_ORDERS_NAME],
            final_answer(),
        ]
    )

    result = AgentRuntime(model, registry, evidence_status="STUB", max_tool_calls=3).run("Read my authorized data", active_scope())

    assert result.status == "COMPLETED"
    assert [(item.name, item.status) for item in result.tool_calls] == [
        (KNOWLEDGE_QA_NAME, "SUCCEEDED"),
        (GET_MY_ORDERS_NAME, "SUCCEEDED"),
    ]
    assert seen["knowledge"].question == knowledge_call["question"]
    assert seen["orders"].state == orders_call["state"]
    assert seen["orders"].page == orders_call["page"]
    assert len(model.requests) == 3


@pytest.mark.parametrize(
    ("name", "arguments", "error"),
    [
        ("delete_order", {}, "UNKNOWN_TOOL"),
        (KNOWLEDGE_QA_NAME, {}, "INVALID_TOOL_ARGUMENTS"),
    ],
)
def test_runtime_rejects_unknown_and_missing_arguments_without_invoking_handlers(name, arguments, error):
    knowledge, orders, seen = handlers()
    registry = consumer_readonly_registry(knowledge, orders, enabled=True)
    result = AgentRuntime(FakeModel([native_call(name, "call-invalid", arguments)]), registry, evidence_status="STUB").run(
        "read", active_scope()
    )
    assert result.status == "FAILED"
    assert result.error_code == error
    assert result.tool_calls[0].status == "REJECTED"
    assert seen == {}


def test_runtime_rejects_plain_text_tool_impersonation_for_new_tool():
    knowledge, orders, seen = handlers()
    registry = consumer_readonly_registry(knowledge, orders, enabled=True)
    fake_text = fixture("failure_cases.json")["fake_text"]
    result = AgentRuntime(FakeModel([final_answer(fake_text)]), registry, evidence_status="STUB").run("read", active_scope())
    assert result.status == "FAILED"
    assert result.error_code == "PLAIN_TEXT_TOOL_CALL_REJECTED"
    assert seen == {}


@pytest.mark.parametrize("error_code", ["UPSTREAM_TIMEOUT", "UPSTREAM_429", "UPSTREAM_5XX"])
def test_runtime_preserves_bounded_upstream_failure_categories(error_code):
    knowledge, orders, _ = handlers()
    registry = consumer_readonly_registry(knowledge, orders, enabled=True)
    result = AgentRuntime(FakeModel([AgentModelError(error_code)]), registry, evidence_status="STUB").run("read", active_scope())
    assert result.status == "FAILED"
    assert result.error_code == error_code
    assert result.answer == ""
    assert result.tool_calls == []
    assert fixture("failure_cases.json")["secret_markers"][0] not in json.dumps(result.as_dict())


def test_upstream_error_mapping_and_evidence_redaction(tmp_path, caplog):
    request = httpx.Request("POST", "https://fixture.invalid")
    assert safe_exception_code(httpx.ReadTimeout("fixture timeout", request=request)) == "UPSTREAM_TIMEOUT"
    assert safe_exception_code(httpx.HTTPStatusError("fixture 429 body", request=request, response=httpx.Response(429))) == "UPSTREAM_429"
    assert safe_exception_code(httpx.HTTPStatusError("fixture 5xx body", request=request, response=httpx.Response(503))) == "UPSTREAM_5XX"

    output = tmp_path / "evidence.json"
    recorder = EvidenceRecorder(output, "fixture-run", "consumer-readonly-contract", "STUB")
    markers = fixture("failure_cases.json")["secret_markers"]
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        recorder.add(
            "redaction",
            "FAIL",
            authorization=markers[0],
            prompt=markers[1],
            response_body=markers[2],
            errorCode="UPSTREAM_5XX",
        )
    serialized = output.read_text(encoding="utf-8")
    assert all(marker not in serialized for marker in markers)
    assert all(marker not in caplog.text for marker in markers)
