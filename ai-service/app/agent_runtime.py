"""Agent v1.1 的最小 Tool Calling 运行时。

运行时只依赖一个注入的模型客户端和受控 ToolRegistry。它不访问数据库、Redis、
购物车或交易 Port；Java/MySQL 事实复验由调用方提供的只读 searcher 完成。
"""
from __future__ import annotations

from dataclasses import dataclass, field
import json
import re
import time
from typing import Any, Iterable, Mapping, Protocol
import uuid

from .agent_contract import AgentContractError, AgentScope, ToolRegistry
from .agent_evidence import EVIDENCE_STATUSES, safe_exception_code
from .observability import logger


class AgentModelError(RuntimeError):
    """模型适配器可抛出的安全错误；正文不会进入结果或日志。"""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class AgentModelClient(Protocol):
    def complete(self, *, messages: list[dict[str, Any]], tools: list[dict[str, Any]], metadata: dict[str, Any]) -> Mapping[str, Any]: ...

    def stream(self, *, messages: list[dict[str, Any]], tools: list[dict[str, Any]], metadata: dict[str, Any]) -> Iterable[Mapping[str, Any]]: ...


@dataclass(frozen=True)
class ToolCall:
    call_id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ToolCallRecord:
    call_id: str
    name: str
    status: str
    error_code: str | None = None


@dataclass
class AgentRunResult:
    run_id: str
    answer: str
    status: str
    evidence_status: str
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    error_code: str | None = None
    duration_ms: int = 0
    usage: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "runId": self.run_id,
            "answer": self.answer,
            "status": self.status,
            "evidenceStatus": self.evidence_status,
            "toolCalls": [record.__dict__.copy() for record in self.tool_calls],
            "errorCode": self.error_code,
            "durationMs": self.duration_ms,
            "usage": dict(self.usage),
        }


@dataclass
class _PartialToolCall:
    call_id: str = ""
    name: str = ""
    arguments: list[str] = field(default_factory=list)

    def build(self, index: int) -> ToolCall:
        try:
            payload = json.loads("".join(self.arguments))
        except (TypeError, ValueError):
            raise AgentContractError("INVALID_STREAM_TOOL_ARGUMENTS") from None
        if not isinstance(payload, dict) or not self.name or not self.call_id:
            raise AgentContractError("INVALID_STREAM_TOOL_CALL")
        return ToolCall(self.call_id, self.name, payload)


class ToolCallAccumulator:
    """合并 OpenAI 兼容流式 tool_calls，保留供应商原始分片顺序。"""

    def __init__(self) -> None:
        self.content: list[str] = []
        self.calls: dict[int, _PartialToolCall] = {}
        self._seen_event_ids: set[str] = set()
        self.finish_reason: str | None = None
        self.usage: dict[str, int] = {}

    def accept(self, chunk: Mapping[str, Any]) -> None:
        if not isinstance(chunk, Mapping):
            raise AgentContractError("INVALID_STREAM_CHUNK")
        event_id = chunk.get("_event_id")
        if event_id is not None:
            if not isinstance(event_id, str) or not event_id or len(event_id) > 256:
                raise AgentContractError("INVALID_STREAM_EVENT_ID")
            if event_id in self._seen_event_ids:
                return
            self._seen_event_ids.add(event_id)
        if isinstance(chunk.get("usage"), Mapping):
            self._merge_usage(chunk["usage"])
        choices = chunk.get("choices")
        if not isinstance(choices, list) or not choices:
            return
        choice = choices[0]
        if not isinstance(choice, Mapping):
            raise AgentContractError("INVALID_STREAM_CHUNK")
        reason = choice.get("finish_reason")
        if reason is not None:
            self.finish_reason = str(reason)
        delta = choice.get("delta") or {}
        if not isinstance(delta, Mapping):
            raise AgentContractError("INVALID_STREAM_DELTA")
        content = delta.get("content")
        if content:
            if not isinstance(content, str):
                raise AgentContractError("INVALID_STREAM_CONTENT")
            self.content.append(content)
        calls = delta.get("tool_calls") or []
        if not isinstance(calls, list):
            raise AgentContractError("INVALID_STREAM_TOOL_CALL")
        for position, call in enumerate(calls):
            if not isinstance(call, Mapping):
                raise AgentContractError("INVALID_STREAM_TOOL_CALL")
            index = int(call.get("index", position))
            function = call.get("function") or {}
            if not isinstance(function, Mapping):
                raise AgentContractError("INVALID_STREAM_TOOL_CALL")
            call_type = call.get("type")
            if call_type is not None and call_type != "function":
                raise AgentContractError("INVALID_STREAM_TOOL_CALL")
            call_id = call.get("id")
            name = function.get("name")
            fragment = function.get("arguments", "")
            if call_id is not None and not isinstance(call_id, str):
                raise AgentContractError("INVALID_STREAM_TOOL_CALL")
            if name is not None and not isinstance(name, str):
                raise AgentContractError("INVALID_STREAM_TOOL_CALL")
            if not isinstance(fragment, str):
                raise AgentContractError("INVALID_STREAM_TOOL_ARGUMENTS")
            target = self.calls.setdefault(index, _PartialToolCall())
            if call_id:
                target.call_id = call_id
            if name:
                target.name = name
            target.arguments.append(fragment)

    def _merge_usage(self, usage: Mapping[str, Any]) -> None:
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            value = usage.get(key)
            if isinstance(value, int) and value >= 0:
                self.usage[key] = max(self.usage.get(key, 0), value)

    def finish(self) -> tuple[str, list[ToolCall], dict[str, int]]:
        if self.finish_reason not in ("stop", "tool_calls"):
            raise AgentContractError("STREAM_NOT_NORMALLY_TERMINATED")
        calls = [self.calls[index].build(index) for index in sorted(self.calls)]
        if calls and self.finish_reason != "tool_calls":
            raise AgentContractError("STREAM_TOOL_CALL_FINISH_MISMATCH")
        return "".join(self.content), calls, dict(self.usage)


