"""OpenAI 兼容供应商的 Agent Tool Calling 适配器。

只用于 M1 独立验证。它不替换现有 Provider，也不记录请求正文、授权头或下游错误正文。
"""
from __future__ import annotations

import json
from typing import Any, Iterable, Mapping

import httpx

from .agent_runtime import AgentModelError
from .config import Settings
from .http_limits import bounded_json
from .observability import failure


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
        payload: dict[str, Any] = {
            "model": self.settings.llm_model,
            "messages": messages,
            "tools": tools,
            "tool_choice": tool_choice,
            "stream": stream,
            "max_completion_tokens": 1024,
        }
        # Spark 兼容接口有时不接受 JSON response_format；Tool Calling 本身由结构化字段验证。
        if not self.settings.llm_model.startswith("spark-"):
            payload["temperature"] = 0
        return payload

    def complete(self, *, messages: list[dict[str, Any]], tools: list[dict[str, Any]], metadata: dict[str, Any]) -> Mapping[str, Any]:
        self._validate()
        payload = self._payload(messages, tools, stream=False, tool_choice=metadata.get("toolChoice", "auto"))
        try:
            with httpx.Client(
                timeout=httpx.Timeout(30.0, read=self.settings.llm_timeout_seconds),
                follow_redirects=False,
                trust_env=False,
            ) as client:
                return bounded_json(
                    client,
                    "POST",
                    self.settings.llm_url + "/chat/completions",
                    limit=262_144,
                    headers={"Authorization": "Bearer " + self.settings.llm_key},
                    json=payload,
                )
        except httpx.HTTPStatusError as error:
            failure("agent.llm", error)
            status = error.response.status_code
            raise AgentModelError("UPSTREAM_429" if status == 429 else "UPSTREAM_5XX" if status >= 500 else "UPSTREAM_HTTP_ERROR") from None
        except (httpx.TimeoutException, TimeoutError):
            raise AgentModelError("UPSTREAM_TIMEOUT") from None
        except httpx.HTTPError:
            raise AgentModelError("UPSTREAM_CONNECTION") from None
        except (TypeError, ValueError, KeyError):
            raise AgentModelError("INVALID_MODEL_RESPONSE") from None

    def stream(self, *, messages: list[dict[str, Any]], tools: list[dict[str, Any]], metadata: dict[str, Any]) -> Iterable[Mapping[str, Any]]:
        self._validate()
        payload = self._payload(messages, tools, stream=True, tool_choice=metadata.get("toolChoice", "auto"))
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
                    for line in response.iter_lines():
                        if isinstance(line, bytes):
                            line = line.decode("utf-8", "replace")
                        if not line or line.startswith(":"):
                            continue
                        if not line.startswith("data:"):
                            continue
                        body = line[5:].strip()
                        if body == "[DONE]":
                            return
                        try:
                            chunk = json.loads(body)
                        except (TypeError, ValueError):
                            raise AgentModelError("INVALID_STREAM_CHUNK") from None
                        if isinstance(chunk, dict):
                            yield chunk
        except httpx.HTTPStatusError as error:
            failure("agent.llm.stream", error)
            status = error.response.status_code
            raise AgentModelError("UPSTREAM_429" if status == 429 else "UPSTREAM_5XX" if status >= 500 else "UPSTREAM_HTTP_ERROR") from None
        except (httpx.TimeoutException, TimeoutError):
            raise AgentModelError("UPSTREAM_TIMEOUT") from None
        except httpx.HTTPError:
            raise AgentModelError("UPSTREAM_CONNECTION") from None
