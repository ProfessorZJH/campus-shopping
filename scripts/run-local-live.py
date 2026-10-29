#!/usr/bin/env python3
"""启动真实 Java/MySQL/AI 本地验收服务；不初始化或清空数据库。

凭据只读取本地 .env；服务绑定 127.0.0.1，日志及 PID 存在忽略目录 var。
"""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-plaintext-milvus-for-acceptance', action='store_true')
    args = parser.parse_args()
    env = os.environ.copy()
    for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines():
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env[key] = value
    directory = ROOT / 'var/local-live'
    directory.mkdir(parents=True, exist_ok=True)
    for port in (8091, 8100):
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1', port)) == 0:
                parser.error(f'本机 {port} 已被占用；未覆盖现有服务')
    if args.allow_plaintext_milvus_for_acceptance:
        parsed = urlparse(env.get('MILVUS_URI', ''))
        if parsed.scheme != 'http' or not parsed.hostname:
            parser.error('验收例外要求显式配置现有 HTTP Milvus 地址')
        env['AI_LOCAL_ACCEPTANCE_PLAINTEXT_MILVUS_HOST'] = parsed.hostname
    env.update(AI_LOCAL_ACCEPTANCE_BIND='127.0.0.1', SPRING_PROFILES_ACTIVE='dev',
               AI_SERVICE_URL='http://127.0.0.1:8100', DB_INIT_MODE='never',
               SESSION_COOKIE_SECURE='false')
    python = ROOT / 'var/venv-ai-live/Scripts/python.exe' if os.name == 'nt' else Path(sys.executable)
    commands = {
        'ai': [str(python), '-m', 'uvicorn', 'app.local_acceptance:create_app', '--factory',
               '--host', '127.0.0.1', '--port', '8100'],
        'java': ['java', '-jar', str(ROOT / 'campus-shopping-app/target/campus-shopping-app.jar'),
                 '--spring.profiles.active=dev', '--server.address=127.0.0.1',
                 '--campus.ai.product-sync.enabled=true', '--campus.ai.product-sync.initial-delay-ms=5000',
                 '--campus.ai.product-sync.period-ms=15000'],
    }
    children = {}
    logs = []
    try:
        for name, command in commands.items():
            log = (directory / (name + '.log')).open('ab', buffering=0)
            logs.append(log)
            children[name] = subprocess.Popen(command, cwd=ROOT/'ai-service' if name=='ai' else ROOT,
                env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        (directory / 'runtime.json').write_text(json.dumps({
            'supervisorPid': os.getpid(), 'processIds': {k:v.pid for k,v in children.items()},
            'baseUrl': 'http://127.0.0.1:8091', 'database': 'campus_shopping',
            'milvusTransportException': bool(args.allow_plaintext_milvus_for_acceptance),
            'productSyncEnabledForThisProcess': True,
        }, indent=2), encoding='utf-8')
        print('Started local acceptance services; logs: var/local-live; credentials not printed.', flush=True)
        while all(p.poll() is None for p in children.values()):
            time.sleep(1)
        print('A service exited; inspect private local logs.', flush=True)
        return 1
    except KeyboardInterrupt:
        return 0
    finally:
        for process in children.values():
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True)
                else:
                    process.terminate()
                process.wait(timeout=10)
        for log in logs:
            log.close()


if __name__ == '__main__':
    raise SystemExit(main())
