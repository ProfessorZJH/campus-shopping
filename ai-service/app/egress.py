"""外发最小化与元数据审计；不记录正文、问题、密钥或完整地址。"""
import json
import re
from urllib.parse import urlsplit
from .observability import logger, request_id


PII_PATTERN = re.compile(
    r'(?<!\d)(?:\+?86[\s-]?)?1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}(?!\d)'
    r'|(?<!\d)0\d{2,3}-\d{7,8}(?!\d)'
    r'|(?<!\d)\d{17}[\dXx](?!\d)'
    r'|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}'
)


def redact_pii(text: str) -> str:
    return PII_PATTERN.sub('[已脱敏]', text)


def minimized(value, key=''):
    if isinstance(value, dict):
        return {k: minimized(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [minimized(v, key) for v in value]
    if isinstance(value, str) and key not in ('skuId', 'merchantId', 'documentId', 'chunkId'):
        value = redact_pii(value)
        return value[:2000]
    return value


def audit(url, purpose, records, payload):
    provider = urlsplit(url).hostname or 'configured-provider'
    size = len(json.dumps(payload, ensure_ascii=False).encode('utf-8'))
    logger.info('ai_egress provider=%s purpose=%s records=%d bytes=%d request_id=%s',
                provider, purpose, records, size, request_id.get())