def _message(response: Mapping[str, Any]) -> Mapping[str, Any]:
    if not isinstance(response, Mapping):
        raise AgentModelError("INVALID_MODEL_RESPONSE")
    choices = response.get("choices")
    if isinstance(choices, list) and choices and isinstance(choices[0], Mapping):
        candidate = choices[0].get("message")
        if isinstance(candidate, Mapping):
            return candidate
    candidate = response.get("message")
    if isinstance(candidate, Mapping):
        return candidate
    raise AgentModelError("INVALID_MODEL_RESPONSE")


def _finish_reason(response: Mapping[str, Any]) -> str | None:
    choices = response.get("choices")
    if isinstance(choices, list) and choices and isinstance(choices[0], Mapping):
        reason = choices[0].get("finish_reason")
        return reason if isinstance(reason, str) else None
    reason = response.get("finish_reason")
    return reason if isinstance(reason, str) else None


def _tool_calls(message: Mapping[str, Any]) -> list[ToolCall]:
    raw_calls = message.get("tool_calls") or []
    if not isinstance(raw_calls, list):
        raise AgentModelError("INVALID_MODEL_TOOL_CALLS")
    result = []
    for index, raw in enumerate(raw_calls):
        if not isinstance(raw, Mapping):
            raise AgentModelError("INVALID_MODEL_TOOL_CALL")
        if raw.get("type") != "function":
            raise AgentModelError("INVALID_MODEL_TOOL_CALL")
        function = raw.get("function") or {}
        if not isinstance(function, Mapping) or not isinstance(function.get("name"), str):
            raise AgentModelError("INVALID_MODEL_TOOL_CALL")
        arguments = function.get("arguments", {})
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except (TypeError, ValueError):
                raise AgentModelError("INVALID_MODEL_TOOL_ARGUMENTS") from None
        if not isinstance(arguments, dict):
            raise AgentModelError("INVALID_MODEL_TOOL_ARGUMENTS")
        call_id = raw.get("id")
        if not isinstance(call_id, str) or not call_id:
            raise AgentModelError("INVALID_MODEL_TOOL_CALL")
        result.append(ToolCall(call_id, function["name"], arguments))
    return result


def _usage(response: Mapping[str, Any]) -> dict[str, int]:
    raw = response.get("usage")
    if not isinstance(raw, Mapping):
        return {}
    return {
        key: value
        for key, value in ((key, raw.get(key)) for key in ("prompt_tokens", "completion_tokens", "total_tokens"))
        if isinstance(value, int) and value >= 0
    }


def _merge_usage(total: dict[str, int], current: Mapping[str, int]) -> dict[str, int]:
    merged = dict(total)
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        value = current.get(key)
        if isinstance(value, int) and value >= 0:
            merged[key] = merged.get(key, 0) + value
    return merged


def _looks_like_plain_text_tool_call(answer: str) -> bool:
    return bool(
        re.search(r"(?:调用|执行|call|invoke)\s*[`'\"]?search_products", answer, flags=re.IGNORECASE)
    )


