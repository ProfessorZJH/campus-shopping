"""外发最小化与元数据审计；不记录正文、问题、密钥或完整地址。"""
import json
import re
from urllib.parse import urlsplit
from .observability import logger, request_id


def minimized(value, key=''):
    if isinstance(value, dict):
        return {k: minimized(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [minimized(v, key) for v in value]
    if isinstance(value, str) and key not in ('skuId', 'merchantId', 'documentId', 'chunkId'):
        value = re.sub(r'(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[已脱敏]', value)
        return value[:2000]
    return value


def audit(url, purpose, records, payload):
    provider = urlsplit(url).hostname or 'configured-provider'
    size = len(json.dumps(payload, ensure_ascii=False).encode('utf-8'))
    logger.info('ai_egress provider=%s purpose=%s records=%d bytes=%d request_id=%s',
                provider, purpose, records, size, request_id.get())
