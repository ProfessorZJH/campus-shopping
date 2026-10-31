"""BM25、向量检索和 RRF。无真实向量模型时明确标记字符特征演示模式。"""
from __future__ import annotations
import hashlib,json,math,re,sqlite3,threading,time,uuid
from collections import Counter
from dataclasses import asdict
from typing import Any
import httpx
from .config import Settings
from .observability import observed, failure

def tokens(text: str) -> list[str]:
    text=text.lower()
    words=re.findall(r"[a-z0-9_]+",text)
    for seq in re.findall(r"[\u3400-\u9fff]+",text):
        words.extend(seq)
        words.extend(seq[i:i+2] for i in range(len(seq)-1))
    return words

def local_vector(text: str, size: int=256) -> list[float]:
    values=[0.0]*size
    for token,count in Counter(tokens(text)).items():
        digest=hashlib.sha256(token.encode()).digest()
        values[int.from_bytes(digest[:4],'big')%size]+=(1 if digest[4]&1 else -1)*(1+math.log(count))
    norm=math.sqrt(sum(x*x for x in values)) or 1.0
    return [v/norm for v in values]

def bm25(query: str, texts: list[str]) -> list[tuple[int,float]]:
    if not texts:return []
    documents=[Counter(tokens(t)) for t in texts];lengths=[sum(d.values()) for d in documents]
    avg=sum(lengths)/len(lengths) or 1;terms=set(tokens(query));scores=[]
    frequencies={t:sum(t in d for d in documents) for t in terms}
    for i,d in enumerate(documents):
        score=0.0
        for term in terms:
            count=d.get(term,0)
            if count:
                idf=math.log(1+(len(documents)-frequencies[term]+.5)/(frequencies[term]+.5))
                score+=idf*count*2.2/(count+1.2*(.25+.75*lengths[i]/avg))
        if score>0:scores.append((i,score))
    return sorted(scores,key=lambda s:(-s[1],s[0]))

def chunks(text: str, length: int=700, overlap: int=80) -> list[str]:
    normalized=text.replace('\x00','').strip()
    if not normalized or len(normalized)>100000:raise ValueError('文档文字须为1至100000字符')
    return [normalized[i:i+length] for i in range(0,len(normalized),length-overlap)]

class Provider:
    def __init__(self,settings: Settings):self.settings=settings
    @property
    def vector_mode(self):return 'REMOTE_EMBEDDING' if self.settings.embedding_key else 'LOCAL_CHAR_NGRAM_DEMO'
    @property
    def model_tag(self):return self.settings.embedding_model or 'local-char-ngram-v1'
    @observed('embedding')
    def embed(self,texts: list[str],input_type: str="passage") -> list[list[float]]:
        s=self.settings
        if not s.embedding_key:return [local_vector(t) for t in texts]
        result=[]
        with httpx.Client(timeout=25.0,follow_redirects=False,trust_env=False) as client:
            for start in range(0,len(texts),32):
                batch=texts[start:start+32]
                payload={'model':s.embedding_model,'input':batch}
                if s.embedding_model.startswith('nvidia/'):
                    payload.update(input_type=input_type,truncate='END')
                r=client.post(s.embedding_url+'/embeddings',headers={'Authorization':'Bearer '+s.embedding_key},json=payload)
                r.raise_for_status();data=r.json()['data'];data.sort(key=lambda x:x['index'])
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
        data={'model':s.llm_model,'max_completion_tokens':2048,'stream':False,
              'messages':[{'role':'system','content':system},{'role':'user','content':json.dumps(payload,ensure_ascii=False)}]}
        # 星火兼容接口无须强制 response_format/temperature；其余供应商保留 JSON mode。
        if not s.llm_model.startswith('spark-'):
            data['response_format']={'type':'json_object'}
        with httpx.Client(timeout=httpx.Timeout(30.0,read=s.llm_timeout_seconds),follow_redirects=False,trust_env=False) as client:
            r=client.post(s.llm_url+'/chat/completions',headers={'Authorization':'Bearer '+s.llm_key},json=data)
            r.raise_for_status()
            content=r.json()['choices'][0]['message']['content']
            if not isinstance(content,str) or len(content)>20000:raise ValueError('模型输出无效或超限')
            content=content.strip()
            if content.startswith('```'):
                content=re.sub(r'^```(?:json)?\s*|\s*```$', '', content).strip()
            result=json.loads(content)
            if not isinstance(result,dict):raise ValueError('模型应返回 JSON 对象')
            return result

