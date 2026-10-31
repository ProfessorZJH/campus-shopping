"""创建并清理本次专用Qdrant容器；本地字符向量，不调用真实模型。"""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ai-service'))
import httpx
from app.config import Settings
from app.retrieval import KnowledgeStore, local_vector


def main():
    output = ROOT / 'var/supply-chain/qdrant-recovery.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {'status': 'FAIL', 'testType': 'ISOLATED_REAL_QDRANT_LOCAL_EMBEDDING', 'checks': []}
    try:
        available = subprocess.run(['docker', 'info'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        available = False
    if not available:
        report.update(status='NOT_RUN', reason='Docker Engine unavailable')
        output.write_text(json.dumps(report, indent=2) + '\n', 'utf-8')
        raise SystemExit('Docker Engine unavailable; Qdrant acceptance NOT_RUN')
    name = 'campus-qdrant-check-' + uuid.uuid4().hex[:12]
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    key = secrets.token_hex(32)
    env = {**os.environ, 'QDRANT__SERVICE__API_KEY': key}
    image = json.loads((ROOT / 'supply-chain/images.lock.json').read_text('utf-8'))['images']['qdrant/qdrant:v1.13.4']['digest']
    def docker(*args):
        subprocess.run(['docker', *args], env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    def ready(store):
        for _ in range(60):
            try:
                store._qdrant('GET', '/collections')
                return
            except httpx.HTTPError:
                time.sleep(1)
        raise RuntimeError('isolated Qdrant not ready')
    try:
        docker('run', '-d', '--name', name, '-p', f'127.0.0.1:{port}:6333', '-e', 'QDRANT__SERVICE__API_KEY',
               'qdrant/qdrant:v1.13.4@' + image)
        with tempfile.TemporaryDirectory(prefix='campus-qdrant-') as directory:
            store = KnowledgeStore(Settings(secrets.token_hex(32), str(Path(directory) / 'knowledge.db'),
                                            qdrant_url=f'http://127.0.0.1:{port}', qdrant_key=key))
            try:
                ready(store)
                with httpx.Client(trust_env=False) as client:
                    assert client.get(f'http://127.0.0.1:{port}/collections').status_code in (401, 403)
                report['checks'].append('unauthorized requests rejected')
                store.index('public', '自提', '合成测试商品到店自提', external_allowed=True)
                store.index('public', '自提', '合成测试商品到店自提', external_allowed=True)
                base = '/collections/' + store.settings.collection
                assert store._qdrant('POST', base + '/points/count', {'exact': True})['count'] == 1
                result = store._qdrant('POST', base + '/points/query', {'query': local_vector('到店自提'), 'limit': 5,
                    'filter': {'must': [{'key': 'document_id', 'match': {'value': 'public'}}]}})
                assert len(result['points']) == 1
                report['checks'].append('actual vector write, idempotent replay and filtered query')
                store.index('private', '内部', '内部资料默认不外发')
                assert store._qdrant('POST', base + '/points/count', {'exact': True})['count'] == 1
                report['checks'].append('unapproved document did not reach Qdrant')
                docker('stop', name)
                try:
                    store.index('retry', '恢复', '服务恢复后重试', external_allowed=True)
                except httpx.HTTPError:
                    pass
                else:
                    raise AssertionError('dependency outage must fail indexing')
                assert store.db.execute("SELECT COUNT(*) FROM docs WHERE id='retry'").fetchone()[0] == 0
                assert store.search('内部资料', ['private'])[0]
                report['checks'].append('outage does not record index success; local private retrieval survives')
                docker('start', name)
                ready(store)
                store.index('retry', '恢复', '服务恢复后重试', external_allowed=True)
                store.delete('public')
                assert store._qdrant('POST', base + '/points/count', {'exact': True})['count'] == 1
                report['checks'].append('restart, retry and deletion succeed')
                report['status'] = 'PASS'
            finally:
                store.close()
    except Exception as error:
        report['errorType'] = type(error).__name__
        raise SystemExit('Qdrant acceptance failed: ' + type(error).__name__) from None
    finally:
        # 名称由本进程随机生成，不读取或清理既有容器/卷。
        try:
            docker('rm', '-f', '-v', name)
        finally:
            output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps({'status': report['status'], 'checks': len(report['checks'])}))


if __name__ == '__main__':
    main()
