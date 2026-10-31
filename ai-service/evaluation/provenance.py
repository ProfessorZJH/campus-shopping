"""仅评测进程使用的传输/供应商装饰器；不根据响应mode判断来源。"""
from __future__ import annotations

from collections import Counter
from contextlib import contextmanager, ExitStack
from dataclasses import replace
import json
import os
import socket
from unittest.mock import patch
from urllib.parse import urlsplit

import httpx
from app.config import Settings
from app.retrieval import local_vector

PROFILES = ('local', 'controlled', 'real-embedding', 'real-llm', 'real-milvus', 'live-full')


class BudgetExceeded(httpx.TransportError):
    pass


def settings_for(profile, db_path, collection):
    base = Settings('evaluation-isolated-key-123456789', str(db_path), product_collection=collection)
    if profile == 'controlled':
        return replace(base, embedding_url='https://embedding.eval.invalid/v1', embedding_key='controlled-only',
                       embedding_model='controlled-char-vector', llm_url='https://llm.eval.invalid/v1',
                       llm_key='controlled-only', llm_model='controlled-json')
    if profile == 'local':
        return base
    # 不加载.env，不读取业务库地址；仅复制本次明确选择组件的进程环境。
    fields = {}
    for prefix, active in (('embedding', profile in ('real-embedding', 'real-milvus', 'live-full')),
                           ('llm', profile in ('real-llm', 'live-full'))):
        if active:
            for field, suffix in (('url', 'BASE_URL'), ('key', 'API_KEY'), ('model', 'MODEL')):
                fields[prefix + '_' + field] = os.getenv(prefix.upper() + '_' + suffix, '').rstrip('/')
    if profile in ('real-milvus', 'live-full'):
        fields.update(milvus_uri=os.getenv('MILVUS_URI', ''), milvus_token=os.getenv('MILVUS_TOKEN', ''))
    return replace(base, **fields)


def preflight(profile, settings, allow_external, budget):
    if profile in ('local', 'controlled'):
        return None
    if not allow_external:
        return 'EXTERNAL_NOT_ENABLED'
    if budget <= 0:
        return 'REQUEST_BUDGET_REQUIRED'
    required = ['embedding'] if profile in ('real-embedding', 'real-milvus', 'live-full') else []
    if profile in ('real-llm', 'live-full'):
        required.append('llm')
    if any(not all(getattr(settings, p + '_' + f) for f in ('url', 'key', 'model')) for p in required):
        return 'MISSING_PROVIDER_CONFIG'
    if profile in ('real-milvus', 'live-full') and not (settings.milvus_uri and settings.milvus_token):
        return 'MISSING_MILVUS_CONFIG'
    for p in required:
        u = urlsplit(getattr(settings, p + '_url'))
        if u.scheme != 'https' or not u.hostname or u.username or u.password:
            return 'PROVIDER_TLS_REQUIRED'
    return None


class Recorder:
    def __init__(self, profile, budget):
        self.profile, self.budget, self.used = profile, budget, 0
        self.events = []
        self.models = {}

    def event(self, component, source, outcome, operation):
        self.events.append(dict(component=component, source=source, outcome=outcome, operation=operation))

    def consume(self):
        if self.used >= self.budget:
            raise BudgetExceeded('evaluation request budget exhausted')
        self.used += 1

    def snapshot(self, start=0):
        result = {}
        for component in ('embedding', 'llm', 'productVector', 'knowledgeVector', 'javaMysql'):
            rows = [e for e in self.events[start:] if e['component'] == component]
            result[component] = {'source': sorted({e['source'] for e in rows}) or ['NOT_USED'],
                                 'attempts': len(rows), 'success': sum(e['outcome'] == 'SUCCESS' for e in rows),
                                 'failure': sum(e['outcome'] != 'SUCCESS' for e in rows),
                                 'operations': dict(Counter(e['operation'] for e in rows))}
        return result