class AgentRuntime:
    def __init__(
        self,
        model: AgentModelClient,
        registry: ToolRegistry,
        *,
        model_name: str = "unknown",
        evidence_status: str = "STUB",
        max_tool_calls: int = 3,
        first_tool_name: str | None = None,
    ):
        if evidence_status not in EVIDENCE_STATUSES:
            raise ValueError("非法 Agent 证据状态")
        if not 1 <= max_tool_calls <= 8:
            raise ValueError("max_tool_calls 必须为 1 至 8")
        self.model = model
        self.registry = registry
        self.model_name = model_name
        self.evidence_status = evidence_status
        self.max_tool_calls = max_tool_calls
        self.first_tool_name = first_tool_name

    def run(self, question: str, scope: AgentScope) -> AgentRunResult:
        run_id = uuid.uuid4().hex
        started = time.perf_counter()
        calls: list[ToolCallRecord] = []
        usage: dict[str, int] = {}
        messages: list[dict[str, Any]] = [{"role": "user", "content": question}]
        try:
            scope.assert_active()
            for step in range(self.max_tool_calls + 1):
                response = self.model.complete(
                    messages=messages,
                    tools=self.registry.definitions(),
                    metadata=self._metadata(run_id, step),
                )
                scope.assert_active()
                usage = _merge_usage(usage, _usage(response))
                message = _message(response)
                finish_reason = _finish_reason(response)
                requested = _tool_calls(message)
                if finish_reason not in ("stop", "tool_calls"):
                    raise AgentModelError("MODEL_NOT_NORMALLY_TERMINATED")
                if requested and finish_reason != "tool_calls":
                    raise AgentModelError("MODEL_TOOL_CALL_FINISH_MISMATCH")
                if not requested:
                    if finish_reason != "stop":
                        raise AgentModelError("MODEL_FINISH_REASON_MISMATCH")
                    answer = message.get("content", "")
                    if not isinstance(answer, str) or not answer.strip():
                        raise AgentModelError("EMPTY_MODEL_ANSWER")
                    if _looks_like_plain_text_tool_call(answer):
                        raise AgentModelError("PLAIN_TEXT_TOOL_CALL_REJECTED")
                    result = AgentRunResult(run_id, answer.strip(), "COMPLETED", self.evidence_status, calls, None, 0, usage)
                    return self._finish(result, started)
                if len(calls) + len(requested) > self.max_tool_calls:
                    raise AgentModelError("TOOL_CALL_LIMIT")
                requested_ids = [call.call_id for call in requested]
                if len(set(requested_ids)) != len(requested_ids) or any(item.call_id in requested_ids for item in calls):
                    raise AgentModelError("DUPLICATE_TOOL_CALL")
                messages.append({"role": "assistant", "tool_calls": [self._wire_call(call) for call in requested]})
                for call in requested:
                    if any(item.call_id == call.call_id for item in calls):
                        raise AgentModelError("DUPLICATE_TOOL_CALL")
                    try:
                        payload = self.registry.invoke(call.name, call.arguments, scope)
                        scope.assert_active()
                    except AgentContractError as error:
                        calls.append(ToolCallRecord(call.call_id, call.name, "REJECTED", error.code))
                        raise
                    except Exception as error:  # noqa: BLE001 - 对外只保留稳定错误码
                        calls.append(ToolCallRecord(call.call_id, call.name, "FAILED", safe_exception_code(error)))
                        raise
                    calls.append(ToolCallRecord(call.call_id, call.name, "SUCCEEDED"))
                    messages.append({"role": "tool", "tool_call_id": call.call_id, "name": call.name, "content": json.dumps(payload, ensure_ascii=False)})
            raise AgentModelError("TOOL_CALL_LIMIT")
        except AgentContractError as error:
            evidence_status = "DEGRADED" if self.evidence_status == "REAL" else self.evidence_status
            result = AgentRunResult(run_id, "", "FAILED", evidence_status, calls, error.code, 0, usage)
            return self._finish(result, started)
        except AgentModelError as error:
            result = AgentRunResult(run_id, "", "FAILED", "DEGRADED" if self.evidence_status == "REAL" else self.evidence_status, calls, error.code, 0, usage)
            return self._finish(result, started)
        except Exception as error:  # noqa: BLE001 - 对外只保留安全错误类型
            code = safe_exception_code(error)
            evidence_status = "DEGRADED" if self.evidence_status == "REAL" else self.evidence_status
            result = AgentRunResult(run_id, "", "FAILED", evidence_status, calls, code, 0, usage)
            return self._finish(result, started)

    def run_stream(self, question: str, scope: AgentScope) -> AgentRunResult:
        run_id = uuid.uuid4().hex
        started = time.perf_counter()
        calls: list[ToolCallRecord] = []
        usage: dict[str, int] = {}
        messages: list[dict[str, Any]] = [{"role": "user", "content": question}]
        try:
            scope.assert_active()
            for step in range(self.max_tool_calls + 1):
                accumulator = ToolCallAccumulator()
                for chunk in self.model.stream(
                    messages=messages,
                    tools=self.registry.definitions(),
                    metadata=self._metadata(run_id, step),
                ):
                    accumulator.accept(chunk)
                scope.assert_active()
                answer, requested, stream_usage = accumulator.finish()
                usage = _merge_usage(usage, stream_usage)
                if not requested:
                    if not answer.strip():
                        raise AgentModelError("EMPTY_MODEL_ANSWER")
                    if _looks_like_plain_text_tool_call(answer):
                        raise AgentModelError("PLAIN_TEXT_TOOL_CALL_REJECTED")
                    return self._finish(AgentRunResult(run_id, answer.strip(), "COMPLETED", self.evidence_status, calls, None, 0, usage), started)
                if len(calls) + len(requested) > self.max_tool_calls:
                    raise AgentModelError("TOOL_CALL_LIMIT")
                requested_ids = [call.call_id for call in requested]
                if len(set(requested_ids)) != len(requested_ids) or any(item.call_id in requested_ids for item in calls):
                    raise AgentModelError("DUPLICATE_TOOL_CALL")
                messages.append({"role": "assistant", "tool_calls": [self._wire_call(call) for call in requested]})
                for call in requested:
                    if any(item.call_id == call.call_id for item in calls):
                        raise AgentModelError("DUPLICATE_TOOL_CALL")
                    try:
                        payload = self.registry.invoke(call.name, call.arguments, scope)
                        scope.assert_active()
                    except AgentContractError as error:
                        calls.append(ToolCallRecord(call.call_id, call.name, "REJECTED", error.code))
                        raise
                    except Exception as error:  # noqa: BLE001 - 对外只保留稳定错误码
                        calls.append(ToolCallRecord(call.call_id, call.name, "FAILED", safe_exception_code(error)))
                        raise
                    calls.append(ToolCallRecord(call.call_id, call.name, "SUCCEEDED"))
                    messages.append({"role": "tool", "tool_call_id": call.call_id, "name": call.name, "content": json.dumps(payload, ensure_ascii=False)})
            raise AgentModelError("TOOL_CALL_LIMIT")
        except AgentContractError as error:
            evidence_status = "DEGRADED" if self.evidence_status == "REAL" else self.evidence_status
            return self._finish(AgentRunResult(run_id, "", "FAILED", evidence_status, calls, error.code, 0, usage), started)
        except AgentModelError as error:
            return self._finish(AgentRunResult(run_id, "", "FAILED", "DEGRADED" if self.evidence_status == "REAL" else self.evidence_status, calls, error.code, 0, usage), started)
        except Exception as error:  # noqa: BLE001
            evidence_status = "DEGRADED" if self.evidence_status == "REAL" else self.evidence_status
            return self._finish(AgentRunResult(run_id, "", "FAILED", evidence_status, calls, safe_exception_code(error), 0, usage), started)

    @staticmethod
    def _wire_call(call: ToolCall) -> dict[str, Any]:
        return {"id": call.call_id, "type": "function", "function": {"name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False, separators=(",", ":"))}}

    def _metadata(self, run_id: str, step: int) -> dict[str, Any]:
        metadata: dict[str, Any] = {"runId": run_id}
        if step == 0 and self.first_tool_name:
            metadata["toolChoice"] = {
                "type": "function",
                "function": {"name": self.first_tool_name},
            }
        else:
            metadata["toolChoice"] = "auto"
        return metadata

    def _finish(self, result: AgentRunResult, started: float) -> AgentRunResult:
        result.duration_ms = round((time.perf_counter() - started) * 1000)
        logger.info(
            "agent_run_finished run_id=%s model=%s status=%s evidence_status=%s tool_calls=%d duration_ms=%d error_code=%s",
            result.run_id,
            self.model_name[:80],
            result.status,
            result.evidence_status,
            len(result.tool_calls),
            result.duration_ms,
            result.error_code or "",
        )
        return result
