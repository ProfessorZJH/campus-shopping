from __future__ import annotations

import hashlib
import hmac
import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .agent_contract import AgentContractError, SearchProductsArguments
from .agent_provider import OpenAICompatibleToolModel
from .agent_runtime import AgentModelError, _looks_like_plain_text_tool_call

PROTOCOL_VERSION = "1.0"
MAX_QUESTION = 2000
MAX_TOOL_CALLS = 8
MAX_ROUND_TRIPS = 4
MAX_BODY_TEXT = 12000
MAX_CACHED_STATES = 512


class RuntimeBridgeError(RuntimeError):
    def __init__(self, code: str, status: int = 422):
        super().__init__(code)
        self.code = code
        self.status = status


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class RuntimeToolDefinition(StrictModel):
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(default="", max_length=1000)
    parameters: dict[str, Any] = Field(default_factory=dict)
    readOnly: bool = True


class RuntimeScope(StrictModel):
    userId: str = Field(min_length=1, max_length=64)
    identityKind: str = Field(pattern=r"^(consumer|merchant)$")
    identityId: str | None = Field(default=None, max_length=64)
    authorizedMerchantIds: list[str] = Field(default_factory=list, max_length=100)
    permissions: list[str] = Field(default_factory=list, max_length=100)
    conversationId: str = Field(min_length=1, max_length=64)
    turnToken: str = Field(min_length=1, max_length=256)
    turnExpiresAt: float

    @field_validator("turnExpiresAt")
    @classmethod
    def finite_expiry(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("invalid expiry")
        return value


class RuntimeToolResult(StrictModel):
    callId: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=64)
    result: dict[str, Any]
    errorCode: str | None = Field(default=None, max_length=64)


class RuntimeBridgeRequest(StrictModel):
    protocolVersion: str = Field(default=PROTOCOL_VERSION, min_length=1, max_length=16)
    runId: str = Field(min_length=1, max_length=64)
    requestId: str = Field(min_length=1, max_length=128)
    phase: str = Field(pattern=r"^(START|CONTINUE)$")
    question: str | None = Field(default=None, max_length=MAX_QUESTION)
    continuationId: str | None = Field(default=None, max_length=128)
    scope: RuntimeScope
    allowedTools: list[RuntimeToolDefinition] = Field(default_factory=list, max_length=8)
    toolResults: list[RuntimeToolResult] = Field(default_factory=list, max_length=8)

    @field_validator("question")
    @classmethod
    def question_trimmed(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("question required")
        return value.strip() if value is not None else value


class RuntimeToolCall(StrictModel):
    callId: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=64)
    arguments: dict[str, Any]


class RuntimeBridgeResponse(StrictModel):
    protocolVersion: str = PROTOCOL_VERSION
    runId: str
    requestId: str
    status: str
    continuationId: str | None = None
    toolCalls: list[RuntimeToolCall] = Field(default_factory=list)
    answer: str | None = Field(default=None, max_length=MAX_BODY_TEXT)
    evidenceStatus: str = "STUB"
    usage: dict[str, int] = Field(default_factory=dict)
    durationMs: int = 0
    errorCode: str | None = None


@dataclass
class _Continuation:
    run_id: str
    scope_fingerprint: str
    messages: list[dict[str, Any]]
    tools: list[dict[str, Any]]
    expires_at: float
    tool_calls: int = 0
    rounds: int = 0
    pending_call_ids: tuple[str, ...] = ()


def _canonical(run_id: str, request_id: str, expires: float) -> bytes:
    return f"{run_id}|{request_id}|{expires:.6f}".encode("utf-8")


def capability_signature(service_key: str, run_id: str, request_id: str, expires: float) -> str:
    return hmac.new(service_key.encode("utf-8"), _canonical(run_id, request_id, expires), hashlib.sha256).hexdigest()


