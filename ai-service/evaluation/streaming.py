"""真实 FastAPI /v1/query/stream SSE 逐帧首 Token、事件顺序、最终答案一致性与增量安全独立测量器。"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx

from app.main import create_app
from app.retrieval import bm25
from .provenance import RecordedProvider

KNOWN_SSE_EVENTS = frozenset({"started", "progress", "delta", "completed", "failed", "cancelled"})
TERMINAL_SSE_EVENTS = frozenset({"completed", "failed", "cancelled"})


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


def _audit_sse_protocol(
    *,
    http_status: int,
    event_sequence: list[str],
    protocol_errors: list[str],
    deltas: list[str],
    non_completed_texts: list[str],
    completed_payload: dict[str, Any] | None,
    stream_text_enabled: bool,
) -> dict[str, Any]:
    """核验 SSE 事件状态机顺序、正常终止及流式 delta 全文与最终回答逐字一致性。"""
    errors = list(protocol_errors)
    if http_status != 200:
        errors.append(f"HTTP_STATUS_{http_status}")
    if not event_sequence:
        errors.append("EMPTY_EVENT_STREAM")
    else:
        if event_sequence[0] != "started":
            errors.append("FIRST_EVENT_NOT_STARTED")
        if event_sequence.count("started") != 1:
            errors.append("MULTIPLE_OR_MISSING_STARTED")
        seen_delta = False
        terminal_indices = [idx for idx, ev in enumerate(event_sequence) if ev in TERMINAL_SSE_EVENTS]
        if len(terminal_indices) == 0:
            errors.append("MISSING_TERMINAL_EVENT")
        elif len(terminal_indices) > 1:
            errors.append("MULTIPLE_TERMINAL_EVENTS")
        elif terminal_indices[0] != len(event_sequence) - 1:
            errors.append("TRAILING_EVENT_AFTER_TERMINAL")
        for idx, ev in enumerate(event_sequence):
            if ev not in KNOWN_SSE_EVENTS:
                errors.append(f"UNKNOWN_EVENT:{ev}")
            if ev == "delta":
                seen_delta = True
            elif ev == "progress" and seen_delta:
                errors.append("PROGRESS_AFTER_DELTA")
            if idx > 0 and ev == "started":
                errors.append("STARTED_OUT_OF_ORDER")

    terminal_event = next((ev for ev in reversed(event_sequence) if ev in TERMINAL_SSE_EVENTS), None)
    event_order_valid = not any(
        e in errors
        for e in (
            "FIRST_EVENT_NOT_STARTED",
            "MULTIPLE_OR_MISSING_STARTED",
            "MULTIPLE_TERMINAL_EVENTS",
            "TRAILING_EVENT_AFTER_TERMINAL",
            "PROGRESS_AFTER_DELTA",
            "STARTED_OUT_OF_ORDER",
        )
    ) and not any(e.startswith(("UNKNOWN_EVENT:", "INVALID_EVENT_JSON:", "INVALID_PROGRESS", "INVALID_DELTA")) for e in errors)
    if not event_sequence or http_status != 200:
        event_order_valid = False

    clean_termination = (
        http_status == 200
        and bool(event_sequence)
        and "MISSING_TERMINAL_EVENT" not in errors
        and "MULTIPLE_TERMINAL_EVENTS" not in errors
        and "TRAILING_EVENT_AFTER_TERMINAL" not in errors
        and "UNTERMINATED_PARTIAL_FRAME" not in errors
        and terminal_event == "completed"
        and isinstance(completed_payload, dict)
    )

    streamed_text = "".join(deltas)
    answer_consistent = False
    if clean_termination and isinstance(completed_payload, dict):
        final_answer = completed_payload.get("answer", "")
        if isinstance(final_answer, str):
            if stream_text_enabled:
                has_expected_deltas = (len(deltas) >= 1) if len(final_answer) > 0 else (len(deltas) == 0)
                answer_consistent = has_expected_deltas and (streamed_text == final_answer)
                if not answer_consistent:
                    errors.append("DELTA_FINAL_ANSWER_MISMATCH")
            else:
                answer_consistent = len(deltas) == 0
                if not answer_consistent:
                    errors.append("UNEXPECTED_DELTA_WHEN_STREAM_TEXT_DISABLED")

    return {
        "httpStatus": http_status,
        "eventSequence": event_sequence,
        "terminalEvent": terminal_event,
        "cleanTermination": clean_termination,
        "eventOrderValid": event_order_valid,
        "answerConsistent": answer_consistent,
        "protocolErrors": errors,
        "streamedText": streamed_text,
        "nonCompletedFrameTexts": non_completed_texts,
    }


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
    event_sequence: list[str] = []
    protocol_errors: list[str] = []
    non_completed_texts: list[str] = []
    exposed_non_citation_frames: list[str] = []
    exposed_all_frames: list[str] = []
    completed_citations: list[dict[str, Any]] = []
    stream_text_enabled = bool(payload.get("streamText", True))

    def handle_event(ev_name: str, data_lines: list[str], elapsed_ms: float) -> None:
        nonlocal started_ms, first_progress_ms, first_delta_ms, completed_ms, failed_ms
        nonlocal delta_count, progress_count, stream_mode, completed_payload, failed_payload
        event_sequence.append(ev_name)
        raw_joined = "\n".join(data_lines)
        if raw_joined and ev_name != "completed":
            non_completed_texts.append(raw_joined)
            exposed_non_citation_frames.append(raw_joined)
            exposed_all_frames.append(raw_joined)
        try:
            parsed = json.loads(raw_joined) if data_lines else {}
        except json.JSONDecodeError:
            protocol_errors.append(f"INVALID_EVENT_JSON:{ev_name}")
            if raw_joined and ev_name == "completed":
                exposed_non_citation_frames.append(raw_joined)
                exposed_all_frames.append(raw_joined)
            return
        if not isinstance(parsed, dict):
            protocol_errors.append(f"INVALID_EVENT_JSON:{ev_name}")
            decoded_any = json.dumps(parsed, ensure_ascii=False)
            exposed_all_frames.append(decoded_any)
            exposed_non_citation_frames.append(decoded_any)
            return
        if ev_name == "completed":
            # 与非流式 evidence_metrics 一致：排除回显用户自身提问词面的 rewrittenQuery，其余全部字段纳入扫描。
            all_without_rq = {k: v for k, v in parsed.items() if k != "rewrittenQuery"}
            non_cit_subset = {k: v for k, v in parsed.items() if k not in ("rewrittenQuery", "citations")}
            exposed_all_frames.append(json.dumps(all_without_rq, ensure_ascii=False))
            exposed_non_citation_frames.append(json.dumps(non_cit_subset, ensure_ascii=False))
            cits = parsed.get("citations")
            if isinstance(cits, list):
                completed_citations.extend(c for c in cits if isinstance(c, dict))
        else:
            decoded_str = json.dumps(parsed, ensure_ascii=False)
            exposed_all_frames.append(decoded_str)
            exposed_non_citation_frames.append(decoded_str)
        if ev_name == "started":
            if started_ms is None:
                started_ms = elapsed_ms
            mode_val = parsed.get("mode")
            if not isinstance(mode_val, str) or not mode_val:
                protocol_errors.append("INVALID_STARTED_MODE")
            stream_mode = mode_val
        elif ev_name == "progress":
            progress_count += 1
            if first_progress_ms is None:
                first_progress_ms = elapsed_ms
            b_val = parsed.get("bytes")
            if isinstance(b_val, bool) or not isinstance(b_val, int) or b_val < 0:
                protocol_errors.append("INVALID_PROGRESS_BYTES")
        elif ev_name == "delta":
            delta_count += 1
            if first_delta_ms is None:
                first_delta_ms = elapsed_ms
            txt = parsed.get("text")
            if not isinstance(txt, str) or txt == "":
                protocol_errors.append("INVALID_DELTA_TEXT")
            else:
                deltas.append(txt)
        elif ev_name == "completed":
            completed_ms = elapsed_ms
            completed_payload = parsed
        elif ev_name in ("failed", "cancelled"):
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
                raw_err = (await resp.aread()).decode("utf-8", errors="replace")
                if raw_err:
                    non_completed_texts.append(raw_err)
                    exposed_non_citation_frames.append(raw_err)
                    exposed_all_frames.append(raw_err)
                audit = _audit_sse_protocol(
                    http_status=resp.status_code,
                    event_sequence=[],
                    protocol_errors=[],
                    deltas=[],
                    non_completed_texts=non_completed_texts,
                    completed_payload=None,
                    stream_text_enabled=stream_text_enabled,
                )
                audit["exposedNonCitationFrames"] = exposed_non_citation_frames
                audit["exposedAllFrames"] = exposed_all_frames
                audit["completedCitations"] = completed_citations
                return {
                    "httpStatus": resp.status_code,
                    "elapsedMs": (time.perf_counter() - t0) * 1000.0,
                    "completedPayload": None,
                    "failedPayload": {"errorCode": f"HTTP_{resp.status_code}"},
                    "streamTiming": None,
                    "streamAudit": audit,
                }
            current_event: str | None = None
            data_lines: list[str] = []
            try:
                async for line in resp.aiter_lines():
                    if line.startswith("event:"):
                        if data_lines and current_event is None:
                            handle_event("message", data_lines, (time.perf_counter() - t0) * 1000.0)
                            data_lines = []
                        current_event = line[6:].strip()
                    elif line.startswith("data:"):
                        data_lines.append(line[5:].strip())
                    elif line.startswith(":"):
                        comment = line[1:].strip()
                        if comment:
                            exposed_non_citation_frames.append(comment)
                            exposed_all_frames.append(comment)
                    elif line == "":
                        if current_event is not None or data_lines:
                            handle_event(current_event or "message", data_lines, (time.perf_counter() - t0) * 1000.0)
                            current_event = None
                            data_lines = []
                if current_event is not None or data_lines:
                    protocol_errors.append("UNTERMINATED_PARTIAL_FRAME")
                    handle_event(current_event or "message", data_lines, (time.perf_counter() - t0) * 1000.0)
            except BaseException as exc:
                protocol_errors.append(f"STREAM_READ_ERROR:{type(exc).__name__}")

    total_ms = completed_ms if completed_ms is not None else (failed_ms if failed_ms is not None else (time.perf_counter() - t0) * 1000.0)
    audit = _audit_sse_protocol(
        http_status=200,
        event_sequence=event_sequence,
        protocol_errors=protocol_errors,
        deltas=deltas,
        non_completed_texts=non_completed_texts,
        completed_payload=completed_payload,
        stream_text_enabled=stream_text_enabled,
    )
    audit["exposedNonCitationFrames"] = exposed_non_citation_frames
    audit["exposedAllFrames"] = exposed_all_frames
    audit["completedCitations"] = completed_citations
    return {
        "httpStatus": 200,
        "elapsedMs": total_ms,
        "completedPayload": completed_payload,
        "failedPayload": failed_payload,
        "streamedText": audit["streamedText"],
        "streamAudit": audit,
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

    def __init__(self, settings, recorder, data: dict[str, Any], *, app_override=None):
        self.settings = settings
        self.recorder = recorder
        self.data = data
        self.owns_store = app_override is None
        if app_override is not None:
            self.app = app_override
        else:
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
        audit = measured["streamAudit"]
        if failed_payload is not None or completed_payload is None or not audit["cleanTermination"]:
            reason = (
                (failed_payload or {}).get("errorCode")
                or (audit["protocolErrors"][0] if audit["protocolErrors"] else "STREAM_INCOMPLETE")
            )
            # 即使流异常终止，也必须完整保留 streamAudit（含已输出的 delta 全文），用于检测中途泄漏！
            return {
                "status": "FAILED",
                "reason": reason,
                "latencyMs": measured["elapsedMs"],
                "streamTiming": measured["streamTiming"],
                "streamAudit": audit,
                "result": completed_payload or {},
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
            "streamAudit": audit,
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
        elif audit["protocolErrors"]:
            row_patch["reason"] = ",".join(audit["protocolErrors"])
        return row_patch

    def close(self) -> None:
        if self.owns_store and hasattr(self.app, "state") and hasattr(self.app.state, "store"):
            self.app.state.store.close()
