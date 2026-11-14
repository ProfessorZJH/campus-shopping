from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.runtime_bridge import (
    PROTOCOL_VERSION,
    RuntimeBridgeRequest,
    RuntimeBridgeResponse,
)


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "runtime_bridge"


def load_fixture(name: str) -> dict[str, Any]:
    with (FIXTURE_DIR / f"{name}.json").open(encoding="utf-8") as stream:
        payload = json.load(stream)
    assert isinstance(payload, dict)
    return payload


def test_runtime_bridge_fixtures_are_json_and_desensitized() -> None:
    names = {path.stem for path in FIXTURE_DIR.glob("*.json")}
    assert names == {"start", "tool_calls", "continue", "final", "failed"}

    serialized = "\n".join(path.read_text(encoding="utf-8") for path in FIXTURE_DIR.glob("*.json"))
    lowered = serialized.lower()
    for marker in ("password", "api_key", "secret", "sk-", "bearer "):
        assert marker not in lowered


def test_start_and_continue_fixtures_parse_as_versioned_requests() -> None:
    start = RuntimeBridgeRequest.model_validate(load_fixture("start"), strict=True)
    follow_up = RuntimeBridgeRequest.model_validate(load_fixture("continue"), strict=True)

    assert start.protocolVersion == PROTOCOL_VERSION
    assert start.phase == "START"
    assert start.question == "Find sugar-free drinks"
    assert start.continuationId is None
    assert start.toolResults == []
    assert [tool.name for tool in start.allowedTools] == ["search_products"]
    assert start.allowedTools[0].readOnly is True

    assert follow_up.protocolVersion == PROTOCOL_VERSION
    assert follow_up.phase == "CONTINUE"
    assert follow_up.question is None
    assert follow_up.continuationId == "continuation-redacted-001"
    assert len(follow_up.toolResults) == 1
    assert follow_up.toolResults[0].callId == "call-redacted-001"
    assert follow_up.toolResults[0].result["verifiedBy"] == "java-facts"


@pytest.mark.parametrize(
    ("name", "status"),
    [("tool_calls", "TOOL_CALLS"), ("final", "FINAL"), ("failed", "FAILED")],
)
def test_runtime_bridge_result_fixtures_parse_with_status_contract(name: str, status: str) -> None:
    result = RuntimeBridgeResponse.model_validate(load_fixture(name), strict=True)

    assert result.protocolVersion == PROTOCOL_VERSION
    assert result.status == status
    assert result.runId.startswith("run-redacted-")
    assert result.requestId.startswith("request-redacted-")
    assert result.durationMs >= 0

    if status == "TOOL_CALLS":
        assert result.continuationId
        assert len(result.toolCalls) == 1
        assert result.toolCalls[0].callId == "call-redacted-001"
        assert result.toolCalls[0].name == "search_products"
        assert result.toolCalls[0].arguments["query"] == "sugar-free drinks"
        assert result.answer is None
        assert result.errorCode is None
    elif status == "FINAL":
        assert result.continuationId
        assert result.toolCalls == []
        assert result.answer == "I found one matching product."
        assert result.errorCode is None
    else:
        assert result.toolCalls == []
        assert result.answer is None
        assert result.errorCode == "AI_UNAVAILABLE"


def test_fixture_chain_preserves_run_continuation_and_call_identity() -> None:
    start = RuntimeBridgeRequest.model_validate(load_fixture("start"), strict=True)
    tool_calls = RuntimeBridgeResponse.model_validate(load_fixture("tool_calls"), strict=True)
    follow_up = RuntimeBridgeRequest.model_validate(load_fixture("continue"), strict=True)
    final = RuntimeBridgeResponse.model_validate(load_fixture("final"), strict=True)

    assert start.runId == tool_calls.runId == follow_up.runId == final.runId
    assert tool_calls.continuationId == follow_up.continuationId == final.continuationId
    assert tool_calls.toolCalls[0].callId == follow_up.toolResults[0].callId
    assert tool_calls.toolCalls[0].name == follow_up.toolResults[0].name
