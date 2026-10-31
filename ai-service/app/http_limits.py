"""先限制实际读取字节再解析JSON；拒绝压缩响应以限制解压分配。"""
import json


def bounded_json(client, method, url, *, limit, headers=None, **kwargs):
    headers = {**(headers or {}), 'Accept-Encoding': 'identity'}
    with client.stream(method, url, headers=headers, **kwargs) as response:
        response.raise_for_status()
        if response.headers.get('content-encoding', 'identity').lower() not in ('', 'identity'):
            raise ValueError('供应商响应编码不受支持')
        length = response.headers.get('content-length')
        if length is not None and (not length.isdigit() or int(length) > limit):
            raise ValueError('供应商响应超过容量限制')
        data = bytearray()
        for part in response.iter_bytes(chunk_size=65536):
            if len(part) > limit - len(data):
                raise ValueError('供应商响应超过容量限制')
            data.extend(part)
        result = json.loads(data)
        if not isinstance(result, dict):
            raise ValueError('供应商响应格式无效')
        return result