def _fingerprint(scope: RuntimeScope, tools: list[RuntimeToolDefinition]) -> str:
    payload = {"scope": scope.model_dump(mode="json"), "tools": [tool.model_dump(mode="json") for tool in tools]}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class RuntimeBridge:
    def __init__(self, settings: Any, model: Any | None = None, *, max_cached_states: int = MAX_CACHED_STATES):
        self.settings = settings
        self.model = model or OpenAICompatibleToolModel(settings)
        self._max_cached_states = max(1, max_cached_states)
        self._lock = threading.RLock()
        self._continuations: dict[str, _Continuation] = {}
        self._responses: dict[tuple[str, str], tuple[float, str, RuntimeBridgeResponse]] = {}

    def _prune_locked(self, now: float) -> None:
        expired_cont = [cid for cid, item in self._continuations.items() if item.expires_at <= now]
        for cid in expired_cont:
            self._continuations.pop(cid, None)
        while len(self._continuations) > self._max_cached_states:
            self._continuations.pop(next(iter(self._continuations)), None)

        expired_resp = [key for key, item in self._responses.items() if item[0] <= now]
        for key in expired_resp:
            self._responses.pop(key, None)
        while len(self._responses) > self._max_cached_states:
            self._responses.pop(next(iter(self._responses)), None)

    def _evidence_status(self) -> str:
        llm_url = str(getattr(self.settings, "llm_url", "") or "")
        llm_key = str(getattr(self.settings, "llm_key", "") or "")
        if isinstance(self.model, OpenAICompatibleToolModel) and bool(llm_key) and llm_url.startswith("https://"):
            return "REAL"
        return "STUB"

    def _auth(self, request: RuntimeBridgeRequest, service_key: str, capability: str | None, signature: str | None, capability_digest: str | None) -> None:
        if not service_key or not hmac.compare_digest(service_key, self.settings.api_key):
            raise RuntimeBridgeError("AUTH_INVALID", 401)
        if not capability or len(capability) > 256 or not signature or not capability_digest:
            raise RuntimeBridgeError("AUTH_INVALID", 401)
        expected_digest = hashlib.sha256(capability.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(expected_digest, capability_digest):
            raise RuntimeBridgeError("AUTH_INVALID", 401)
        expected = capability_signature(service_key, request.runId, request.requestId, request.scope.turnExpiresAt)
        if not hmac.compare_digest(expected, signature):
            raise RuntimeBridgeError("AUTH_INVALID", 401)
        if request.protocolVersion != PROTOCOL_VERSION:
            raise RuntimeBridgeError("PROTOCOL_UNSUPPORTED", 422)
        if request.scope.turnExpiresAt <= datetime.now(timezone.utc).timestamp():
            raise RuntimeBridgeError("TURN_LEASE_EXPIRED", 422)

    def _tools(self, definitions: list[RuntimeToolDefinition]) -> list[dict[str, Any]]:
        allowed = {"search_products"}
        result = []
        for item in definitions:
            if item.name not in allowed or not item.readOnly:
                raise RuntimeBridgeError("UNKNOWN_TOOL", 422)
            result.append({"type": "function", "function": {"name": item.name, "description": item.description, "parameters": item.parameters}})
        if not result:
            raise RuntimeBridgeError("NO_ALLOWED_TOOLS", 422)
        return result

    def _response(self, request: RuntimeBridgeRequest, **kwargs: Any) -> RuntimeBridgeResponse:
        return RuntimeBridgeResponse(runId=request.runId, requestId=request.requestId, **kwargs)

    def turn(self, request: RuntimeBridgeRequest, *, service_key: str, capability: str | None, signature: str | None, capability_digest: str | None = None) -> RuntimeBridgeResponse:
        started = time.perf_counter()
        now = datetime.now(timezone.utc).timestamp()
        with self._lock:
            self._prune_locked(now)
        self._auth(request, service_key, capability, signature, capability_digest)
        key = (request.runId, request.requestId)
        fingerprint = hashlib.sha256(request.model_dump_json().encode()).hexdigest()
        scope_fingerprint = _fingerprint(request.scope, request.allowedTools)

        with self._lock:
            self._prune_locked(datetime.now(timezone.utc).timestamp())
            prior = self._responses.get(key)
            if prior:
                if prior[1] != fingerprint:
                    raise RuntimeBridgeError("REQUEST_CONFLICT", 409)
                return prior[2]
            if request.phase == "START":
                if request.question is None or request.continuationId is not None or request.toolResults:
                    raise RuntimeBridgeError("INVALID_START", 422)
                candidate_messages: list[dict[str, Any]] = [{"role": "user", "content": request.question}]
                tools = self._tools(request.allowedTools)
                continuation_id = hashlib.sha256(f"{request.runId}|{request.requestId}|{time.time_ns()}".encode()).hexdigest()[:32]
                prior_tool_calls = 0
                next_rounds = 1
            else:
                if not request.continuationId or request.continuationId not in self._continuations:
                    raise RuntimeBridgeError("CONTINUATION_NOT_FOUND", 409)
                state = self._continuations[request.continuationId]
                if state.run_id != request.runId or state.scope_fingerprint != scope_fingerprint:
                    raise RuntimeBridgeError("CONTINUATION_CONFLICT", 409)
                if request.question is not None or not request.toolResults:
                    raise RuntimeBridgeError("INVALID_CONTINUE", 422)
                if state.rounds >= MAX_ROUND_TRIPS:
                    raise RuntimeBridgeError("ROUND_TRIP_LIMIT", 422)
                if state.tool_calls >= MAX_TOOL_CALLS:
                    raise RuntimeBridgeError("TOOL_CALL_LIMIT", 422)
                candidate_messages = list(state.messages)
                for result in request.toolResults:
                    candidate_messages.append({"role": "tool", "tool_call_id": result.callId, "name": result.name, "content": json.dumps(result.result, ensure_ascii=False, separators=(",", ":"))})
                tools = list(state.tools)
                continuation_id = request.continuationId
                prior_tool_calls = state.tool_calls
                next_rounds = state.rounds + 1

        evidence_status = self._evidence_status()
        try:
            raw = self.model.complete(messages=candidate_messages, tools=tools, metadata={"runId": request.runId, "phase": request.phase})
            message = raw.get("choices", [{}])[0].get("message", {}) if isinstance(raw, Mapping) else {}
            calls = message.get("tool_calls") or []
            usage = raw.get("usage", {}) if isinstance(raw, Mapping) and isinstance(raw.get("usage"), Mapping) else {}
            safe_usage = {key_name: value for key_name, value in usage.items() if key_name in ("prompt_tokens", "completion_tokens", "total_tokens") and isinstance(value, int) and value >= 0}
            if calls:
                parsed: list[RuntimeToolCall] = []
                for call in calls:
                    fn = call.get("function", {}) if isinstance(call, Mapping) else {}
                    name, arguments, call_id = fn.get("name"), fn.get("arguments", {}), call.get("id") if isinstance(call, Mapping) else None
                    if name not in ("search_products",) or not isinstance(call_id, str) or not call_id:
                        raise RuntimeBridgeError("INVALID_TOOL_CALL", 422)
                    if isinstance(arguments, str):
                        arguments = json.loads(arguments)
                    if not isinstance(arguments, dict):
                        raise RuntimeBridgeError("INVALID_TOOL_ARGUMENTS", 422)
                    try:
                        arguments = SearchProductsArguments.model_validate(arguments, strict=True).model_dump(by_alias=True, mode="json")
                    except Exception:
                        raise RuntimeBridgeError("INVALID_TOOL_ARGUMENTS", 422) from None
                    parsed.append(RuntimeToolCall(callId=call_id, name=name, arguments=arguments))
                if prior_tool_calls + len(parsed) > MAX_TOOL_CALLS:
                    raise RuntimeBridgeError("TOOL_CALL_LIMIT", 422)
                committed_messages = list(candidate_messages)
                committed_messages.append({"role": "assistant", "tool_calls": [{"id": call.callId, "type": "function", "function": {"name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False, separators=(",", ":"))}} for call in parsed]})
                next_state = _Continuation(
                    run_id=request.runId,
                    scope_fingerprint=scope_fingerprint,
                    messages=committed_messages,
                    tools=tools,
                    expires_at=request.scope.turnExpiresAt,
                    tool_calls=prior_tool_calls + len(parsed),
                    rounds=next_rounds,
                    pending_call_ids=tuple(call.callId for call in parsed),
                )
                response = self._response(request, status="TOOL_CALLS", continuationId=continuation_id, toolCalls=parsed, evidenceStatus=evidence_status, usage=safe_usage, durationMs=int((time.perf_counter()-started)*1000))
                with self._lock:
                    self._continuations[continuation_id] = next_state
                    self._responses[key] = (request.scope.turnExpiresAt, fingerprint, response)
                    self._prune_locked(datetime.now(timezone.utc).timestamp())
            else:
                answer = message.get("content") if isinstance(message, Mapping) else None
                if not isinstance(answer, str) or not answer.strip():
                    raise RuntimeBridgeError("EMPTY_MODEL_ANSWER", 422)
                if _looks_like_plain_text_tool_call(answer):
                    raise RuntimeBridgeError("PLAIN_TEXT_TOOL_CALL_REJECTED", 422)
                response = self._response(request, status="FINAL", continuationId=continuation_id, answer=answer.strip(), evidenceStatus=evidence_status, usage=safe_usage, durationMs=int((time.perf_counter()-started)*1000))
                with self._lock:
                    self._continuations.pop(continuation_id, None)
                    self._responses[key] = (request.scope.turnExpiresAt, fingerprint, response)
                    self._prune_locked(datetime.now(timezone.utc).timestamp())
        except RuntimeBridgeError:
            raise
        except AgentModelError as error:
            code = str(getattr(error, "code", "AI_UNAVAILABLE"))
            status = 429 if code == "UPSTREAM_429" else 503 if code in ("UPSTREAM_5XX", "UPSTREAM_TIMEOUT", "UPSTREAM_CONNECTION") else 422
            raise RuntimeBridgeError(code, status) from None
        except (ValueError, TypeError, KeyError, IndexError, json.JSONDecodeError):
            raise RuntimeBridgeError("INVALID_MODEL_RESPONSE", 422) from None
        return response
