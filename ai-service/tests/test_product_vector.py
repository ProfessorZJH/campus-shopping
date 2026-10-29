"""SDD-08: 真实 Python HTTP/校验，Milvus 访问使用内存替身而非冒充真实数据库验收。"""
import httpx
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.product_index import ProductIndex
from app.retrieval import Provider
from app.main import create_app

KEY='vector-test-only-service-key-never-production'

def settings(tmp_path,**kw):
    return Settings(api_key=KEY,db_path=str(tmp_path/'knowledge.db'),**kw)

class FakeEmbedding:
    model_tag='nvidia/nemotron-3.5-embed-1b'
    def __init__(self):self.calls=[]
    def embed(self,texts,input_type='passage'):
        self.calls.append((list(texts),input_type))
        return [[1.0,0.0,0.0] if '乌龙茶' in t or '茶饮' in t else [0.0,1.0,0.0] for t in texts]

class FakeMilvus:
    def __init__(self):self.collections={};self.created=[];self.searched=[]
    def has_collection(self,collection_name):return collection_name in self.collections
    def create_collection(self,collection_name,dimension,**kwargs):
        self.created.append((collection_name,dimension,kwargs));self.collections[collection_name]={}
    def describe_collection(self,collection_name):return {'fields':[{'name':'vector','params':{'dim':'3'}}]}
    def query(self,collection_name,filter,output_fields,limit):
        return [{k:v for k,v in row.items() if k in output_fields} for row in self.collections[collection_name].values()]
    def upsert(self,collection_name,data):
        self.collections[collection_name].update({row['id']:row for row in data})
    def search(self,collection_name,data,filter,limit,output_fields,consistency_level):
        self.searched.append((filter,consistency_level))
        q=data[0]
        rows=sorted(self.collections[collection_name].values(),key=lambda r:sum(a*b for a,b in zip(q,r['vector'])),reverse=True)
        return [[{'id':r['id'],'distance':1.0} for r in rows[:limit] if r['model'] in filter]]

ITEMS=[{'productId':'old-101','merchantId':'m1','title':'无糖乌龙茶','description':'无糖 茶 饮料','categoryCode':'drink','specs':['500ml']},
       {'productId':'new-001','merchantId':'m2','title':'香辣牛肉面','description':'夜宵','categoryCode':'noodle','specs':['桶装']}]

