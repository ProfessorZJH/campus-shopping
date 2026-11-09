"""模型调用边界：聊天生成与向量嵌入分开，Provider 保留兼容外观。"""
from __future__ import annotations

import json
import math
import re
import time
from typing import Any
import httpx
from .config import Settings
from .http_limits import bounded_json
from .egress import minimized, audit
from .observability import counts, failure, lock, observed


def _bounded_json(*args, **kwargs):
    # 保留旧测试/联调入口 app.retrieval.bounded_json 的替换能力。
    from . import retrieval

    return retrieval.bounded_json(*args, **kwargs)

class _ProviderCore:
    def __init__(self,settings: Settings):self.settings=settings
    @property
    def vector_mode(self):return 'REMOTE_EMBEDDING' if self.settings.embedding_key else 'LOCAL_CHAR_NGRAM_DEMO'
    @property
    def model_tag(self):return self.settings.embedding_model or 'local-char-ngram-v1'
    @observed('embedding')
    def embed(self,texts: list[str],input_type: str="passage") -> list[list[float]]:
        from .retrieval import local_vector
        s=self.settings
        if not s.embedding_key:return [local_vector(t) for t in texts]
        result=[]
        with httpx.Client(timeout=25.0,follow_redirects=False,trust_env=False) as client:
            for start in range(0,len(texts),32):
                batch=[minimized(t,'content') for t in texts[start:start+32]]
                payload={'model':s.embedding_model,'input':batch}
                if s.embedding_model.startswith('nvidia/'):
                    payload.update(input_type=input_type,truncate='END')
                # 审计仅含供应商、用途、数量和字节，不含待嵌入文本。
                audit(s.embedding_url, 'embedding.'+input_type, len(batch), payload)
                data=_bounded_json(client,'POST',s.embedding_url+'/embeddings',limit=8_388_608,headers={'Authorization':'Bearer '+s.embedding_key},json=payload)['data'];data.sort(key=lambda x:x['index'])
                if len(data)!=len(batch):raise ValueError('向量数量不匹配')
                for item in data:
                    vector=item['embedding']
                    if not isinstance(vector,list) or not vector or len(vector)>8192 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in vector):raise ValueError('非法向量结果')
                    result.append(vector)
        if len({len(v) for v in result})!=1:raise ValueError('向量维度不一致')
        return result
    @observed('llm')
    def complete(self,system: str,payload: dict[str,Any]) -> dict[str,Any]:
        s=self.settings
        if not s.llm_key:raise RuntimeError('未配置真实模型')
        payload=minimized(payload)
        data={'model':s.llm_model,'max_completion_tokens':2048,'stream':False,
              'messages':[{'role':'system','content':system},{'role':'user','content':json.dumps(payload,ensure_ascii=False)}]}
        # 星火兼容接口无须强制 response_format/temperature；其余供应商保留 JSON mode。
        if not s.llm_model.startswith('spark-'):
            data['response_format']={'type':'json_object'}
        audit(s.llm_url, 'completion', len(payload.get('authorizedEvidence', [])), payload)
        with httpx.Client(timeout=httpx.Timeout(30.0,read=s.llm_timeout_seconds),follow_redirects=False,trust_env=False) as client:
            result=_bounded_json(client,'POST',s.llm_url+'/chat/completions',limit=262_144,headers={'Authorization':'Bearer '+s.llm_key},json=data)
            content=result['choices'][0]['message']['content']
            if not isinstance(content,str) or len(content)>20000:raise ValueError('模型输出无效或超限')
            content=content.strip()
            if content.startswith('```'):
                content=re.sub(r'^```(?:json)?\s*|\s*```$', '', content).strip()
            result=json.loads(content)
            if not isinstance(result,dict):raise ValueError('模型应返回 JSON 对象')
            return result

    def stream_complete(self,system: str,payload: dict[str,Any]):
        """读取 OpenAI 兼容供应商的真实 SSE 分块；调用方负责消费到结束或主动关闭。"""
        started=time.perf_counter();operation='llm';succeeded=False
        with lock:counts[operation+'.calls']+=1
        s=self.settings
        try:
            if not s.llm_key:raise RuntimeError('未配置真实模型')
            payload=minimized(payload)
            data={'model':s.llm_model,'max_completion_tokens':2048,'stream':True,
                  'messages':[{'role':'system','content':system},{'role':'user','content':json.dumps(payload,ensure_ascii=False)}]}
            if not s.llm_model.startswith('spark-'):data['response_format']={'type':'json_object'}
            audit(s.llm_url, 'completion.stream', len(payload.get('authorizedEvidence', [])), payload)
            total=0;finish_reason=None;saw_done=False
            with httpx.Client(timeout=httpx.Timeout(30.0,read=s.llm_timeout_seconds),follow_redirects=False,trust_env=False) as client:
                with client.stream('POST',s.llm_url+'/chat/completions',headers={'Authorization':'Bearer '+s.llm_key},json=data) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if isinstance(line,bytes):line=line.decode('utf-8','replace')
                        if len(line)>65536:raise ValueError('模型流式行超限')
                        if not line or line.startswith(':'):continue
                        if not line.startswith('data:'):continue
                        body=line[5:].strip()
                        if body=='[DONE]':saw_done=True;break
                        try:chunk=json.loads(body)
                        except (TypeError,ValueError):raise ValueError('模型流式数据无效') from None
                        choices=chunk.get('choices')
                        if not isinstance(choices,list) or not choices:continue
                        choice=choices[0];reason=choice.get('finish_reason')
                        if reason is not None:
                            if reason!='stop':raise ValueError('模型流式未正常结束')
                            finish_reason=reason
                        content=(choice.get('delta') or {}).get('content','')
                        if not isinstance(content,str):raise ValueError('模型流式内容无效')
                        total+=len(content.encode('utf-8'))
                        if total>20000:raise ValueError('模型输出无效或超限')
                        if content:yield content
            if finish_reason!='stop' or not saw_done:raise ValueError('模型流式未正常结束')
            succeeded=True
        except Exception as error:
            failure(operation,error)
            raise
        finally:
            with lock:
                if succeeded:counts[operation+'.last_success_at']=time.time()
                counts[operation+'.duration_ms']+=round((time.perf_counter()-started)*1000)

    @staticmethod
    def parse_json_content(content: str) -> dict[str,Any]:
        content=content.strip()
        if content.startswith('```'):content=re.sub(r'^```(?:json)?\s*|\s*```$', '', content).strip()
        result=json.loads(content)
        if not isinstance(result,dict):raise ValueError('模型应返回 JSON 对象')
        return result



