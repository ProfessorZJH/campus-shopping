"""仅供绑定本机的真实联调使用；正式 app.main 工厂的 TLS 校验保持不变。

必须由 scripts/run-local-live.py 显式传入本次已授权的 HTTP 主机名。
不替换任何模型、Milvus 或业务接口，唯一例外是本地验收的传输配置。
"""
from dataclasses import replace
import logging
import os
import time
from urllib.parse import urlparse

from .config import Settings
from .main import create_app as normal_app


def create_app():
    settings = Settings.from_env()
    allowed_host = os.getenv('AI_LOCAL_ACCEPTANCE_PLAINTEXT_MILVUS_HOST', '')
    if not allowed_host:
        return normal_app(settings)
    uri = urlparse(settings.milvus_uri)
    if (uri.scheme != 'http' or uri.hostname != allowed_host or uri.username or uri.password
            or uri.path not in ('', '/') or not settings.milvus_token
            or os.getenv('AI_LOCAL_ACCEPTANCE_BIND') != '127.0.0.1'):
        raise ValueError('本地验收 Milvus 例外配置不匹配')
    # main 工厂仍校验其余全部参数；同一个真实 ProductIndex 只恢复用户指定的连接。
    app = normal_app(replace(settings, milvus_uri='', milvus_token=''))
    app.state.products.settings = settings
    # 只记录错误类别及耗时，定位真实供应商降级；不记录请求、响应或凭据。
    complete = app.state.store.provider.complete
    logger = logging.getLogger('uvicorn.error')
    def observed_complete(system, payload):
        started = time.perf_counter()
        stage = 'answer' if 'candidates' in payload else 'recall'
        try:
            result = complete(system, payload)
        except Exception as exc:
            response = getattr(exc, 'response', None)
            logger.warning('acceptance_llm stage=%s result=failed type=%s http=%s duration_ms=%d',
                           stage, type(exc).__name__, getattr(response, 'status_code', None),
                           (time.perf_counter()-started)*1000)
            raise
        logger.info('acceptance_llm stage=%s result=success duration_ms=%d',
                    stage, (time.perf_counter()-started)*1000)
        return result
    app.state.store.provider.complete = observed_complete
    return app
