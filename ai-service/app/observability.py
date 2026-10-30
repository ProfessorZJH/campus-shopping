"""仅记录可公开的故障元数据，不记录异常正文、提示词、URL、密钥和业务内容。"""
from collections import Counter
from contextvars import ContextVar
from functools import wraps
import logging
import re
import threading
import time
import uuid

request_id = ContextVar("request_id", default="background")
logger = logging.getLogger("uvicorn.error")
counts = Counter()
lock = threading.Lock()


def failure(operation, error):
    status = getattr(getattr(error, "response", None), "status_code", None)
    with lock:
        counts[operation + ".failures"] += 1
    logger.warning("dependency_failed operation=%s request_id=%s exception_type=%s http_status=%s",
                   operation, request_id.get(), type(error).__name__, status)


def observed(operation):
    def decorate(function):
        @wraps(function)
        def call(*args, **kwargs):
            started = time.perf_counter()
            with lock:
                counts[operation + ".calls"] += 1
            try:
                return function(*args, **kwargs)
            except Exception as error:
                failure(operation, error)
                raise
            finally:
                elapsed = round((time.perf_counter() - started) * 1000)
                with lock:
                    counts[operation + ".duration_ms"] += elapsed
                logger.info("dependency_finished operation=%s request_id=%s duration_ms=%d",
                            operation, request_id.get(), elapsed)
        return call
    return decorate


def diagnostics():
    with lock:
        return dict(counts)


class RequestContext:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        supplied = dict(scope.get("headers", [])).get(b"x-request-id", b"").decode("ascii", errors="ignore")
        identifier = supplied if re.fullmatch(r"[A-Za-z0-9-]{16,64}", supplied) else uuid.uuid4().hex
        token = request_id.set(identifier)

        async def response(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + [(b"x-request-id", identifier.encode("ascii"))]
            await send(message)

        try:
            await self.app(scope, receive, response)
        finally:
            request_id.reset(token)
