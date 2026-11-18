from __future__ import annotations

import time
import hashlib

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.runtime_bridge import (
    PROTOCOL_VERSION,
    RuntimeBridge,
    RuntimeBridgeError,
    RuntimeBridgeRequest,
    RuntimeScope,
    RuntimeToolDefinition,
    capability_signature,
)

KEY = "runtime-bridge-test-service-key"


def scope(expiry: float | None = None) -> RuntimeScope:
    return RuntimeScope(
        userId="u-1",
        identityKind="consumer",
        authorizedMerchantIds=[],
        permissions=["catalog.product.search"],
        conversationId="c-1",
        turnToken="turn-secret",
        turnExpiresAt=expiry or time.time() + 300,
    )


def request(*, phase="START", request_id="req-1", question="找茶", continuation_id=None, results=None, current_scope=None):
    return RuntimeBridgeRequest(
        protocolVersion=PROTOCOL_VERSION,
        runId="run-1",
        requestId=request_id,
        phase=phase,
        question=question if phase == "START" else None,
        continuationId=continuation_id,
        scope=current_scope or scope(),
        allowedTools=[RuntimeToolDefinition(name="search_products", parameters={"type": "object", "properties": {"query": {"type": "string"}}})],
        toolResults=results or [],
    )


class FakeModel:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def complete(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)


def tool_response(call_id="call-1"):
    return {"choices": [{"message": {"tool_calls": [{"id": call_id, "type": "function", "function": {"name": "search_products", "arguments": '{"query":"茶"}'}}]}}], "usage": {"total_tokens": 3}}


def final_response(answer="已找到"):
    return {"choices": [{"message": {"content": answer}}], "usage": {"total_tokens": 2}}


def bridge(model=None):
    settings = Settings(api_key=KEY, db_path="/tmp/runtime-bridge-test.sqlite")
    return RuntimeBridge(settings, model=model or FakeModel(final_response()))


def signed(req, capability="capability-secret"):
    return capability_signature(KEY, req.runId, req.requestId, req.scope.turnExpiresAt)


def digest(capability="capability-secret"):
    return hashlib.sha256(capability.encode()).hexdigest()


def test_start_returns_native_tool_call_without_executing_business_tool():
    model = FakeModel(tool_response())
    req = request()
    result = bridge(model).turn(req, service_key=KEY, capability="capability-secret", signature=signed(req), capability_digest=digest())
    assert result.status == "TOOL_CALLS"
    assert result.toolCalls[0].name == "search_products"
    assert result.toolCalls[0].arguments == {"query": "茶", "limit": 10, "merchantId": None}
    assert len(model.calls) == 1


@pytest.mark.parametrize(
    ("response", "code"),
    [
        ({"choices": [{"message": {"tool_calls": [{"id": "call-1", "type": "function", "function": {"name": "delete_order", "arguments": "{}"}}]}}]}, "INVALID_TOOL_CALL"),
        ({"choices": [{"message": {"content": "call search_products with query tea"}}]}, "PLAIN_TEXT_TOOL_CALL_REJECTED"),
        ({"choices": [{"message": {"tool_calls": [{"id": "call-1", "type": "function", "function": {"name": "search_products", "arguments": "{}"}}]}}]}, "INVALID_TOOL_ARGUMENTS"),
    ],
)
def test_decision_mode_rejects_unknown_pseudo_or_invalid_tool_calls(response, code):
    req = request()
    with pytest.raises(RuntimeBridgeError, match=code):
        bridge(FakeModel(response)).turn(req, service_key=KEY, capability="capability-secret", signature=signed(req), capability_digest=digest())