def controlled_response(request):
    """与已有MockTransport测试相同的协议替身，故意返回真实同名mode。"""
    body = json.loads(request.content)
    if request.url.path.endswith('/embeddings'):
        return httpx.Response(200, json={'data': [{'index': i, 'embedding': local_vector(t)}
                                                for i, t in enumerate(body['input'])]})
    payload = json.loads(body['messages'][-1]['content'])
    if 'candidates' in payload:
        result = {'answer': '受控模型回答，未执行交易。', 'mode': 'LLM',
                  'recommendations': [{'skuId': c['skuId'], 'quantity': 1} for c in payload['candidates'][:3]]}
    elif 'recentUserQuestions' in payload:
        result = {'query': payload['question'], 'terms': ['校园', '商品']}
    else:
        result = {'query': payload['question']}
    return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(result, ensure_ascii=False)}}]})


@contextmanager
def transport_scope(settings, recorder, handler=None):
    original = httpx.Client
    offline = recorder.profile in ('local', 'controlled')
    source = 'STUB' if recorder.profile == 'controlled' or handler is not None else 'REAL'
    origins = {getattr(settings, p + '_url').rstrip('/'): p for p in ('embedding', 'llm') if getattr(settings, p + '_url')}

    class Transport(httpx.BaseTransport):
        def __init__(self):
            self.inner = httpx.MockTransport(handler or controlled_response) if source == 'STUB' else httpx.HTTPTransport(retries=0)

        def handle_request(self, request):
            component = next((p for url, p in origins.items() if str(request.url).startswith(url + '/')), None)
            if component is None or (offline and source != 'STUB'):
                raise httpx.TransportError('evaluation network blocked')
            outcome = 'FAILED'
            try:
                recorder.consume()
                response = self.inner.handle_request(request)
                if response.is_success:
                    outcome = 'SUCCESS'
                return response
            finally:
                recorder.event(component, source, outcome, request.url.path.rsplit('/', 1)[-1])

        def close(self):
            self.inner.close()

    def client(**kwargs):
        kwargs.pop('transport', None)
        return original(transport=Transport(), **kwargs)

    with ExitStack() as stack:
        stack.enter_context(patch('httpx.Client', client))
        if offline:
            def blocked(*args, **kwargs):
                raise OSError('evaluation offline network blocked')
            stack.enter_context(patch.object(socket.socket, 'connect', blocked))
            stack.enter_context(patch('socket.create_connection', blocked))
        yield


class RecordedProvider:
    def __init__(self, provider, recorder):
        self.inner, self.recorder = provider, recorder

    def __getattr__(self, name):
        return getattr(self.inner, name)

    def embed(self, texts, input_type='passage'):
        # 远程调用由transport逐请求记录（含每个batch）；本地算法单列。
        if not self.inner.settings.embedding_key:
            self.recorder.event('embedding', 'LOCAL_CHAR_NGRAM', 'SUCCESS', input_type)
        result = self.inner.embed(texts, input_type)
        self.recorder.models['embedding'] = {'model': self.inner.model_tag, 'dimension': len(result[0]) if result else None}
        return result

    def complete(self, system, payload):
        result = self.inner.complete(system, payload)
        self.recorder.models['llm'] = {'model': self.inner.settings.llm_model}
        return result


class RecordedClient:
    """Milvus每个实际客户端操作计预算；对象来源由创建者确定，不能由返回mode覆盖。"""
    def __init__(self, client, recorder, source):
        self.inner, self.recorder, self.source = client, recorder, source

    def __getattr__(self, name):
        member = getattr(self.inner, name)
        if not callable(member):
            return member

        def call(*args, **kwargs):
            outcome = 'FAILED'
            try:
                self.recorder.consume()
                result = member(*args, **kwargs)
                outcome = 'SUCCESS'
                return result
            finally:
                self.recorder.event('productVector', self.source, outcome, name)
        return call
