#!/usr/bin/env python3
"""为本地 Docker 演示生成随机凭据；绝不覆盖已有配置，也不把密码输出到终端。"""
import argparse
import os
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]

def generate(destination: Path):
    values = {
        'REDIS_SECURITY_PASSWORD': secrets.token_urlsafe(32),
        'REDIS_CACHE_PASSWORD': secrets.token_urlsafe(32),
        'DB_PASSWORD': secrets.token_urlsafe(32),
        'MYSQL_ROOT_PASSWORD': secrets.token_urlsafe(32),
        'AI_SERVICE_KEY': secrets.token_urlsafe(48),
        'ADMIN_PASSWORD': secrets.token_urlsafe(24),
        'QDRANT_API_KEY': secrets.token_urlsafe(32),
    }
    text = (ROOT / '.env.example').read_text(encoding='utf-8')
    for key, value in values.items():
        text = text.replace(key + '=\n', key + '=' + value + '\n')
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as output:
        output.write(text)
    print('已生成配置：', destination)
    print('管理员用户名和密码保存在该文件，请妥善保管；本脚本没有执行部署。')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.env')
    args = parser.parse_args()
    try:
        generate(args.output.resolve())
    except FileExistsError:
        parser.exit(1, '配置已存在，未覆盖；请按需要手动合并新的配置项。\n')