def test_continue_accepts_tool_result_and_returns_final():
    model = FakeModel(tool_response(), final_response())
    runtime = bridge(model)
    start = request()
    first = runtime.turn(start, service_key=KEY, capability="capability-secret", signature=signed(start), capability_digest=digest())
    follow = request(
        phase="CONTINUE",
        request_id="req-2",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[{"callId": "call-1", "name": "search_products", "result": {"readOnly": True, "candidates": []}}],
    )
    second = runtime.turn(follow, service_key=KEY, capability="capability-secret", signature=signed(follow), capability_digest=digest())
    assert second.status == "FINAL"
    assert second.answer == "已找到"


def test_runtime_rejects_missing_continuation_after_restart():
    first_runtime = bridge(FakeModel(tool_response()))
    start = request()
    first = first_runtime.turn(start, service_key=KEY, capability="capability-secret", signature=signed(start), capability_digest=digest())
    restarted = bridge(FakeModel(final_response()))
    follow = request(
        phase="CONTINUE",
        request_id="req-2",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[{"callId": "call-1", "name": "search_products", "result": {}}],
    )
    with pytest.raises(RuntimeBridgeError, match="CONTINUATION_NOT_FOUND"):
        restarted.turn(follow, service_key=KEY, capability="capability-secret", signature=signed(follow), capability_digest=digest())


def test_runtime_enforces_tool_call_and_round_trip_limits():
    calls = [
        {"id": f"call-{index}", "type": "function", "function": {"name": "search_products", "arguments": '{"query":"tea"}'}}
        for index in range(8)
    ]
    eight_calls = {"choices": [{"message": {"tool_calls": calls}}]}
    runtime = bridge(FakeModel(eight_calls))
    start = request()
    first = runtime.turn(start, service_key=KEY, capability="cap", signature=signed(start, "cap"), capability_digest=digest("cap"))
    assert len(first.toolCalls) == 8
    follow = request(
        phase="CONTINUE",
        request_id="req-2",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[{"callId": f"call-{index}", "name": "search_products", "result": {}} for index in range(8)],
    )
    with pytest.raises(RuntimeBridgeError, match="TOOL_CALL_LIMIT"):
        runtime.turn(follow, service_key=KEY, capability="cap", signature=signed(follow, "cap"), capability_digest=digest("cap"))

    repeated = bridge(FakeModel(tool_response(), tool_response(), tool_response(), tool_response()))
    start = request(request_id="req-round-start")
    result = repeated.turn(start, service_key=KEY, capability="cap", signature=signed(start, "cap"), capability_digest=digest("cap"))
    for index in range(1, 4):
        follow = request(
            phase="CONTINUE",
            request_id=f"req-round-{index}",
            continuation_id=result.continuationId,
            current_scope=start.scope,
            results=[{"callId": "call-1", "name": "search_products", "result": {}}],
        )
        result = repeated.turn(follow, service_key=KEY, capability="cap", signature=signed(follow, "cap"), capability_digest=digest("cap"))
    follow = request(
        phase="CONTINUE",
        request_id="req-round-4",
        continuation_id=result.continuationId,
        current_scope=start.scope,
        results=[{"callId": "call-1", "name": "search_products", "result": {}}],
    )
    with pytest.raises(RuntimeBridgeError, match="ROUND_TRIP_LIMIT"):
        repeated.turn(follow, service_key=KEY, capability="cap", signature=signed(follow, "cap"), capability_digest=digest("cap"))


def test_same_request_replays_and_different_payload_conflicts():
    runtime = bridge(FakeModel(final_response()))
    req = request()
    sig = signed(req)
    first = runtime.turn(req, service_key=KEY, capability="capability-secret", signature=sig, capability_digest=digest())
    replay = runtime.turn(req, service_key=KEY, capability="capability-secret", signature=sig, capability_digest=digest())
    assert replay == first
    changed = request(question="找牛奶")
    with pytest.raises(RuntimeBridgeError, match="REQUEST_CONFLICT"):
        runtime.turn(changed, service_key=KEY, capability="capability-secret", signature=signed(changed), capability_digest=digest())