def test_milvus_product_index_idempotent_and_semantic_recall(tmp_path):
    emb=FakeEmbedding();db=FakeMilvus()
    s=settings(tmp_path,milvus_uri='http://milvus:19530',milvus_token='test:fake',embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test-key',embedding_model=emb.model_tag)
    s.validate();index=ProductIndex(s,emb,db)
    assert index.upsert(ITEMS)=={'indexed':2,'unchanged':0,'mode':'MILVUS'}
    assert emb.calls[0][1]=='passage'
    assert index.upsert(ITEMS)['indexed']==0  # unchanged: no repeated embedding calls
    assert len(emb.calls)==1
    assert index.search('需要不含糖的茶饮',2)['productIds']==['old-101','new-001']
    assert emb.calls[-1][1]=='query'
    assert db.searched[-1][1]=='Strong'
    changed=[dict(ITEMS[0],description='无糖 零卡'),ITEMS[1]]
    assert index.upsert(changed)['indexed']==1
    assert len(db.collections[s.product_collection])==2


def test_milvus_missing_and_disabled_no_hallucination(tmp_path):
    emb=FakeEmbedding();db=FakeMilvus()
    s=settings(tmp_path,milvus_uri='http://milvus:19530',milvus_token='test:fake',embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test',embedding_model=emb.model_tag)
    assert ProductIndex(s,emb,db).search('无糖')=={'productIds':[],'mode':'EMPTY_INDEX'}
    s2=settings(tmp_path)
    assert ProductIndex(s2,emb,db).search('无糖')=={'productIds':[],'mode':'DISABLED'}


def test_milvus_rejects_plaintext_public_root_credentials(tmp_path):
    s=settings(tmp_path,milvus_uri='http://milvus.example.org:19530',milvus_token='root:secret',embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test',embedding_model='nvidia/nemotron-3.5-embed-1b')
    with pytest.raises(ValueError,match='公网 Milvus 必须使用 TLS'):
        s.validate()
    assert settings(tmp_path,milvus_uri='https://milvus.example.org:19530',milvus_token='app:secret',embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test',embedding_model='nvidia/nemotron-3.5-embed-1b').validate() is None
    assert settings(tmp_path,milvus_uri='http://127.0.0.1:19530',milvus_token='app:secret',embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test',embedding_model='nvidia/nemotron-3.5-embed-1b').validate() is None


def test_nvidia_embedding_passage_query_headers_and_payload(tmp_path,monkeypatch):
    from app import retrieval
    s=settings(tmp_path,embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test-key',embedding_model='nvidia/nemotron-3.5-embed-1b')
    sent=[]
    def handler(req):
        sent.append((req.url.path,dict(req.headers),req.content))
        return httpx.Response(200,json={'data':[{'index':0,'embedding':[0.2,0.8]}]})
    original=httpx.Client
    monkeypatch.setattr(retrieval.httpx,'Client',lambda **kw: original(transport=httpx.MockTransport(handler),**kw))
    provider=Provider(s)
    assert provider.embed(['无糖饮料'],'passage')==[[0.2,0.8]]
    assert provider.embed(['低糖夜宵'],'query')==[[0.2,0.8]]
    import json
    assert [json.loads(x[2])['input_type'] for x in sent]==['passage','query']
    assert all(x[0]=='/v1/embeddings' and x[1]['authorization']=='Bearer test-key' for x in sent)


def test_product_routes_service_key_and_offline_semantic_rerank(tmp_path):
    s=settings(tmp_path)
    app=create_app(s)
    with TestClient(app) as client:
        assert client.post('/v1/products/index',json={'products':ITEMS}).status_code==401
        ok=client.post('/v1/products/index',headers={'X-Service-Key':KEY},json={'products':ITEMS})
        assert ok.status_code==200 and ok.json()['mode']=='DISABLED'
        response=client.post('/v1/products/search',headers={'X-Service-Key':KEY},json={'query':'无糖', 'limit':80})
        assert response.status_code==200 and response.json()['productIds']==[]
        assert client.post('/v1/products/search',headers={'X-Service-Key':KEY},json={'query':'无糖','limit':999}).status_code==422
        # 无词面重合，仅因服务端可信的语义 SKU 白名单才纳入候选。
        offers=[{'skuId':'sku-old','merchantId':'m1','title':'无糖乌龙茶','specKey':'500ml','description':'香醇茶饮','priceCent':600,'available':2}]
        query={'question':'想要晚上不太刺激的饮品','allowedDocumentIds':[],'offers':offers,'semanticSkuIds':['sku-old']}
        data=client.post('/v1/query',headers={'X-Service-Key':KEY},json=query).json()
        assert data['recommendations'] and data['recommendations'][0]['skuId']=='sku-old'
        # 余额、库存仍强约束：向量命中也不能强行推荐不可售商品。
        query['offers'][0]['available']=0
        assert not client.post('/v1/query',headers={'X-Service-Key':KEY},json=query).json()['recommendations']


def test_vector_config_is_not_silently_disabled(tmp_path):
    with pytest.raises(ValueError,match="Milvus 的地址与凭据"):
        settings(tmp_path,milvus_uri='http://milvus:19530').validate()
    with pytest.raises(ValueError,match="完整 Embedding"):
        settings(tmp_path,milvus_uri='http://milvus:19530',milvus_token='app:secret').validate()

def test_product_index_dimension_mismatch_fails_closed(tmp_path):
    emb=FakeEmbedding();db=FakeMilvus()
    db.collections['campus_products_v1']={}
    db.describe_collection=lambda **kw:{'fields':[{'name':'vector','params':{'dim':'8'}}]}
    s=settings(tmp_path,milvus_uri='http://milvus:19530',milvus_token='test:fake',embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test',embedding_model=emb.model_tag)
    with pytest.raises(ValueError,match='维度'):
        ProductIndex(s,emb,db).upsert(ITEMS)

def test_fastapi_product_index_and_search_with_fake_milvus(tmp_path):
    s=settings(tmp_path,milvus_uri='http://milvus:19530',milvus_token='test:fake',embedding_url='https://integrate.api.nvidia.com/v1',embedding_key='test',embedding_model='nvidia/nemotron-3.5-embed-1b')
    app=create_app(s);fake=FakeMilvus();embedding=FakeEmbedding()
    app.state.products._client=fake
    app.state.products.provider=embedding
    with TestClient(app,headers={'X-Service-Key':KEY}) as client:
        first=client.post('/v1/products/index',json={'products':ITEMS})
        assert first.status_code==200 and first.json()['indexed']==2
        assert client.post('/v1/products/index',json={'products':ITEMS}).json()['unchanged']==2
        search=client.post('/v1/products/search',json={'query':'我想喝无糖茶饮','limit':2})
        assert search.status_code==200 and search.json()['productIds'][0]=='old-101'
