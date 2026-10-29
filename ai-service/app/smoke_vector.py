"""仅检测私有 Embedding / Milvus 连接，不写入向量库，也不输出密码、token 或商品数据。"""
from __future__ import annotations
import json
from .config import Settings
from .retrieval import Provider
from .product_index import ProductIndex

def main():
    s=Settings.from_env();s.validate()
    product=ProductIndex(s,Provider(s))
    if not product.enabled:
        print('NOT_CONFIGURED: 需同时设置 NVIDIA Embedding 和安全 Milvus 连接');return 2
    try:
        vector=product.provider.embed(['校园商城 无糖茶饮'],input_type='query')[0]
        client=product._connect()
        exists=client.has_collection(collection_name=s.product_collection)
        print(json.dumps({'status':'REACHABLE','embeddingDimension':len(vector),'productCollectionExists':bool(exists)},ensure_ascii=False))
        return 0
    except Exception:
        print('UNAVAILABLE: 模型或向量库不可用，请在私有环境检查网络、模型授权与 TLS 配置')
        return 1

if __name__=='__main__':
    raise SystemExit(main())