class EmbeddingProvider:
    """负责向量嵌入；不向调用方暴露聊天生成。"""
    def __init__(self, core: _ProviderCore): self._core = core
    @property
    def vector_mode(self): return self._core.vector_mode
    @property
    def model_tag(self): return self._core.model_tag
    def embed(self, texts: list[str], input_type: str = "passage") -> list[list[float]]: return self._core.embed(texts, input_type)

class ChatProvider:
    """负责一次性/流式聊天生成和 JSON 内容解析。"""
    def __init__(self, core: _ProviderCore): self._core = core
    def complete(self, system: str, payload: dict[str, Any]) -> dict[str, Any]: return self._core.complete(system, payload)
    def stream_complete(self, system: str, payload: dict[str, Any]): return self._core.stream_complete(system, payload)
    @staticmethod
    def parse_json_content(content: str) -> dict[str, Any]: return _ProviderCore.parse_json_content(content)

class Provider:
    """兼容外观：旧调用方继续使用 Provider，新代码可依赖窄 Provider。"""
    def __init__(self, settings: Settings):
        self.settings = settings
        core = _ProviderCore(settings)
        self.chat = ChatProvider(core)
        self.embedding = EmbeddingProvider(core)
    @property
    def vector_mode(self): return self.embedding.vector_mode
    @property
    def model_tag(self): return self.embedding.model_tag
    def embed(self, texts: list[str], input_type: str = "passage") -> list[list[float]]: return self.embedding.embed(texts, input_type)
    def complete(self, system: str, payload: dict[str, Any]) -> dict[str, Any]: return self.chat.complete(system, payload)
    def stream_complete(self, system: str, payload: dict[str, Any]): return self.chat.stream_complete(system, payload)
    @staticmethod
    def parse_json_content(content: str) -> dict[str, Any]: return ChatProvider.parse_json_content(content)
