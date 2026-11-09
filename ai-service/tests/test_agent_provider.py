"""OpenAI 兼容 Tool Calling 适配器的协议测试；网络请求全部使用显式 MockTransport。"""
from __future__ import annotations

import json

import httpx
import pytest

from app.agent_provider import OpenAICompatibleToolModel
from app.agent_runtime import AgentModelError
from app.config import Settings


KEY = "agent-provider-test-key-not-production"


def settings(tmp_path, **kwargs):
    return Settings(
        api_key=KEY,
        db_path=str(tmp_path / "agent.db"),
        llm_url="https://llm.test/v1",
        llm_key="agent-llm-key",
        llm_model="test-tool-model",
        **kwargs,
    )


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "read-only",
            "parameters": {"type": "object", "properties": {"query": {"type": "string"}}},
        },
    }
]


def test_complete_sends_native_tools_and_parses_raw_response(tmp_path, monkeypatch):
    sent = []

    def handler(request):
        sent.append((request.url, dict(request.headers), json.loads(request.content)))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {"name": "search_products", "arguments": '{"query":"茶"}'},
                                }
                            ],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 4, "completion_tokens": 3, "total_tokens": 7},
            },
        )

    original = httpx.Client
    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    model = OpenAICompatibleToolModel(settings(tmp_path))
    response = model.complete(messages=[{"role": "user", "content": "找茶"}], tools=TOOLS, metadata={"runId": "run-1"})
    assert response["choices"][0]["message"]["tool_calls"][0]["function"]["name"] == "search_products"
    assert sent[0][0].path == "/v1/chat/completions"
    assert sent[0][1]["authorization"] == "Bearer agent-llm-key"
    assert sent[0][2]["tools"] == TOOLS
    assert sent[0][2]["stream"] is False
    assert "agent-llm-key" not in json.dumps(response)


def test_complete_maps_429_without_exposing_response_body(tmp_path, monkeypatch):
    def handler(request):
        return httpx.Response(429, text="secret provider response")

    original = httpx.Client
    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    model = OpenAICompatibleToolModel(settings(tmp_path))
    with pytest.raises(AgentModelError, match="UPSTREAM_429"):
        model.complete(messages=[], tools=TOOLS, metadata={})


def test_complete_maps_5xx_without_exposing_response_body(tmp_path, monkeypatch):
    def handler(request):
        return httpx.Response(503, text="secret provider failure")

    original = httpx.Client
    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    model = OpenAICompatibleToolModel(settings(tmp_path))
    with pytest.raises(AgentModelError, match="UPSTREAM_5XX"):
        model.complete(messages=[], tools=TOOLS, metadata={})


def test_stream_yields_native_tool_call_chunks(tmp_path, monkeypatch):
    body = "\n".join(
        [
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"search_products","arguments":"{\\"query\\":"}}]}}]}',
            'id: event-2',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"茶\\"}"}}]},"finish_reason":"tool_calls"}]}',
            "data: [DONE]",
            "",
        ]
    )

    def handler(request):
        return httpx.Response(200, content=body.encode("utf-8"), headers={"content-type": "text/event-stream"})

    original = httpx.Client
    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    model = OpenAICompatibleToolModel(settings(tmp_path))
    chunks = list(model.stream(messages=[], tools=TOOLS, metadata={}))
    assert chunks[0]["choices"][0]["delta"]["tool_calls"][0]["function"]["name"] == "search_products"
    assert chunks[1]["choices"][0]["finish_reason"] == "tool_calls"
    assert chunks[1]["_event_id"] == "event-2"


def test_stream_rejects_invalid_chunk_and_maps_transport_timeout(tmp_path, monkeypatch):
    original = httpx.Client

    def bad_chunk(request):
        return httpx.Response(200, content=b"data: not-json\n\n")

    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(bad_chunk), **kwargs))
    model = OpenAICompatibleToolModel(settings(tmp_path))
    with pytest.raises(AgentModelError, match="INVALID_STREAM_CHUNK"):
        list(model.stream(messages=[], tools=TOOLS, metadata={}))

    def non_object(request):
        return httpx.Response(200, content=b"data: []\n\ndata: [DONE]\n")

    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(non_object), **kwargs))
    with pytest.raises(AgentModelError, match="INVALID_STREAM_CHUNK"):
        list(model.stream(messages=[], tools=TOOLS, metadata={}))

    def timeout(request):
        raise httpx.ReadTimeout("provider timed out", request=request)

    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(timeout), **kwargs))
    with pytest.raises(AgentModelError, match="UPSTREAM_TIMEOUT"):
        list(model.stream(messages=[], tools=TOOLS, metadata={}))


def test_stream_requires_done_marker_and_bounds_response_size(tmp_path, monkeypatch):
    original = httpx.Client

    def missing_done(request):
        return httpx.Response(200, content=b'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n')

    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(missing_done), **kwargs))
    model = OpenAICompatibleToolModel(settings(tmp_path))
    with pytest.raises(AgentModelError, match="STREAM_NOT_TERMINATED"):
        list(model.stream(messages=[], tools=TOOLS, metadata={}))

    def oversized_line(request):
        line = "data: " + ("x" * 70_000)
        return httpx.Response(200, content=(line + "\n\ndata: [DONE]\n").encode("utf-8"))

    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(oversized_line), **kwargs))
    with pytest.raises(AgentModelError, match="STREAM_LINE_TOO_LARGE"):
        list(model.stream(messages=[], tools=TOOLS, metadata={}))

    def oversized_response(request):
        body = ('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n' * 3) + "data: [DONE]\n"
        return httpx.Response(200, content=body.encode("utf-8"))

    monkeypatch.setattr("app.agent_provider.MAX_STREAM_RESPONSE_BYTES", 64)
    monkeypatch.setattr("app.agent_provider.httpx.Client", lambda **kwargs: original(transport=httpx.MockTransport(oversized_response), **kwargs))
    with pytest.raises(AgentModelError, match="STREAM_RESPONSE_TOO_LARGE"):
        list(model.stream(messages=[], tools=TOOLS, metadata={}))
