"""本次随机集合ownership；不访问既有商品集合，不沿用历史明文例外。"""
import secrets
from app.product_index import ProductIndex
from .provenance import RecordedClient


def collection_name(dataset_hash):
    return 'eval_' + dataset_hash[:12] + '_' + secrets.token_hex(8)


class OwnedIndex:
    def __init__(self, settings, provider, recorder, client=None, source='REAL'):
        self.settings, self.recorder = settings, recorder
        self.raw = client
        self.source = source
        self.created = False
        self.cleanup = 'NOT_CREATED'
        self.index = ProductIndex(settings, provider)

    def open(self, products):
        if self.raw is None:
            self.raw = self.index._connect()
        name = self.settings.product_collection
        self.index._client = RecordedClient(self.raw, self.recorder, self.source)
        if not name.startswith('eval_') or self.index._client.has_collection(collection_name=name):
            raise ValueError('collection ownership collision')
        # 先单独创建集合，再登记ownership；upsert失败时也可以安全清理。
        vector = self.index.provider.embed(['evaluation dimension probe'])[0]
        self.index._client.create_collection(collection_name=name, dimension=len(vector), id_type='string',
                                            max_length=64, metric_type='COSINE', auto_id=False)
        self.created = True
        self.index.upsert(products)
        return self.index

    def close(self):
        if self.created:
            try:
                # 清理不受推理预算限制；仍只删除成功创建且持有ownership的集合。
                self.raw.drop_collection(collection_name=self.settings.product_collection)
                self.cleanup = 'DELETED'
            except Exception as error:
                self.cleanup = 'FAILED:' + type(error).__name__
        if self.raw is not None and self.source == 'REAL':
            self.raw.close()

    def manifest(self):
        return dict(type='milvus-collection', name=self.settings.product_collection,
                    owned=self.created, source=self.source, cleanup=self.cleanup)