@pytest.mark.parametrize("kwargs,code,status", [
    ({"service_key": "bad", "capability": "cap", "signature": "bad"}, "AUTH_INVALID", 401),
    ({"service_key": KEY, "capability": None, "signature": "bad"}, "AUTH_INVALID", 401),
])
def test_internal_auth_is_required(kwargs, code, status):
    req = request()
    with pytest.raises(RuntimeBridgeError) as error:
        bridge().turn(req, capability_digest=digest(), **kwargs)
    assert error.value.code == code and error.value.status == status


def test_expired_lease_and_scope_mutation_are_rejected():
    expired = request(current_scope=scope(time.time() - 1))
    with pytest.raises(RuntimeBridgeError, match="TURN_LEASE_EXPIRED"):
        bridge().turn(expired, service_key=KEY, capability="cap", signature=signed(expired), capability_digest=hashlib.sha256(b"cap").hexdigest())
    runtime = bridge(FakeModel(tool_response()))
    first = request()
    first_response = runtime.turn(first, service_key=KEY, capability="cap", signature=signed(first), capability_digest=hashlib.sha256(b"cap").hexdigest())
    mutated_scope = first.scope.model_copy(update={"permissions": []})
    follow = request(phase="CONTINUE", request_id="req-2", continuation_id=first_response.continuationId, results=[{"callId":"c","name":"search_products","result":{}}], current_scope=mutated_scope)
    with pytest.raises(RuntimeBridgeError, match="CONTINUATION_CONFLICT"):
        runtime.turn(follow, service_key=KEY, capability="cap", signature=signed(follow), capability_digest=hashlib.sha256(b"cap").hexdigest())


def test_upstream_errors_are_stable_and_body_is_not_exposed():
    class BrokenModel:
        def complete(self, **kwargs):
            from app.agent_runtime import AgentModelError
            raise AgentModelError("UPSTREAM_429")

    req = request()
    with pytest.raises(RuntimeBridgeError) as error:
        bridge(BrokenModel()).turn(req, service_key=KEY, capability="cap", signature=signed(req), capability_digest=hashlib.sha256(b"cap").hexdigest())
    assert error.value.code == "UPSTREAM_429" and error.value.status == 429
    assert "secret" not in str(error.value)


def test_route_requires_request_id_and_hides_public_agent_route(tmp_path):
    settings = Settings(api_key=KEY, db_path=str(tmp_path / "route.db"))
    app = create_app(settings)
    assert "/internal/v1/agent/runtime/turn" in {route.path for route in app.routes}
    assert not any(route.path.startswith("/v1/agent") or route.path.startswith("/agent") for route in app.routes)
    with TestClient(app) as client:
        req = request()
        payload = req.model_dump(by_alias=True, exclude_none=True)
        response = client.post("/internal/v1/agent/runtime/turn", json=payload, headers={"X-Service-Key": KEY, "X-Agent-Capability": "cap", "X-Agent-Capability-Signature": signed(req)})
        assert response.status_code == 422
        assert response.json()["errorCode"] == "REQUEST_ID_INVALID"
    app.state.store.close()


def test_route_rejects_missing_capability_digest(tmp_path):
    settings = Settings(api_key=KEY, db_path=str(tmp_path / "digest.db"))
    app = create_app(settings)
    with TestClient(app) as client:
        req = request()
        payload = req.model_dump(by_alias=True, exclude_none=True)
        response = client.post(
            "/internal/v1/agent/runtime/turn",
            json=payload,
            headers={
                "X-Service-Key": KEY,
                "X-Agent-Capability": "capability-secret",
                "X-Agent-Capability-Signature": signed(req),
                "X-Request-ID": req.requestId,
            },
        )
        assert response.status_code == 401
        assert response.json() == {"errorCode": "AUTH_INVALID"}
    app.state.store.close()


