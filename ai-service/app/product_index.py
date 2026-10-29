"""Isolated semantic product index. Only Java supplies public catalog facts; Milvus is not the source of price/stock truth."""
from __future__ import annotations
import hashlib,json
from .config import Settings
from .retrieval import Provider

class ProductIndex:
    def __init__(self,settings: Settings,provider: Provider,client=None):
        self.settings=settings
        self.provider=provider
        self._client=client

    @property
    def enabled(self):
        return bool(self.settings.milvus_uri and self.settings.embedding_key)

    def _connect(self):
        if self._client is None:
            from pymilvus import MilvusClient  # imported only for Milvus deployments
            self._client=MilvusClient(uri=self.settings.milvus_uri,token=self.settings.milvus_token,timeout=10)
        return self._client

    def _collection(self,dimension: int):
        client=self._connect(); name=self.settings.product_collection
        if not client.has_collection(collection_name=name):
            client.create_collection(collection_name=name,dimension=dimension,id_type="string",max_length=64,
                                     metric_type="COSINE",auto_id=False)
        else:
            desc=client.describe_collection(collection_name=name)
            vector=next((f for f in desc.get('fields',[]) if f.get('name')=='vector'),None)
            params=(vector or {}).get('params') or {}
            declared=params.get('dim') or params.get('dimension')
            if declared and int(declared)!=dimension:
                raise ValueError('商品集合维度与当前 embedding 模型不一致，请新建版本化集合')

    @staticmethod
    def _doc(product):
        specs=' '.join(product['specs'])
        return ('商品 '+product['title']+' 类目 '+product['categoryCode']+' 规格 '+specs+' '+product['description'][:800])[:1800]

    def upsert(self,products: list[dict]) -> dict:
        if not self.enabled:return {'indexed':0,'unchanged':0,'mode':'DISABLED'}
        if not products:return {'indexed':0,'unchanged':0,'mode':'MILVUS'}
        client=self._connect();collection=self.settings.product_collection
        ids=[p['productId'] for p in products]
        if len(set(ids))!=len(ids):raise ValueError('商品 ID 重复')
        fingerprints={p['productId']:hashlib.sha256((self.provider.model_tag+'\0'+self._doc(p)).encode()).hexdigest() for p in products}
        existing={}
        if client.has_collection(collection_name=collection):
            for item in client.query(collection_name=collection,filter='id in '+json.dumps(ids),
                                     output_fields=['id','fingerprint','model'],limit=max(1,len(ids))):
                existing[item['id']]=item
        changed=[p for p in products if not (existing.get(p['productId'],{}).get('fingerprint')==fingerprints[p['productId']]
                                            and existing[p['productId']].get('model')==self.provider.model_tag)]
        if not changed:return {'indexed':0,'unchanged':len(products),'mode':'MILVUS'}
        vectors=self.provider.embed([self._doc(p) for p in changed],input_type='passage')
        self._collection(len(vectors[0]))
        data=[{'id':p['productId'],'vector':vector,'model':self.provider.model_tag,
               'fingerprint':fingerprints[p['productId']]} for p,vector in zip(changed,vectors)]
        client.upsert(collection_name=collection,data=data)
        return {'indexed':len(changed),'unchanged':len(products)-len(changed),'mode':'MILVUS'}

    def search(self,query: str,limit: int=80) -> dict:
        if not self.enabled:return {'productIds':[],'mode':'DISABLED'}
        client=self._connect();collection=self.settings.product_collection
        if not client.has_collection(collection_name=collection):return {'productIds':[],'mode':'EMPTY_INDEX'}
        vector=self.provider.embed([query],input_type='query')[0]
        hits=client.search(collection_name=collection,data=[vector],filter='model == '+json.dumps(self.provider.model_tag),
                           limit=limit,output_fields=[],consistency_level='Strong')
        ids=[str(hit['id']) for hit in hits[0] if hit.get('id')]
        return {'productIds':list(dict.fromkeys(ids))[:limit],'mode':'MILVUS'}
