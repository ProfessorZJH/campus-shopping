"""模型调用边界：聊天生成与向量嵌入分开，Provider 保留兼容外观。"""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import math
import re
import threading
import time
from typing import Any
import httpx
from .config import Settings
from .http_limits import bounded_json
from .egress import minimized, audit
from .observability import counts, failure, lock, observed, record_embedding_cache
from .redis_cache import RedisCache


class EmbeddingCircuitOpenError(httpx.HTTPError):
    """远端向量嵌入软熔断开启，供检索层立即降级为 BM25。"""


def _is_real_httpx_client() -> bool:
    return getattr(httpx.Client, "__module__", "").startswith("httpx")


def _bounded_json(*args, **kwargs):
    # 保留旧测试/联调入口 app.retrieval.bounded_json 的替换能力。
    from . import retrieval

    return retrieval.bounded_json(*args, **kwargs)


def _valid_vector(vector: Any) -> bool:
    return (
        isinstance(vector, list)
        and bool(vector)
        and len(vector) <= 8192
        and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in vector)
    )


class _ProviderCore:
    _CB_THRESHOLD = 3
    _CB_WINDOW_SECONDS = 30.0
    _CB_OPEN_SECONDS = 20.0
    _RETRY_DELAY_SECONDS = 0.25

    def __init__(self, settings: Settings):
        self.settings = settings
        self.redis_cache = RedisCache(
            url=settings.redis_url,
            password=settings.redis_password,
            namespace=settings.redis_namespace,
        )
        self._client_lock = threading.Lock()
        self._embed_client: httpx.Client | None = None
        self._llm_client: httpx.Client | None = None
        self._cb_lock = threading.Lock()
        self._embed_failure_times: list[float] = []
        self._embed_circuit_open_until: float = 0.0

    @property
    def vector_mode(self):
        return 'REMOTE_EMBEDDING' if self.settings.embedding_key else 'LOCAL_CHAR_NGRAM_DEMO'

    @property
    def model_tag(self):
        return self.settings.embedding_model or 'local-char-ngram-v1'

    @property
    def redis_connected(self) -> bool:
        return bool(self.settings.redis_url) and self.redis_cache.ping()

    @contextmanager
    def _http_client(self, kind: str):
        s = self.settings
        if _is_real_httpx_client():
            with self._client_lock:
                if kind == 'embed':
                    if self._embed_client is None or self._embed_client.is_closed:
                        self._embed_client = httpx.Client(
                            timeout=25.0,
                            follow_redirects=False,
                            trust_env=False,
                            limits=httpx.Limits(max_connections=32, max_keepalive_connections=16),
                        )
                    client = self._embed_client
                else:
                    if self._llm_client is None or self._llm_client.is_closed:
                        self._llm_client = httpx.Client(
                            timeout=httpx.Timeout(30.0, read=s.llm_timeout_seconds),
                            follow_redirects=False,
                            trust_env=False,
                            limits=httpx.Limits(max_connections=32, max_keepalive_connections=16),
                        )
                    client = self._llm_client
            yield client
            return
        timeout = 25.0 if kind == 'embed' else httpx.Timeout(30.0, read=s.llm_timeout_seconds)
        with httpx.Client(timeout=timeout, follow_redirects=False, trust_env=False) as client:
            yield client

    def close(self) -> None:
        with self._client_lock:
            for client in (self._embed_client, self._llm_client):
                if client is not None and not client.is_closed:
                    try:
                        client.close()
                    except Exception:
                        pass
            self._embed_client = None
            self._llm_client = None
        self.redis_cache.close()

    def _embed_cache_key(self, text: str, input_type: str) -> str:
        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()
        composite = hashlib.sha256(
            f"{self.settings.embedding_model}\0{input_type}\0{text_hash}".encode('utf-8')
        ).hexdigest()
        ns = (self.settings.redis_namespace or 'cs:dev').strip() or 'cs:dev'
        return f"{ns}:ai:emb:v1:{composite}"

    def _check_embed_circuit(self) -> None:
        now = time.monotonic()
        with self._cb_lock:
            if now < self._embed_circuit_open_until:
                raise EmbeddingCircuitOpenError('远端向量嵌入软熔断开启')

    def _record_embed_success(self) -> None:
        with self._cb_lock:
            self._embed_failure_times.clear()
            self._embed_circuit_open_until = 0.0

    def _record_embed_failure(self) -> None:
        now = time.monotonic()
        with self._cb_lock:
            cutoff = now - self._CB_WINDOW_SECONDS
            self._embed_failure_times = [t for t in self._embed_failure_times if t >= cutoff]
            self._embed_failure_times.append(now)
            if len(self._embed_failure_times) >= self._CB_THRESHOLD:
                self._embed_circuit_open_until = now + self._CB_OPEN_SECONDS
                self._embed_failure_times.clear()

    def _post_embed(self, client, payload: dict[str, Any], *, allow_retry: bool) -> list[dict[str, Any]]:
        s = self.settings
        headers = {'Authorization': 'Bearer ' + s.embedding_key}
        url = s.embedding_url + '/embeddings'
        for attempt in range(2 if allow_retry else 1):
            try:
                return _bounded_json(client, 'POST', url, limit=8_388_608, headers=headers, json=payload)['data']
            except httpx.HTTPStatusError as error:
                status = getattr(getattr(error, 'response', None), 'status_code', None)
                if allow_retry and attempt == 0 and status is not None and 500 <= status < 600:
                    time.sleep(self._RETRY_DELAY_SECONDS)
                    continue
                raise
            except httpx.RequestError:
                if allow_retry and attempt == 0:
                    time.sleep(self._RETRY_DELAY_SECONDS)
                    continue
                raise
        raise RuntimeError('向量嵌入请求未返回结果')

    @observed('embedding')
    def embed(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        from .retrieval import local_vector
        s = self.settings
        if not s.embedding_key:
            return [local_vector(t) for t in texts]
        if not texts:
            return []

        real_http = _is_real_httpx_client()
        prepared = [minimized(t, 'content') for t in texts]
        resolved: list[list[float] | None] = [None] * len(prepared)
        missing: list[tuple[int, str, str | None]] = []

        if real_http:
            cache_hits = 0
            cache_misses = 0
            for idx, m_text in enumerate(prepared):
                cache_key = self._embed_cache_key(m_text, input_type)
                cached = self.redis_cache.get_json(cache_key)
                if _valid_vector(cached):
                    resolved[idx] = cached
                    cache_hits += 1
                else:
                    missing.append((idx, m_text, cache_key))
                    cache_misses += 1
            record_embedding_cache(hits=cache_hits, misses=cache_misses)
            if not missing:
                vectors = [v for v in resolved if v is not None]
                if len({len(v) for v in vectors}) != 1:
                    raise ValueError('向量维度不一致')
                return vectors
        else:
            missing = [(idx, m_text, None) for idx, m_text in enumerate(prepared)]

        self._check_embed_circuit()
        try:
            with self._http_client('embed') as client:
                for start in range(0, len(missing), 32):
                    slice_items = missing[start:start + 32]
                    batch = [item[1] for item in slice_items]
                    payload = {'model': s.embedding_model, 'input': batch}
                    if s.embedding_model.startswith('nvidia/'):
                        payload.update(input_type=input_type, truncate='END')
                    # 审计仅含供应商、用途、数量和字节，不含待嵌入文本。
                    audit(s.embedding_url, 'embedding.' + input_type, len(batch), payload)
                    allow_retry = real_http and len(batch) == 1
                    try:
                        data = self._post_embed(client, payload, allow_retry=allow_retry)
                    except httpx.HTTPStatusError as error:
                        status = getattr(getattr(error, 'response', None), 'status_code', None)
                        if len(batch) <= 1 or status not in (413, 422, 500):
                            raise
                        data = []
                        for text in batch:
                            single_payload = dict(payload)
                            single_payload['input'] = [text]
                            audit(s.embedding_url, 'embedding.' + input_type, 1, single_payload)
                            data.extend(self._post_embed(client, single_payload, allow_retry=real_http))
                    data.sort(key=lambda x: x['index'])
                    if len(data) != len(batch):
                        raise ValueError('向量数量不匹配')
                    for (orig_idx, _, cache_key), item in zip(slice_items, data):
                        vector = item['embedding']
                        if not _valid_vector(vector):
                            raise ValueError('非法向量结果')
                        resolved[orig_idx] = vector
                        if real_http and cache_key:
                            self.redis_cache.set_json(cache_key, vector, ttl_seconds=86400)
        except httpx.HTTPError:
            self._record_embed_failure()
            raise

        self._record_embed_success()
        result = [v for v in resolved if v is not None]
        if len(result) != len(texts) or len({len(v) for v in result}) != 1:
            raise ValueError('向量维度不一致')
        return result

    @observed('llm')
    def complete(self, system: str, payload: dict[str, Any]) -> dict[str, Any]:
        s = self.settings
        if not s.llm_key:
            raise RuntimeError('未配置真实模型')
        payload = minimized(payload)
        data = {'model': s.llm_model, 'max_completion_tokens': 2048, 'stream': False,
                'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}]}
        # 星火兼容接口无须强制 response_format/temperature；其余供应商保留 JSON mode。
        if not s.llm_model.startswith('spark-'):
            data['response_format'] = {'type': 'json_object'}
        audit(s.llm_url, 'completion', len(payload.get('authorizedEvidence', [])), payload)
        with self._http_client('llm') as client:
            result = _bounded_json(client, 'POST', s.llm_url + '/chat/completions', limit=262_144, headers={'Authorization': 'Bearer ' + s.llm_key}, json=data)
            content = result['choices'][0]['message']['content']
            if not isinstance(content, str) or len(content) > 20000:
                raise ValueError('模型输出无效或超限')
            return self.parse_json_content(content)

    def stream_complete(self, system: str, payload: dict[str, Any]):
        """读取 OpenAI 兼容供应商的真实 SSE 分块；调用方负责消费到结束或主动关闭。"""
        started = time.perf_counter(); operation = 'llm'; succeeded = False
        with lock:
            counts[operation + '.calls'] += 1
        s = self.settings
        try:
            if not s.llm_key:
                raise RuntimeError('未配置真实模型')
            payload = minimized(payload)
            data = {'model': s.llm_model, 'max_completion_tokens': 2048, 'stream': True,
                    'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}]}
            if not s.llm_model.startswith('spark-'):
                data['response_format'] = {'type': 'json_object'}
            audit(s.llm_url, 'completion.stream', len(payload.get('authorizedEvidence', [])), payload)
            total = 0; finish_reason = None; saw_done = False
            with self._http_client('llm') as client:
                with client.stream('POST', s.llm_url + '/chat/completions', headers={'Authorization': 'Bearer ' + s.llm_key}, json=data) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if isinstance(line, bytes):
                            line = line.decode('utf-8', 'replace')
                        if len(line) > 65536:
                            raise ValueError('模型流式行超限')
                        if not line or line.startswith(':'):
                            continue
                        if not line.startswith('data:'):
                            continue
                        body = line[5:].strip()
                        if body == '[DONE]':
                            saw_done = True
                            break
                        try:
                            chunk = json.loads(body)
                        except (TypeError, ValueError):
                            raise ValueError('模型流式数据无效') from None
                        choices = chunk.get('choices')
                        if not isinstance(choices, list) or not choices:
                            continue
                        choice = choices[0]; reason = choice.get('finish_reason')
                        if reason not in (None, ''):
                            if reason != 'stop':
                                raise ValueError('模型流式未正常结束')
                            finish_reason = reason
                        raw_content = (choice.get('delta') or {}).get('content')
                        content = '' if raw_content is None else raw_content
                        if not isinstance(content, str):
                            raise ValueError('模型流式内容无效')
                        total += len(content.encode('utf-8'))
                        if total > 20000:
                            raise ValueError('模型输出无效或超限')
                        if content:
                            yield content
            if finish_reason != 'stop' or not saw_done:
                raise ValueError('模型流式未正常结束')
            succeeded = True
        except Exception as error:
            failure(operation, error)
            raise
        finally:
            with lock:
                if succeeded:
                    counts[operation + '.last_success_at'] = time.time()
                counts[operation + '.duration_ms'] += round((time.perf_counter() - started) * 1000)

    @staticmethod
    def parse_json_content(content: str) -> dict[str, Any]:
        content = content.strip()
        if content.startswith('```'):
            content = re.sub(r'^```(?:json)?\s*|\s*```$', '', content).strip()
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            fenced = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if fenced:
                result = json.loads(fenced.group(1))
            else:
                start = content.find('{')
                if start < 0:
                    raise
                decoder = json.JSONDecoder()
                result, end = decoder.raw_decode(content, start)
                trailing = content[end:].strip()
                if trailing and ('{' in trailing or '}' in trailing):
                    raise ValueError('模型返回多个或残缺 JSON 对象')
        if not isinstance(result, dict):
            raise ValueError('模型应返回 JSON 对象')
        return result


class EmbeddingProvider:
    """负责向量嵌入；不向调用方暴露聊天生成。"""
    def __init__(self, core: _ProviderCore):
        self._core = core

    @property
    def vector_mode(self):
        return self._core.vector_mode

    @property
    def model_tag(self):
        return self._core.model_tag

    @property
    def redis_cache(self) -> RedisCache:
        return self._core.redis_cache

    @property
    def redis_connected(self) -> bool:
        return self._core.redis_connected

    def embed(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        return self._core.embed(texts, input_type)

    def close(self) -> None:
        self._core.close()


class ChatProvider:
    """负责一次性/流式聊天生成和 JSON 内容解析。"""
    def __init__(self, core: _ProviderCore):
        self._core = core

    def complete(self, system: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._core.complete(system, payload)

    def stream_complete(self, system: str, payload: dict[str, Any]):
        return self._core.stream_complete(system, payload)

    @staticmethod
    def parse_json_content(content: str) -> dict[str, Any]:
        return _ProviderCore.parse_json_content(content)


class Provider:
    """兼容外观：旧调用方继续使用 Provider，新代码可依赖窄 Provider。"""
    def __init__(self, settings: Settings):
        self.settings = settings
        self._core = _ProviderCore(settings)
        self.chat = ChatProvider(self._core)
        self.embedding = EmbeddingProvider(self._core)

    @property
    def vector_mode(self):
        return self.embedding.vector_mode

    @property
    def model_tag(self):
        return self.embedding.model_tag

    @property
    def redis_cache(self) -> RedisCache:
        return self.embedding.redis_cache

    @property
    def redis_connected(self) -> bool:
        return self.embedding.redis_connected

    def embed(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        return self.embedding.embed(texts, input_type)

    def complete(self, system: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self.chat.complete(system, payload)

    def stream_complete(self, system: str, payload: dict[str, Any]):
        return self.chat.stream_complete(system, payload)

    def close(self) -> None:
        self._core.close()

    @staticmethod
    def parse_json_content(content: str) -> dict[str, Any]:
        return ChatProvider.parse_json_content(content)
