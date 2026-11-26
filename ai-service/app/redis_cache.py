"""零外部依赖的 RESP2 Redis 缓存客户端，内置 512 项线程安全 LRU 内存降级。

安全约束：只做只读/缓存加速，任何连接或协议故障必须 fail-open，绝不在日志或异常中暴露凭据。
"""
from __future__ import annotations

from collections import OrderedDict
import json
import socket
import ssl
import threading
import time
from typing import Any
from urllib.parse import unquote, urlsplit


class _RespError(Exception):
    """RESP2 服务端返回错误响应。"""


def _encode_command(*parts: str | bytes) -> bytes:
    chunks = [f"*{len(parts)}\r\n".encode("ascii")]
    for part in parts:
        raw = part if isinstance(part, bytes) else str(part).encode("utf-8")
        chunks.append(f"${len(raw)}\r\n".encode("ascii"))
        chunks.append(raw)
        chunks.append(b"\r\n")
    return b"".join(chunks)


def _read_line(reader) -> bytes:
    line = reader.readline()
    if not line or not line.endswith(b"\r\n"):
        raise ConnectionError("RESP2 EOF")
    return line[:-2]


def _read_exact(reader, size: int) -> bytes:
    buf = bytearray()
    while len(buf) < size:
        piece = reader.read(size - len(buf))
        if not piece:
            raise ConnectionError("RESP2 unexpected EOF")
        buf.extend(piece)
    return bytes(buf)


def _read_reply(reader):
    prefix = reader.read(1)
    if not prefix:
        raise ConnectionError("RESP2 EOF")
    if prefix == b"+":
        return _read_line(reader).decode("utf-8", errors="replace")
    if prefix == b"-":
        _read_line(reader)
        raise _RespError("RESP2 server error")
    if prefix == b":":
        return int(_read_line(reader))
    if prefix == b"$":
        length = int(_read_line(reader))
        if length < 0:
            return None
        payload = _read_exact(reader, length)
        if _read_exact(reader, 2) != b"\r\n":
            raise ConnectionError("RESP2 malformed bulk string")
        return payload
    if prefix == b"*":
        count = int(_read_line(reader))
        if count < 0:
            return None
        return [_read_reply(reader) for _ in range(count)]
    raise ConnectionError("RESP2 unknown reply prefix")


class RedisCache:
    """最小 stdlib socket RESP2 客户端；连接异常时自动 fail-open 并回退至有界内存 LRU。"""

    def __init__(
        self,
        url: str = "",
        password: str = "",
        namespace: str = "cs:dev",
        *,
        timeout: float = 0.25,
        max_items: int = 512,
    ):
        self.namespace = (namespace or "cs:dev").strip() or "cs:dev"
        self.timeout = max(0.05, float(timeout))
        self.max_items = max(1, int(max_items))
        self.enabled = False
        self.host = ""
        self.port = 6379
        self.username = ""
        self._password = ""
        self.db = 0
        self.use_tls = False

        self._io_lock = threading.Lock()
        self._sock: socket.socket | None = None
        self._reader = None

        self._lru_lock = threading.Lock()
        self._lru: OrderedDict[str, tuple[float | None, str]] = OrderedDict()

        self._configure(url, password)

    def _configure(self, url: str, password: str) -> None:
        raw_url = (url or "").strip()
        if not raw_url:
            return
        normalized = raw_url if "://" in raw_url else "redis://" + raw_url
        try:
            parsed = urlsplit(normalized)
            if parsed.scheme not in ("redis", "rediss") or not parsed.hostname:
                return
            port = parsed.port or 6379
            if not 1 <= port <= 65535:
                return
            db = 0
            path = parsed.path.lstrip("/")
            if path:
                if not path.isdigit():
                    return
                db = int(path)
        except ValueError:
            return

        self.host = parsed.hostname
        self.port = port
        self.use_tls = parsed.scheme == "rediss"
        self.username = unquote(parsed.username) if parsed.username else ""
        url_password = unquote(parsed.password) if parsed.password else ""
        self._password = password if password else url_password
        self.db = db
        self.enabled = True

    def _close_socket_unlocked(self) -> None:
        reader, sock = self._reader, self._sock
        self._reader = None
        self._sock = None
        if reader is not None:
            try:
                reader.close()
            except Exception:
                pass
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass

    def _connect_unlocked(self) -> None:
        self._close_socket_unlocked()
        sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
        sock.settimeout(self.timeout)
        if self.use_tls:
            ctx = ssl.create_default_context()
            sock = ctx.wrap_socket(sock, server_hostname=self.host)
            sock.settimeout(self.timeout)
        reader = sock.makefile("rb")
        self._sock = sock
        self._reader = reader
        try:
            if self._password:
                if self.username:
                    sock.sendall(_encode_command("AUTH", self.username, self._password))
                else:
                    sock.sendall(_encode_command("AUTH", self._password))
                _read_reply(reader)
            if self.db > 0:
                sock.sendall(_encode_command("SELECT", str(self.db)))
                _read_reply(reader)
        except Exception:
            self._close_socket_unlocked()
            raise

    def _execute(self, *parts: str | bytes):
        if not self.enabled:
            raise ConnectionError("Redis cache disabled")
        wire = _encode_command(*parts)
        with self._io_lock:
            for attempt in range(2):
                reused = self._sock is not None and self._reader is not None
                try:
                    if not reused:
                        self._connect_unlocked()
                    assert self._sock is not None and self._reader is not None
                    self._sock.sendall(wire)
                    return _read_reply(self._reader)
                except Exception:
                    self._close_socket_unlocked()
                    if reused and attempt == 0:
                        continue
                    raise

    def _lru_get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lru_lock:
            entry = self._lru.get(key)
            if entry is None:
                return None
            expires_at, serialized = entry
            if expires_at is not None and now >= expires_at:
                self._lru.pop(key, None)
                return None
            self._lru.move_to_end(key)
        try:
            return json.loads(serialized)
        except Exception:
            return None

    def _lru_set(self, key: str, serialized: str, ttl_seconds: int | None) -> None:
        expires_at = (time.monotonic() + ttl_seconds) if (ttl_seconds and ttl_seconds > 0) else None
        with self._lru_lock:
            self._lru[key] = (expires_at, serialized)
            self._lru.move_to_end(key)
            while len(self._lru) > self.max_items:
                self._lru.popitem(last=False)

    def ping(self) -> bool:
        if not self.enabled:
            return False
        try:
            reply = self._execute("PING")
            return reply in ("PONG", b"PONG")
        except Exception:
            return False

    def get_json(self, key: str) -> Any | None:
        cached = self._lru_get(key)
        if cached is not None:
            return cached
        if not self.enabled:
            return None
        try:
            raw = self._execute("GET", key)
            if raw is None:
                return None
            text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
            value = json.loads(text)
            self._lru_set(key, text, ttl_seconds=3600)
            return value
        except Exception:
            return None

    def set_json(self, key: str, val: Any, ttl_seconds: int = 86400) -> bool:
        try:
            serialized = json.dumps(val, ensure_ascii=False, separators=(",", ":"))
        except Exception:
            return False
        self._lru_set(key, serialized, ttl_seconds)
        if not self.enabled:
            return False
        try:
            if ttl_seconds and ttl_seconds > 0:
                self._execute("SET", key, serialized, "EX", str(int(ttl_seconds)))
            else:
                self._execute("SET", key, serialized)
            return True
        except Exception:
            return False

    def close(self) -> None:
        with self._io_lock:
            self._close_socket_unlocked()
