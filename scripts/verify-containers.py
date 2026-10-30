#!/usr/bin/env python3
"""构建并验收实际交付镜像，使用独立 Compose 项目、随机凭据/端口及临时卷。"""
import argparse
import json
import os
import re
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'docs/testing/evidence/engineering/containers.json')
    args = parser.parse_args()
    project = 'campus-check-' + uuid.uuid4().hex[:12]
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    report_path = args.output
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {'status': 'FAIL', 'testType': 'ISOLATED_REAL_DELIVERY_IMAGES', 'existingDatabaseUsed': False}
    try:
        ready = subprocess.run(['docker', 'info'], capture_output=True, timeout=20).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        ready = False
    if not ready:
        report.update(status='NOT_RUN', reason='Docker Engine unavailable')
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        raise SystemExit('Docker Engine unavailable; delivery image acceptance NOT_RUN')
    env = os.environ.copy()
    # 不继承开发机上的付费供应商、数据库或管理员配置。
    compose_keys = set(re.findall(r'\$\{([A-Z_]+)', (ROOT/'compose.yml').read_text('utf-8')))
    for name in tuple(env):
        if name in compose_keys or name.startswith(('LLM_', 'EMBEDDING_', 'MILVUS_', 'QDRANT_', 'DB_', 'ADMIN_', 'AI_SERVICE_', 'COMPOSE_')):
            env.pop(name)
    with tempfile.TemporaryDirectory(prefix='campus-container-check-') as directory:
        config = Path(directory)/'compose.env'
        values = {'APP_PORT': str(port), 'DB_PASSWORD': secrets.token_hex(24),
                  'MYSQL_ROOT_PASSWORD': secrets.token_hex(24), 'AI_SERVICE_KEY': secrets.token_hex(32),
                  'ADMIN_USERNAME': 'container_admin', 'ADMIN_PASSWORD': secrets.token_hex(24),
                  'BOOTSTRAP_ADMIN': 'true', 'SESSION_COOKIE_SECURE': 'false', 'AI_PRODUCT_VECTOR_SYNC_ENABLED': 'false',
                  'QDRANT_API_KEY': secrets.token_hex(24)}
        config.write_text(''.join(f'{key}={value}\n' for key,value in values.items()), encoding='utf-8')
        command = ['docker', 'compose', '--project-name', project, '--env-file', str(config), '-f', str(ROOT/'compose.yml')]
        try:
            subprocess.run(command+['up', '--build', '--wait', '--wait-timeout', '240'], cwd=ROOT, env=env, check=True)
            subprocess.run([sys.executable, '-X', 'utf8', str(ROOT/'scripts/smoke-full.py'),
                            '--base-url', f'http://127.0.0.1:{port}', '--env-file', str(config),
                            '--output', str(report_path.parent/'container-http.json'), '--check-contract'],
                           cwd=ROOT, env=env, check=True)
            http = json.loads((report_path.parent/'container-http.json').read_text('utf-8'))
            report.update(status=http['status'], httpChecks=len(http['checks']))
        finally:
            logs = subprocess.run(command+['logs', '--no-color'], cwd=ROOT, env=env,
                                  stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding='utf-8', errors='replace').stdout
            for name, value in values.items():
                if any(word in name for word in ('PASSWORD', 'KEY', 'TOKEN')):
                    logs = logs.replace(value, '[REDACTED]')
            (report_path.parent/'containers.log').write_text(logs, encoding='utf-8')
            # 只清理本次随机项目的临时卷。
            try:
                subprocess.run(command+['down', '--volumes', '--remove-orphans'], cwd=ROOT, env=env, check=True)
            finally:
                report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


if __name__ == '__main__':main()
