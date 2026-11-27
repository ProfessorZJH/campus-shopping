"""真实 FastAPI /v1/query/stream SSE 逐帧首 Token 与阶段耗时独立测量器。"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx

from app.main import create_app
from app.retrieval import bm25
from .provenance import RecordedProvider


class _LiveASGIStream(httpx.AsyncByteStream):
    def __init__(self, body_queue: asyncio.Queue[bytes | None], app_task: asyncio.Task[Any], disconnected: asyncio.Event):
        self._queue = body_queue
        self._task = app_task
        self._disconnected = disconnected

    async def __aiter__(self):
        while True:
            chunk = await self._queue.get()
            if chunk is None:
                break
            yield chunk

    async def aclose(self) -> None:
        self._disconnected.set()
        if not self._task.done():
            await asyncio.gather(self._task, return_exceptions=True)


class _LiveASGITransport(httpx.AsyncBaseTransport):
    """在收到 http.response.start 时立即返回流式 Response，避免内置 ASGITransport 缓冲整段流。"""

    def __init__(self, app):
        self.app = app

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        req_body = await request.aread()
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": request.method,
            "headers": [(k.lower(), v) for (k, v) in request.headers.raw],
            "scheme": request.url.scheme,
            "path": request.url.path,
            "raw_path": request.url.raw_path.split(b"?")[0],
            "query_string": request.url.query,
            "server": (request.url.host, request.url.port or 80),
            "client": ("127.0.0.1", 12345),
            "root_path": "",
        }
        request_sent = False
        started = asyncio.Event()
        response_done = asyncio.Event()
        disconnected = asyncio.Event()
        body_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        status_code: int | None = None
        response_headers: list[tuple[bytes, bytes]] = []
        start_error: BaseException | None = None

        async def receive() -> dict[str, Any]:
            nonlocal request_sent
            if not request_sent:
                request_sent = True
                return {"type": "http.request", "body": req_body, "more_body": False}
            done_wait = asyncio.create_task(response_done.wait())
            disc_wait = asyncio.create_task(disconnected.wait())
            await asyncio.wait({done_wait, disc_wait}, return_when=asyncio.FIRST_COMPLETED)
            for pending in (done_wait, disc_wait):
                if not pending.done():
                    pending.cancel()
            return {"type": "http.disconnect"}

        async def send(message: dict[str, Any]) -> None:
            nonlocal status_code, response_headers
            msg_type = message["type"]
            if msg_type == "http.response.start":
                status_code = message["status"]
                response_headers = list(message.get("headers", []))
                started.set()
            elif msg_type == "http.response.body":
                body = message.get("body", b"")
                more_body = message.get("more_body", False)
                if body and request.method != "HEAD":
                    body_queue.put_nowait(body)
                if not more_body:
                    response_done.set()
                    body_queue.put_nowait(None)

        async def run_app() -> None:
            nonlocal start_error, status_code
            try:
                await self.app(scope, receive, send)
            except BaseException as exc:
                if not started.is_set():
                    start_error = exc
                    started.set()
            finally:
                response_done.set()
                body_queue.put_nowait(None)

        app_task = asyncio.create_task(run_app())
        await started.wait()
        if start_error is not None:
            await asyncio.gather(app_task, return_exceptions=True)
            raise start_error
        return httpx.Response(
            status_code or 500,
            headers=response_headers,
            stream=_LiveASGIStream(body_queue, app_task, disconnected),
        )


def _stream_offers_for(data: dict[str, Any], case: dict[str, Any]) -> list[dict[str, Any]]:
    from .runner import offers_for

    raw = offers_for(data, case)
    if len(raw) > 300:
        docs = [o["title"] + " " + o["specKey"] + " " + o.get("description", "") for o in raw]
        ranked_indices = [idx for idx, _ in bm25(case["originalQuery"], docs)]
        seen = set(ranked_indices)
        ordered = ranked_indices + [i for i in range(len(raw)) if i not in seen]
        raw = [raw[i] for i in ordered[:300]]
    return [
        {
            "skuId": o["skuId"],
            "merchantId": o["merchantId"],
            "title": o["title"],
            "specKey": o["specKey"],
            "description": o.get("description", ""),
            "attributes": {str(k): str(v) for k, v in (o.get("attributes") or {}).items()},
            "priceCent": o["priceCent"],
            "available": o["available"],
        }
        for o in raw
    ]


async def _measure_stream_once(app, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    transport = _LiveASGITransport(app)
    t0 = time.perf_counter()
    started_ms: float | None = None
    first_progress_ms: float | None = None
    first_delta_ms: float | None = None
    completed_ms: float | None = None
    failed_ms: float | None = None
    delta_count = 0
    progress_count = 0
    stream_mode: str | None = None
    completed_payload: dict[str, Any] | None = None
    failed_payload: dict[str, Any] | None = None
    deltas: list[str] = []

    def handle_event(ev_name: str, data_lines: list[str], elapsed_ms: float) -> None:
        nonlocal started_ms, first_progress_ms, first_delta_ms, completed_ms, failed_ms
        nonlocal delta_count, progress_count, stream_mode, completed_payload, failed_payload
        parsed = json.loads("\n".join(data_lines)) if data_lines else {}
        if ev_name == "started":
            if started_ms is None:
                started_ms = elapsed_ms
            stream_mode = parsed.get("mode")
        elif ev_name == "progress":
            progress_count += 1
            if first_progress_ms is None:
                first_progress_ms = elapsed_ms
        elif ev_name == "delta":
            delta_count += 1
            if first_delta_ms is None:
                first_delta_ms = elapsed_ms
            if isinstance(parsed.get("text"), str):
                deltas.append(parsed["text"])
        elif ev_name == "completed":
            completed_ms = elapsed_ms
            completed_payload = parsed
        elif ev_name == "failed":
            failed_ms = elapsed_ms
            failed_payload = parsed

    async with httpx.AsyncClient(transport=transport, base_url="http://eval-stream.local") as client:
        async with client.stream(
            "POST",
            "/v1/query/stream",
            headers={"X-Service-Key": api_key},
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                await resp.aread()
                return {
                    "httpStatus": resp.status_code,
                    "elapsedMs": (time.perf_counter() - t0) * 1000.0,
                    "completedPayload": None,
                    "failedPayload": {"errorCode": f"HTTP_{resp.status_code}"},
                    "streamTiming": None,
                }
            current_event: str | None = None
            data_lines: list[str] = []
            async for line in resp.aiter_lines():
                if line.startswith("event:"):
                    current_event = line[6:].strip()
                elif line.startswith("data:"):
                    data_lines.append(line[5:].strip())
                elif line == "":
                    if current_event is not None:
                        handle_event(current_event, data_lines, (time.perf_counter() - t0) * 1000.0)
                        current_event = None
                        data_lines = []
            if current_event is not None:
                handle_event(current_event, data_lines, (time.perf_counter() - t0) * 1000.0)

    total_ms = completed_ms if completed_ms is not None else (failed_ms if failed_ms is not None else (time.perf_counter() - t0) * 1000.0)
    return {
        "httpStatus": 200,
        "elapsedMs": total_ms,
        "completedPayload": completed_payload,
        "failedPayload": failed_payload,
        "streamedText": "".join(deltas),
        "streamTiming": {
            "startedMs": started_ms,
            "firstProgressMs": first_progress_ms,
            "firstDeltaMs": first_delta_ms,
            "completedMs": completed_ms,
            "deltaCount": delta_count,
            "progressCount": progress_count,
            "streamMode": stream_mode,
        },
    }


class StreamingBenchmarkSession:
    """复用同一隔离临时知识库的真实 FastAPI 流式评测会话。"""

    def __init__(self, settings, recorder, data: dict[str, Any]):
        self.settings = settings
        self.recorder = recorder
        self.data = data
        self.app = create_app(settings)
        self.app.state.store.provider = RecordedProvider(self.app.state.store.provider, recorder)

    def _build_payload(self, case: dict[str, Any], doc_visibility: dict[str, str]) -> dict[str, Any]:
        public_allowed = [did for did in case["allowedDocumentIds"] if doc_visibility.get(did) == "PUBLIC"]
        history = [{"role": h["role"], "content": h["content"]} for h in case.get("conversationContext", [])[-12:]]
        return {
            "question": case["originalQuery"],
            "allowedDocumentIds": list(case["allowedDocumentIds"])[:1000],
            "externalDocumentIds": public_allowed[:1000],
            "offers": _stream_offers_for(self.data, case),
            "history": history,
            "answerPreview": True,
            "streamText": True,
        }

    def warmup(self, case: dict[str, Any], doc_visibility: dict[str, str], *, count: int = 2) -> None:
        payload = self._build_payload(case, doc_visibility)
        for _ in range(count):
            asyncio.run(_measure_stream_once(self.app, self.settings.api_key, payload))

    def measure_case(self, case: dict[str, Any], doc_visibility: dict[str, str], *, start_event: int) -> dict[str, Any]:
        payload = self._build_payload(case, doc_visibility)
        measured = asyncio.run(_measure_stream_once(self.app, self.settings.api_key, payload))
        completed_payload = measured["completedPayload"]
        failed_payload = measured["failedPayload"]
        if failed_payload is not None or completed_payload is None:
            reason = (failed_payload or {}).get("errorCode") or "STREAM_INCOMPLETE"
            return {
                "status": "FAILED",
                "reason": reason,
                "latencyMs": measured["elapsedMs"],
                "result": {},
                "stages": {},
            }
        self.recorder.event("knowledgeVector", "SQLITE", "SUCCESS", "search")
        returned_mode = completed_payload.get("mode", "")
        failures = any(e["outcome"] != "SUCCESS" for e in self.recorder.events[start_event:])
        degraded = failures or "DEGRADED" in returned_mode or returned_mode == "LOCAL_FALLBACK"
        status = "DEGRADED" if degraded else "EXECUTED"
        row_patch: dict[str, Any] = {
            "status": status,
            "latencyMs": measured["streamTiming"]["completedMs"],
            "streamTiming": measured["streamTiming"],
            "result": completed_payload,
            "returnedMode": returned_mode,
            "stages": {
                "recommendations": [
                    rec["skuId"] for rec in completed_payload.get("recommendations", []) if isinstance(rec, dict) and "skuId" in rec
                ]
            },
        }
        if degraded:
            row_patch["reason"] = "PROVIDER_DEGRADED"
        return row_patch

    def close(self) -> None:
        self.app.state.store.close()
