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
        counts[operation + ".last_failure_at"] = time.time()
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
                result = function(*args, **kwargs)
                with lock:
                    counts[operation + ".last_success_at"] = time.time()
                return result
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


class ExecutionGate:
    """不排队；在实际执行结束前计入占用。拒绝数反映容量压力。"""
    def __init__(self, capacity):
        self.semaphore = threading.BoundedSemaphore(capacity)
        self.lock = threading.Lock()
        self.capacity, self.active, self.rejected = capacity, 0, 0

    def acquire(self, blocking=False):
        acquired = self.semaphore.acquire(blocking=blocking)
        with self.lock:
            if acquired:
                self.active += 1
            else:
                self.rejected += 1
        return acquired

    def release(self):
        with self.lock:
            self.active -= 1
        self.semaphore.release()

    def snapshot(self):
        with self.lock:
            return {'capacity': self.capacity, 'active': self.active, 'queued': 0, 'rejected': self.rejected}


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
