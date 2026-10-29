"""配置只从服务端环境读取，不接受前端指定模型服务地址或密钥。"""
from dataclasses import dataclass
import os
from pathlib import Path

@dataclass(frozen=True)
class Settings:
    api_key: str
    db_path: str
    qdrant_url: str = ""
    qdrant_key: str = ""
    collection: str = "campus_knowledge_v1"
    embedding_url: str = ""
    embedding_key: str = ""
    embedding_model: str = ""
    llm_url: str = ""
    llm_key: str = ""
    llm_model: str = ""
    milvus_uri: str = ""
    milvus_token: str = ""
    product_collection: str = "campus_products_v1"

    @classmethod
    def from_env(cls):
        return cls(api_key=os.getenv("AI_SERVICE_KEY", ""),db_path=os.getenv("AI_DB_PATH", "./var/knowledge.sqlite3"),
            qdrant_url=os.getenv("QDRANT_URL", "").rstrip("/"),qdrant_key=os.getenv("QDRANT_API_KEY", ""),
            collection=os.getenv("QDRANT_COLLECTION", "campus_knowledge_v1"),
            embedding_url=os.getenv("EMBEDDING_BASE_URL", "").rstrip("/"),embedding_key=os.getenv("EMBEDDING_API_KEY", ""),embedding_model=os.getenv("EMBEDDING_MODEL", ""),
            llm_url=os.getenv("LLM_BASE_URL", "").rstrip("/"),llm_key=os.getenv("LLM_API_KEY", ""),llm_model=os.getenv("LLM_MODEL", ""),
            milvus_uri=os.getenv("MILVUS_URI", "").rstrip("/"),milvus_token=os.getenv("MILVUS_TOKEN", ""),
            product_collection=os.getenv("MILVUS_PRODUCT_COLLECTION", "campus_products_v1"))
    def validate(self):
        if len(self.api_key)<24:
            raise ValueError("必须设置至少24位 AI_SERVICE_KEY，且与 Java 端一致")
        import re
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}",self.collection):
            raise ValueError("非法向量集合名")
        for prefix in ("embedding", "llm"):
            values=[getattr(self,prefix+"_"+x) for x in ("url","key","model")]
            if any(values) and not all(values):
                raise ValueError(prefix+" 的地址、密钥、模型名称必须同时配置")
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", self.product_collection):
            raise ValueError("非法 Milvus 商品集合名")
        if bool(self.milvus_uri)!=bool(self.milvus_token):
            raise ValueError("Milvus 的地址与凭据必须一起配置")
        if self.milvus_uri and not (self.embedding_url and self.embedding_key and self.embedding_model):
            raise ValueError("Milvus 商品语义索引必须配置完整 Embedding 模型")
        if self.milvus_uri:
            from urllib.parse import urlparse
            from ipaddress import ip_address
            parsed=urlparse(self.milvus_uri)
            host=parsed.hostname or ""
            if parsed.scheme not in ("http", "https") or not host or parsed.username or parsed.password or parsed.path not in ("", "/"):
                raise ValueError("Milvus 连接地址无效")
            if not self.milvus_token:
                raise ValueError("Milvus 必须配置私有凭据")
            if parsed.scheme=="http":
                try: private=ip_address(host).is_private or ip_address(host).is_loopback
                except ValueError: private=(host in ("localhost", "milvus") or host.endswith((".internal", ".svc", ".svc.cluster.local")))
                if not private:raise ValueError("公网 Milvus 必须使用 TLS 或私有隧道，不能通过 HTTP 传送密码")
        Path(self.db_path).parent.mkdir(parents=True,exist_ok=True)
