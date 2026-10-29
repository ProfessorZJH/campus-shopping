"""仅接受 Java 后端持有的共享密钥。ACL 白名单在 Java 构造，前端不能直接访问此服务。"""
from __future__ import annotations
import base64,json,secrets,subprocess,sys,threading
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Annotated
from fastapi import FastAPI,Header,HTTPException,Depends
from pydantic import BaseModel,Field,ConfigDict
from .config import Settings
from .retrieval import KnowledgeStore
from .engine import answer,recall_terms
from .product_index import ProductIndex

class RequestBodyLimit:
    """同时限制有 Content-Length 和分块传输的请求，不能只信任请求头。"""
    def __init__(self,app,limit: int):self.app,self.limit=app,limit
    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        body=bytearray()
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            part=message.get('body',b'')
            if len(part)>self.limit-len(body):
                payload=json.dumps({'detail':'请求体超过允许大小'},ensure_ascii=False).encode('utf-8')
                await send({'type':'http.response.start','status':413,'headers':[(b'content-type',b'application/json; charset=utf-8')]})
                await send({'type':'http.response.body','body':payload});return
            body.extend(part)
            if not message.get('more_body',False):break
        delivered=False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered=True
                return {'type':'http.request','body':bytes(body),'more_body':False}
            return await receive()
        await self.app(scope,replay,send)
class StrictModel(BaseModel):model_config=ConfigDict(extra='forbid')
class IndexRequest(StrictModel):
    documentId: str=Field(min_length=1,max_length=64)
    title: str=Field(min_length=1,max_length=120)
    content: str=Field(min_length=1,max_length=100000)
class HistoryItem(StrictModel):
    role: str=Field(pattern='^(user|assistant)$')
    content: str=Field(max_length=8000)
class Offer(StrictModel):
    skuId: str=Field(max_length=64);merchantId: str=Field(max_length=64)
    title: str=Field(max_length=100);specKey: str=Field(max_length=100)
    description: str=Field(default='',max_length=5000)
    priceCent: int=Field(gt=0,le=100000000);available: int=Field(ge=0)
class QueryRequest(StrictModel):
    question: str=Field(min_length=1,max_length=2000)
    allowedDocumentIds: list[str]=Field(max_length=1000)
    offers: list[Offer]=Field(max_length=300)
    retrievalQuery: str=Field(default="",max_length=2000)
    history: list[HistoryItem]=Field(default_factory=list,max_length=12)
    semanticSkuIds: list[str]=Field(default_factory=list,max_length=300)
class RecallRequest(StrictModel):
    question: str=Field(min_length=1,max_length=2000)
    history: list[HistoryItem]=Field(default_factory=list,max_length=12)
class ProductRecord(StrictModel):
    productId: str=Field(min_length=1,max_length=64)
    merchantId: str=Field(min_length=1,max_length=64)
    title: str=Field(min_length=1,max_length=100)
    description: str=Field(default='',max_length=5000)
    categoryCode: str=Field(min_length=1,max_length=32)
    specs: list[str]=Field(min_length=1,max_length=20)
class ProductIndexRequest(StrictModel):
    products: list[ProductRecord]=Field(min_length=1,max_length=100)
class ProductSearchRequest(StrictModel):
    query: str=Field(min_length=1,max_length=2000)
    limit: int=Field(default=80,ge=1,le=100)
class ExtractRequest(StrictModel):
    filename: str=Field(min_length=1,max_length=120)
    contentType: str=Field(default='',max_length=100)
    base64: str=Field(max_length=2800000)

