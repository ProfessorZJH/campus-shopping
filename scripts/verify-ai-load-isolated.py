"""本地SQLite/字符检索真实HTTP小规模负载与重启恢复，不代表生产性能。"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import secrets
import socket
import statistics
import subprocess
import sys
import tempfile
import time

import httpx

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'var/supply-chain/ai-load-recovery.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {'status': 'FAIL', 'testType': 'ISOLATED_HTTP_LOCAL_SQLITE_CHAR_RETRIEVAL', 'productionCapacity': 'NOT_RUN'}
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    key = secrets.token_hex(32)
    env = {k: v for k, v in os.environ.items() if not k.startswith(('AI_', 'LLM_', 'EMBEDDING_', 'QDRANT_', 'MILVUS_'))}
    process = None
    with tempfile.TemporaryDirectory(prefix='campus-ai-load-') as directory:
        env.update(AI_SERVICE_KEY=key, AI_DB_PATH=str(Path(directory) / 'knowledge.db'), AI_MAX_CONCURRENT_REQUESTS='2')
        with open(Path(directory) / 'service.log', 'wb') as log, httpx.Client(base_url=base, headers={'X-Service-Key': key}, trust_env=False, timeout=30) as client:
            def stop():
                if process is not None and process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=10)
            def start():
                nonlocal process
                process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:create_app', '--factory',
                    '--host', '127.0.0.1', '--port', str(port), '--no-access-log', '--log-level', 'error'],
                    cwd=ROOT / 'ai-service', env=env, stdout=log, stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
                for _ in range(60):
                    if process.poll() is not None:
                        raise RuntimeError('isolated service exited')
                    try:
                        if client.get('/ready').status_code == 200:
                            return
                    except httpx.HTTPError:
                        pass
                    time.sleep(.5)
                raise RuntimeError('isolated service startup timeout')
            try:
                start()
                for n in range(6):
                    response = client.post('/v1/index', json={'documentId': f'load-{n}', 'title': '合成自提说明',
                        'content': ('到店自提订单退款政策合成负载测试。' * 300)})
                    response.raise_for_status()
                payload = {'question': '到店自提退款政策', 'retrievalQuery': '到店自提退款政策',
                           'allowedDocumentIds': [f'load-{n}' for n in range(6)], 'offers': []}
                def query(_):
                    start_time = time.perf_counter()
                    response = client.post('/v1/query', json=payload)
                    if response.status_code == 200:
                        assert response.json()['citations']
                    return response.status_code, (time.perf_counter() - start_time) * 1000
                started = time.perf_counter()
                with ThreadPoolExecutor(max_workers=12) as pool:
                    samples = list(pool.map(query, range(80)))
                elapsed = time.perf_counter() - started
                assert all(status in (200, 429) for status, _ in samples), 'unexpected dependency/server failure'
                accepted = [latency for status, latency in samples if status == 200]
                assert accepted
                readiness = client.get('/ready').json()
                assert readiness['execution']['active'] == 0
                stop()
                start()
                restored = client.post('/v1/query', json=payload)
                assert restored.status_code == 200 and restored.json()['citations']
                ordered = sorted(accepted)
                report.update(status='PASS', requests=80, clients=12, capacity=2, accepted=len(accepted),
                    rejected=sum(status == 429 for status, _ in samples), durationSeconds=round(elapsed, 3),
                    acceptedP50Ms=round(statistics.median(accepted), 2), acceptedP95Ms=round(ordered[min(len(ordered)-1, int(len(ordered)*.95))], 2),
                    execution=readiness['execution'], persistedRetrievalAfterRestart=True)
            except Exception as error:
                report['errorType'] = type(error).__name__
                raise SystemExit('Isolated AI load verification failed: ' + type(error).__name__) from None
            finally:
                stop()
                output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
