#!/usr/bin/env python3
"""本地一键构建启动；不删除数据库卷，也不声称启动等于业务验收。"""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def read_env(path):
    values = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip()
    return values

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vector', action='store_true', help='同时启动 Qdrant；需配置 QDRANT_URL')
    args = parser.parse_args()
    if not shutil.which('docker'):
        parser.exit(2, '未找到 Docker。没有执行构建或启动。\n')
    subprocess.run(['docker', 'compose', 'version'], check=True, cwd=ROOT)
    if not (ROOT / '.env').exists():
        spec = importlib.util.spec_from_file_location('generate_env', ROOT / 'scripts/generate-env.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        module.generate(ROOT / '.env')
    env = read_env(ROOT / '.env')
    if args.vector and not env.get('QDRANT_URL'):
        parser.exit(2, '启用 --vector 前请在 .env 设置 QDRANT_URL=http://qdrant:6333。\n')
    command = ['docker', 'compose'] + (['--profile', 'vector'] if args.vector else [])
    subprocess.run(command + ['config', '--quiet'], check=True, cwd=ROOT)
    subprocess.run(command + ['up', '--build', '-d'], check=True, cwd=ROOT)
    base = 'http://127.0.0.1:' + env.get('APP_PORT', '8091')
    for _ in range(90):
        try:
            with urllib.request.urlopen(base + '/api/v1/categories', timeout=3) as response:
                if json.load(response).get('code') == '0000':
                    print('应用及数据库健康检查通过：', base)
                    print('这不是完整业务验收；执行 python scripts/smoke-full.py 继续检查核心流程。')
                    return
        except Exception:
            pass
        time.sleep(2)
    raise SystemExit('服务未通过健康检查。查看 docker compose logs app mysql ai；没有宣称启动成功。')

if __name__ == '__main__': main()