def create_app(settings: Settings|None=None):
    settings=settings or Settings.from_env();settings.validate();store=KnowledgeStore(settings);products=ProductIndex(settings,store.provider);gate=threading.BoundedSemaphore(4)
    @asynccontextmanager
    async def lifespan(app):
        yield
        store.close()
    app=FastAPI(title='校园导购检索服务',version='1.0.0',lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
    app.state.store=store;app.state.products=products
    def authorized(x_service_key: Annotated[str|None,Header()]=None):
        if x_service_key is None or not secrets.compare_digest(x_service_key,settings.api_key):raise HTTPException(401,'服务身份无效')
    app.add_middleware(RequestBodyLimit, limit=4_000_000)
    @app.get('/health')
    def health():return {'status':'UP','llmConfigured':bool(settings.llm_key),'retrievalMode':store.provider.vector_mode,'vectorStore':'QDRANT' if settings.qdrant_url else 'LOCAL_SQLITE','productIndex':'MILVUS' if products.enabled else 'DISABLED'}
    @app.post('/v1/index',dependencies=[Depends(authorized)])
    def index(request: IndexRequest):
        if not gate.acquire(blocking=False):raise HTTPException(429,'索引服务繁忙')
        try:return {'chunks':store.index(request.documentId,request.title,request.content),'mode':store.provider.vector_mode}
        except ValueError as e:raise HTTPException(400,str(e)) from None
        except Exception:raise HTTPException(503,'索引依赖不可用，请重试') from None
        finally:gate.release()
    @app.delete('/v1/index/{document_id}',dependencies=[Depends(authorized)])
    def delete(document_id: str):
        if len(document_id)>64:raise HTTPException(400,'编号无效')
        try:store.delete(document_id);return {'deleted':True}
        except Exception:raise HTTPException(503,'索引删除失败') from None
    @app.post('/v1/recall',dependencies=[Depends(authorized)])
    def recall(request: RecallRequest):
        if not gate.acquire(blocking=False):raise HTTPException(429,'推理服务繁忙')
        try:return recall_terms(store,request.question,[h.model_dump() for h in request.history])
        except Exception:raise HTTPException(503,'检索意图暂不可用') from None
        finally:gate.release()
    @app.post('/v1/query',dependencies=[Depends(authorized)])
    def query(request: QueryRequest):
        if not gate.acquire(blocking=False):raise HTTPException(429,'推理服务繁忙')
        try:return answer(store,request.question,request.allowedDocumentIds,[o.model_dump() for o in request.offers],[h.model_dump() for h in request.history],request.retrievalQuery,request.semanticSkuIds)
        except Exception:raise HTTPException(503,'检索暂不可用') from None
        finally:gate.release()
    @app.post('/v1/products/index',dependencies=[Depends(authorized)])
    def index_products(request: ProductIndexRequest):
        if not gate.acquire(blocking=False):raise HTTPException(429,'向量索引繁忙')
        try:return products.upsert([p.model_dump() for p in request.products])
        except ValueError as e:raise HTTPException(400,str(e)) from None
        except Exception:raise HTTPException(503,'商品向量索引不可用') from None
        finally:gate.release()
    @app.post('/v1/products/search',dependencies=[Depends(authorized)])
    def search_products(request: ProductSearchRequest):
        if not gate.acquire(blocking=False):raise HTTPException(429,'向量检索繁忙')
        try:return products.search(request.query,request.limit)
        except Exception:raise HTTPException(503,'商品向量检索不可用') from None
        finally:gate.release()
    @app.post('/v1/extract',dependencies=[Depends(authorized)])
    def extract(request: ExtractRequest):
        try:data=base64.b64decode(request.base64,validate=True)
        except Exception:raise HTTPException(400,'文件编码错误') from None
        if not data or len(data)>2_000_000:raise HTTPException(400,'文件大小须为1至2000000字节')
        suffix=Path(request.filename).suffix.lower()
        if suffix in ('.txt','.md'):
            try:text=data.decode('utf-8-sig')
            except UnicodeError:raise HTTPException(400,'仅接受UTF-8文本') from None
        elif suffix=='.pdf':
            try:
                process=subprocess.run([sys.executable,str(Path(__file__).with_name('pdf_extract.py'))],input=data,capture_output=True,timeout=8,check=False)
                result=json.loads(process.stdout)
                if process.returncode or 'text' not in result:raise ValueError()
                text=result['text']
            except Exception:raise HTTPException(400,'PDF无法安全解析，扫描件不在本版范围') from None
        else:raise HTTPException(400,'仅支持TXT、MD和文本PDF')
        text=text.replace('\x00','').strip()
        if not text or len(text)>100000:raise HTTPException(400,'文字长度须为1至100000字符')
        return {'text':text}
    return app