def test_runtime_route_obeys_request_body_limit(tmp_path):
    settings = Settings(api_key=KEY, db_path=str(tmp_path / "body-limit.db"))
    app = create_app(settings)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/internal/v1/agent/runtime/turn",
                content=b"x" * 4_000_001,
                headers={"Content-Type": "application/json"},
            )
        assert response.status_code == 413
    finally:
        app.state.store.close()


def test_continue_failure_does_not_corrupt_messages_on_retry_and_evicts_bounded_cache():
    from app.agent_runtime import AgentModelError

    class FlakyThenOkModel:
        def __init__(self):
            self.calls = []
            self._step = 0

        def complete(self, **kwargs):
            self._step += 1
            self.calls.append(list(kwargs["messages"]))
            if self._step == 1:
                return tool_response("call-retry")
            if self._step == 2:
                raise AgentModelError("UPSTREAM_5XX")
            return final_response("重试恢复成功")

    model = FlakyThenOkModel()
    settings = Settings(api_key=KEY, db_path="/tmp/runtime-bridge-retry.sqlite")
    runtime = RuntimeBridge(settings, model=model, max_cached_states=2)
    start = request(request_id="req-start")
    first = runtime.turn(start, service_key=KEY, capability="cap", signature=signed(start, "cap"), capability_digest=digest("cap"))
    failed_follow = request(
        phase="CONTINUE",
        request_id="req-cont-fail",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[{"callId": "call-retry", "name": "search_products", "result": {"items": []}}],
    )
    with pytest.raises(RuntimeBridgeError) as err:
        runtime.turn(failed_follow, service_key=KEY, capability="cap", signature=signed(failed_follow, "cap"), capability_digest=digest("cap"))
    assert err.value.code == "UPSTREAM_5XX"

    retry_follow = request(
        phase="CONTINUE",
        request_id="req-cont-ok",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[{"callId": "call-retry", "name": "search_products", "result": {"items": []}}],
    )
    recovered = runtime.turn(retry_follow, service_key=KEY, capability="cap", signature=signed(retry_follow, "cap"), capability_digest=digest("cap"))
    assert recovered.status == "FINAL"
    assert recovered.answer == "重试恢复成功"
    # Tool result message must appear only once, not duplicated by the failed attempt.
    assert [m["role"] for m in model.calls[-1]] == ["user", "assistant", "tool"]

    for idx in range(5):
        extra = request(request_id=f"req-cap-{idx}")
        runtime.turn(extra, service_key=KEY, capability="cap", signature=signed(extra, "cap"), capability_digest=digest("cap"))
    assert len(runtime._responses) <= 2


