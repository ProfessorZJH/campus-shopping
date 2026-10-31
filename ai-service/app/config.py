"""配置只从服务端环境读取，不接受前端指定模型服务地址或密钥。"""
from dataclasses import dataclass
import os
from pathlib import Path
from ipaddress import ip_address
from urllib.parse import urlsplit


def validate_service_url(url: str, label: str, trusted_http_hosts: tuple[str, ...], *, root_only: bool = False):
    """只信任明确配置的内网 HTTP 对端；不解析 DNS 来猜测传输是否安全。"""
    if not url:
        return
    try:
        parsed = urlsplit(url)
        host = parsed.hostname
        port = parsed.port
    except ValueError:
        raise ValueError(label + ' 连接地址无效') from None
    if (parsed.scheme not in ('https', 'http') or not host or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment or '\\' in url
            or any(c.isspace() or ord(c) < 32 for c in url)
            or (root_only and parsed.path not in ('', '/'))):
        raise ValueError(label + ' 连接地址无效，不允许内嵌凭据、查询或片段')
    if parsed.scheme == 'http':
        try:
            loopback = ip_address(host).is_loopback
        except ValueError:
            loopback = host == 'localhost'
        if not loopback and host not in trusted_http_hosts:
            raise ValueError('公网 ' + label + ' 必须使用 TLS；内网 HTTP 须加入 AI_TRUSTED_HTTP_HOSTS')

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
    max_concurrent_requests: int = 4
    llm_timeout_seconds: int = 60
    trusted_http_hosts: tuple[str, ...] = ('milvus', 'qdrant')

    @classmethod
    def from_env(cls):
        return cls(api_key=os.getenv("AI_SERVICE_KEY", ""),db_path=os.getenv("AI_DB_PATH", "./var/knowledge.sqlite3"),
            qdrant_url=os.getenv("QDRANT_URL", "").rstrip("/"),qdrant_key=os.getenv("QDRANT_API_KEY", ""),
            collection=os.getenv("QDRANT_COLLECTION", "campus_knowledge_v1"),
            embedding_url=os.getenv("EMBEDDING_BASE_URL", "").rstrip("/"),embedding_key=os.getenv("EMBEDDING_API_KEY", ""),embedding_model=os.getenv("EMBEDDING_MODEL", ""),
            llm_url=os.getenv("LLM_BASE_URL", "").rstrip("/"),llm_key=os.getenv("LLM_API_KEY", ""),llm_model=os.getenv("LLM_MODEL", ""),
            milvus_uri=os.getenv("MILVUS_URI", "").rstrip("/"),milvus_token=os.getenv("MILVUS_TOKEN", ""),
            product_collection=os.getenv("MILVUS_PRODUCT_COLLECTION", "campus_products_v1"),
            max_concurrent_requests=int(os.getenv("AI_MAX_CONCURRENT_REQUESTS", "4")),
            llm_timeout_seconds=int(os.getenv("LLM_TIMEOUT_SECONDS", "60")),
            trusted_http_hosts=tuple(x.strip().lower() for x in os.getenv('AI_TRUSTED_HTTP_HOSTS', 'milvus,qdrant').split(',') if x.strip()))
    def validate(self):
        if not 1<=self.max_concurrent_requests<=32:raise ValueError("AI_MAX_CONCURRENT_REQUESTS 必须为1至32")
        if len(self.api_key)<24:
            raise ValueError("必须设置至少24位 AI_SERVICE_KEY，且与 Java 端一致")
        if not 5<=self.llm_timeout_seconds<=60:
            raise ValueError("LLM_TIMEOUT_SECONDS 必须为5至60秒，保留 Java 网关的检索超时余量")
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
        for url, label, root_only in ((self.llm_url, 'LLM', False), (self.embedding_url, 'Embedding', False),
                                      (self.qdrant_url, 'Qdrant', True), (self.milvus_uri, 'Milvus', True)):
            validate_service_url(url, label, self.trusted_http_hosts, root_only=root_only)
        if self.qdrant_url and not self.qdrant_key:
            raise ValueError('Qdrant 必须配置访问凭据')
        Path(self.db_path).parent.mkdir(parents=True,exist_ok=True)
