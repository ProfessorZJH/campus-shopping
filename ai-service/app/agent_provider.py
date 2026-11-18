"""OpenAI 兼容供应商的 Agent Tool Calling 适配器。

只用于 M1 独立验证。它不替换现有 Provider，也不记录请求正文、授权头或下游错误正文。
"""
from __future__ import annotations

import json
import re
import time
from typing import Any, Iterable, Mapping

import httpx

from .agent_runtime import AgentModelError
from .config import Settings
from .egress import audit, minimized
from .http_limits import bounded_json
from .observability import counts, failure, lock


MAX_STREAM_LINE_BYTES = 65_536
MAX_STREAM_RESPONSE_BYTES = 4 * 1024 * 1024
_PII_PATTERN = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")


def _sanitize_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sanitized: list[dict[str, Any]] = []
    for item in messages:
        if not isinstance(item, dict):
            sanitized.append(item)
            continue
        copied = dict(item)
        role = copied.get("role")
        content = copied.get("content")
        if role == "user" and isinstance(content, str):
            copied["content"] = minimized(content, "question")
        elif isinstance(content, str):
            copied["content"] = _PII_PATTERN.sub("[已脱敏]", content)
        sanitized.append(copied)
    return sanitized


class OpenAICompatibleToolModel:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _validate(self) -> None:
        if not (self.settings.llm_url and self.settings.llm_key and self.settings.llm_model):
            raise AgentModelError("MODEL_NOT_CONFIGURED")

    def _payload(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        *,
        stream: bool,
        tool_choice: Any = "auto",
    ) -> dict[str, Any]:
        sanitized_messages = _sanitize_messages(messages)
        payload: dict[str, Any] = {
            "model": self.settings.llm_model,
            "messages": sanitized_messages,
            "tools": tools,
            "tool_choice": tool_choice,
            "stream": stream,
            "max_completion_tokens": 1024,
        }
        # Spark 兼容接口有时不接受 JSON response_format；Tool Calling 本身由结构化字段验证。
        if not self.settings.llm_model.startswith("spark-"):
            payload["temperature"] = 0
        audit(
            self.settings.llm_url,
            "agent.completion.stream" if stream else "agent.completion",
            len(sanitized_messages),
            payload,
        )
        return payload

    def complete(self, *, messages: list[dict[str, Any]], tools: list[dict[str, Any]], metadata: dict[str, Any]) -> Mapping[str, Any]:
        self._validate()
        payload = self._payload(messages, tools, stream=False, tool_choice=metadata.get("toolChoice", "auto"))
        with lock:
            counts["agent.llm.calls"] += 1
            counts["llm.calls"] += 1
        try:
            with httpx.Client(
                timeout=httpx.Timeout(30.0, read=self.settings.llm_timeout_seconds),
                follow_redirects=False,
                trust_env=False,
            ) as client:
                result = bounded_json(
                    client,
                    "POST",
                    self.settings.llm_url + "/chat/completions",
                    limit=262_144,
                    headers={"Authorization": "Bearer " + self.settings.llm_key},
                    json=payload,
                )
                now = time.time()
                with lock:
                    counts["agent.llm.last_success_at"] = now
                    counts["llm.last_success_at"] = now
                return result
        except httpx.HTTPStatusError as error:
            failure("agent.llm", error)
            failure("llm", error)
            status = error.response.status_code
            raise AgentModelError("UPSTREAM_429" if status == 429 else "UPSTREAM_5XX" if status >= 500 else "UPSTREAM_HTTP_ERROR") from None
        except (httpx.TimeoutException, TimeoutError) as error:
            failure("agent.llm", error)
            failure("llm", error)
            raise AgentModelError("UPSTREAM_TIMEOUT") from None
        except httpx.HTTPError as error:
            failure("agent.llm", error)
            failure("llm", error)
            raise AgentModelError("UPSTREAM_CONNECTION") from None
        except (TypeError, ValueError, KeyError) as error:
            failure("agent.llm", error)
            failure("llm", error)
            raise AgentModelError("INVALID_MODEL_RESPONSE") from None

    def stream(self, *, messages: list[dict[str, Any]], tools: list[dict[str, Any]], metadata: dict[str, Any]) -> Iterable[Mapping[str, Any]]:
        self._validate()
        payload = self._payload(messages, tools, stream=True, tool_choice=metadata.get("toolChoice", "auto"))
        with lock:
            counts["agent.llm.stream.calls"] += 1
            counts["llm.calls"] += 1
        try:
            with httpx.Client(
                timeout=httpx.Timeout(30.0, read=self.settings.llm_timeout_seconds),
                follow_redirects=False,
                trust_env=False,
            ) as client:
                with client.stream(
                    "POST",
                    self.settings.llm_url + "/chat/completions",
                    headers={"Authorization": "Bearer " + self.settings.llm_key},
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    total_bytes = 0
                    saw_done = False
                    event_id: str | None = None
                    for line in response.iter_lines():
                        if isinstance(line, bytes):
                            line = line.decode("utf-8", "replace")
                        line_bytes = len(line.encode("utf-8"))
                        if line_bytes > MAX_STREAM_LINE_BYTES:
                            raise AgentModelError("STREAM_LINE_TOO_LARGE")
                        total_bytes += line_bytes
                        if total_bytes > MAX_STREAM_RESPONSE_BYTES:
                            raise AgentModelError("STREAM_RESPONSE_TOO_LARGE")
                        if not line or line.startswith(":"):
                            continue
                        if line.startswith("id:"):
                            event_id = line[3:].strip()
                            continue
                        if not line.startswith("data:"):
                            continue
                        body = line[5:].strip()
                        if body == "[DONE]":
                            saw_done = True
                            now = time.time()
                            with lock:
                                counts["agent.llm.stream.last_success_at"] = now
                                counts["llm.last_success_at"] = now
                            return
                        try:
                            chunk = json.loads(body)
                        except (TypeError, ValueError):
                            raise AgentModelError("INVALID_STREAM_CHUNK") from None
                        if not isinstance(chunk, Mapping):
                            raise AgentModelError("INVALID_STREAM_CHUNK")
                        if event_id is not None:
                            chunk["_event_id"] = event_id
                            event_id = None
                        yield chunk
                    if not saw_done:
                        raise AgentModelError("STREAM_NOT_TERMINATED")
        except AgentModelError as error:
            failure("agent.llm.stream", error)
            failure("llm", error)
            raise
        except httpx.HTTPStatusError as error:
            failure("agent.llm.stream", error)
            failure("llm", error)
            status = error.response.status_code
            raise AgentModelError("UPSTREAM_429" if status == 429 else "UPSTREAM_5XX" if status >= 500 else "UPSTREAM_HTTP_ERROR") from None
        except (httpx.TimeoutException, TimeoutError) as error:
            failure("agent.llm.stream", error)
            failure("llm", error)
            raise AgentModelError("UPSTREAM_TIMEOUT") from None
        except httpx.HTTPError as error:
            failure("agent.llm.stream", error)
            failure("llm", error)
            raise AgentModelError("UPSTREAM_CONNECTION") from None