def test_continue_validates_pending_tool_call_ids_count_names_and_duplicates():
    two_calls = {
        "choices": [
            {
                "message": {
                    "tool_calls": [
                        {"id": "call-a", "type": "function", "function": {"name": "search_products", "arguments": '{"query":"tea"}'}},
                        {"id": "call-b", "type": "function", "function": {"name": "search_products", "arguments": '{"query":"milk"}'}},
                    ]
                }
            }
        ]
    }
    model = FakeModel(two_calls, final_response("两项工具结果核验通过"))
    runtime = bridge(model)
    start = request(request_id="req-pending-start")
    first = runtime.turn(start, service_key=KEY, capability="cap", signature=signed(start, "cap"), capability_digest=digest("cap"))

    invalid_batches = [
        [{"callId": "call-a", "name": "search_products", "result": {}}],
        [
            {"callId": "call-a", "name": "search_products", "result": {}},
            {"callId": "call-b", "name": "search_products", "result": {}},
            {"callId": "call-c", "name": "search_products", "result": {}},
        ],
        [
            {"callId": "call-a", "name": "search_products", "result": {}},
            {"callId": "call-a", "name": "search_products", "result": {}},
        ],
        [
            {"callId": "call-a", "name": "search_products", "result": {}},
            {"callId": "call-wrong", "name": "search_products", "result": {}},
        ],
        [
            {"callId": "call-a", "name": "search_products", "result": {}},
            {"callId": "call-b", "name": "knowledge_qa", "result": {}},
        ],
    ]
    for idx, bad_results in enumerate(invalid_batches):
        bad_req = request(
            phase="CONTINUE",
            request_id=f"req-bad-{idx}",
            continuation_id=first.continuationId,
            current_scope=start.scope,
            results=bad_results,
        )
        with pytest.raises(RuntimeBridgeError) as err:
            runtime.turn(bad_req, service_key=KEY, capability="cap", signature=signed(bad_req, "cap"), capability_digest=digest("cap"))
        assert err.value.code == "INVALID_CONTINUE" and err.value.status == 422

    # Valid results submitted in reverse order are accepted and normalized to pending_calls order.
    ok_req = request(
        phase="CONTINUE",
        request_id="req-valid-continue",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[
            {"callId": "call-b", "name": "search_products", "result": {"q": "milk"}},
            {"callId": "call-a", "name": "search_products", "result": {"q": "tea"}},
        ],
    )
    done = runtime.turn(ok_req, service_key=KEY, capability="cap", signature=signed(ok_req, "cap"), capability_digest=digest("cap"))
    assert done.status == "FINAL"
    assert [m["tool_call_id"] for m in model.calls[-1]["messages"] if m["role"] == "tool"] == ["call-a", "call-b"]


def test_concurrent_continue_and_inflight_duplicate_do_not_double_invoke_model():
    import concurrent.futures
    import threading

    entered_continue = threading.Event()
    release_continue = threading.Event()

    class BlockingContinueModel:
        def __init__(self):
            self.start_calls = 0
            self.continue_calls = 0
            self._lock = threading.Lock()

        def complete(self, **kwargs):
            phase = kwargs["metadata"]["phase"]
            if phase == "START":
                with self._lock:
                    self.start_calls += 1
                return tool_response("call-race")
            with self._lock:
                self.continue_calls += 1
            entered_continue.set()
            assert release_continue.wait(timeout=5.0)
            return final_response("单次并发赢家完成")

    model = BlockingContinueModel()
    runtime = bridge(model)
    start = request(request_id="req-race-start")
    first = runtime.turn(start, service_key=KEY, capability="cap", signature=signed(start, "cap"), capability_digest=digest("cap"))

    cont_a = request(
        phase="CONTINUE",
        request_id="req-race-a",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[{"callId": "call-race", "name": "search_products", "result": {"ok": True}}],
    )
    cont_b = request(
        phase="CONTINUE",
        request_id="req-race-b",
        continuation_id=first.continuationId,
        current_scope=start.scope,
        results=[{"callId": "call-race", "name": "search_products", "result": {"ok": True}}],
    )

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        fut_a = pool.submit(
            runtime.turn, cont_a, service_key=KEY, capability="cap", signature=signed(cont_a, "cap"), capability_digest=digest("cap")
        )
        assert entered_continue.wait(timeout=5.0)

        # Both a second requestId on the same continuationId AND an identical in-flight requestId must fail fast with 409.
        with pytest.raises(RuntimeBridgeError) as conflict_err:
            runtime.turn(cont_b, service_key=KEY, capability="cap", signature=signed(cont_b, "cap"), capability_digest=digest("cap"))
        assert conflict_err.value.code == "CONTINUATION_IN_PROGRESS" and conflict_err.value.status == 409

        with pytest.raises(RuntimeBridgeError) as dup_err:
            runtime.turn(cont_a, service_key=KEY, capability="cap", signature=signed(cont_a, "cap"), capability_digest=digest("cap"))
        assert dup_err.value.code == "REQUEST_IN_PROGRESS" and dup_err.value.status == 409

        release_continue.set()
        winner = fut_a.result(timeout=5.0)

    assert winner.status == "FINAL"
    assert model.continue_calls == 1