class KnowledgeStore:
    def __init__(self,settings: Settings):
        self.settings=settings;self.provider=Provider(settings);self.lock=threading.RLock()
        self.db=sqlite3.connect(settings.db_path,check_same_thread=False,isolation_level=None)
        self.db.row_factory=sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS docs(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,model TEXT NOT NULL,updated REAL NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY,doc_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,ordinal INTEGER NOT NULL,embedding TEXT NOT NULL,model TEXT NOT NULL)')
        self.db.execute('CREATE INDEX IF NOT EXISTS chunks_doc ON chunks(doc_id)')
    def close(self):self.db.close()
    def _qdrant(self,method: str,path: str,body: dict|None=None):
        s=self.settings
        with httpx.Client(timeout=30.0,follow_redirects=False,trust_env=False) as client:
            r=client.request(method,s.qdrant_url+path,headers={'api-key':s.qdrant_key} if s.qdrant_key else {},json=body)
            r.raise_for_status();return r.json().get('result')
    def _ensure_collection(self,size: int):
        s=self.settings
        try:
            result=self._qdrant('GET','/collections/'+s.collection)
            actual=result['config']['params']['vectors']['size']
            if actual!=size:raise ValueError('集合维度不同，需要新集合或重建索引')
        except httpx.HTTPStatusError as e:
            if e.response.status_code!=404:raise
            self._qdrant('PUT','/collections/'+s.collection,{'vectors':{'size':size,'distance':'Cosine'}})
            self._qdrant('PUT','/collections/'+s.collection+'/index',{'field_name':'document_id','field_schema':'keyword'})
    def index(self,doc_id: str,title: str,text: str) -> int:
        pieces=chunks(text);fingerprint=hashlib.sha256((title+'\0'+text).encode()).hexdigest()
        with self.lock:
            prior=self.db.execute('SELECT fingerprint,model FROM docs WHERE id=?',(doc_id,)).fetchone()
            if prior and prior['fingerprint']!=fingerprint:raise ValueError('文档版本内容不可变；请使用新版本ID')
        vectors=self.provider.embed(pieces)
        rows=[(str(uuid.uuid5(uuid.NAMESPACE_URL,doc_id+':'+str(i))),doc_id,title,body,i,json.dumps(vectors[i]),self.provider.model_tag) for i,body in enumerate(pieces)]
        # 远端写入成功后才标记本地就绪；重试使用稳定点ID，不生成重复分片。
        if self.settings.qdrant_url:
            self._ensure_collection(len(vectors[0]))
            points=[{'id':row[0],'vector':vectors[i],'payload':{'document_id':doc_id,'ordinal':i,'model':self.provider.model_tag}} for i,row in enumerate(rows)]
            self._qdrant('PUT','/collections/'+self.settings.collection+'/points?wait=true',{'points':points})
        with self.lock:
            self.db.execute('BEGIN IMMEDIATE')
            try:
                self.db.execute('DELETE FROM chunks WHERE doc_id=?',(doc_id,))
                self.db.executemany('INSERT INTO chunks VALUES(?,?,?,?,?,?,?)',rows)
                self.db.execute('INSERT INTO docs VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET model=excluded.model,updated=excluded.updated',(doc_id,fingerprint,self.provider.model_tag,time.time()))
                self.db.execute('COMMIT')
            except Exception:self.db.execute('ROLLBACK');raise
        return len(rows)
    def delete(self,doc_id: str):
        if self.settings.qdrant_url:self._qdrant('POST','/collections/'+self.settings.collection+'/points/delete?wait=true',{'filter':{'must':[{'key':'document_id','match':{'value':doc_id}}]}})
        with self.lock:
            self.db.execute('BEGIN IMMEDIATE')
            try:
                self.db.execute('DELETE FROM chunks WHERE doc_id=?',(doc_id,));self.db.execute('DELETE FROM docs WHERE id=?',(doc_id,));self.db.execute('COMMIT')
            except Exception:self.db.execute('ROLLBACK');raise
    def search(self,query: str,allowed: list[str],top_k: int=6) -> tuple[list[dict],str]:
        if not allowed:return [],self.provider.vector_mode
        allowed=list(dict.fromkeys(allowed))
        if len(allowed)>1000:raise ValueError('allowed document scope exceeds 1000')
        with self.lock:
            rows=[]
            for start in range(0,len(allowed),500):
                batch=allowed[start:start+500]
                rows.extend(dict(r) for r in self.db.execute('SELECT * FROM chunks WHERE doc_id IN ('+','.join('?' for _ in batch)+') ORDER BY doc_id,ordinal',batch))
            rows.sort(key=lambda r:(r['doc_id'],r['ordinal']))
        if not rows:return [],self.provider.vector_mode
        sparse=bm25(query,[r['title']+' '+r['body'] for r in rows])[:30]
        by_id={r['id']:i for i,r in enumerate(rows)};dense=[];mode=self.provider.vector_mode
        try:
            vector=self.provider.embed([query],input_type="query")[0]
            if self.settings.qdrant_url:
                result=self._qdrant('POST','/collections/'+self.settings.collection+'/points/query',{'query':vector,'filter':{'must':[{'key':'document_id','match':{'any':allowed}},{'key':'model','match':{'value':self.provider.model_tag}}]},'limit':30,'with_payload':False})
                dense=[(by_id[str(p['id'])],p['score']) for p in result['points'] if str(p['id']) in by_id and p['score']>0.05]
            else:
                for i,row in enumerate(rows):
                    if row['model']!=self.provider.model_tag:continue
                    v=json.loads(row['embedding'])
                    if len(v)==len(vector):
                        score=sum(a*b for a,b in zip(v,vector))/(math.sqrt(sum(x*x for x in v))*math.sqrt(sum(x*x for x in vector)) or 1)
                        if score>0.05:dense.append((i,score))
                dense=sorted(dense,key=lambda x:-x[1])[:30]
        except (httpx.HTTPError,ValueError,KeyError,TypeError) as error:
            failure('knowledge.vector_fallback', error)
            mode='BM25_DEGRADED'
        scores:dict[int,float]={}
        for ranking in (sparse,dense):
            for rank,(i,_) in enumerate(ranking,1):scores[i]=scores.get(i,0)+1/(60+rank)
        selected=sorted(scores,key=lambda i:(-scores[i],rows[i]['id']))[:top_k]
        return [{'documentId':rows[i]['doc_id'],'chunkId':rows[i]['id'],'title':rows[i]['title'],'snippet':rows[i]['body'][:500],'score':scores[i]} for i in selected],mode
