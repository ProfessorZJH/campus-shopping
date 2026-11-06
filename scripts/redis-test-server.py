#!/usr/bin/env python3
"""为 RedisServerFaultIsolationTest 启动一次性隔离 Redis。

测试把 ``--bind/--port/--save/--appendonly`` 追加到命令末尾；本脚本只读取端口，
再通过 Docker 把容器 6379 映射到该本机端口。收到 SHUTDOWN 后容器退出，
``docker run`` 随之结束，满足测试对“子进程真实退出”的校验。
"""
import os
import sys
import uuid

IMAGE = os.getenv('REDIS_TEST_SERVER_IMAGE', 'redis:7-alpine')


def main():
    args = sys.argv[1:]
    try:
        port = int(args[args.index('--port') + 1])
    except (ValueError, IndexError):
        raise SystemExit('缺少 --port')
    if not (1 <= port <= 65535):
        raise SystemExit('端口无效')
    name = 'campus-redis-fault-' + str(port) + '-' + uuid.uuid4().hex[:8]
    command = [
        'docker', 'run', '--rm', '--name', name,
        '-p', f'127.0.0.1:{port}:6379',
        IMAGE, 'redis-server',
        '--bind', '0.0.0.0', '--port', '6379', '--save', '', '--appendonly', 'no',
    ]
    os.execvp(command[0], command)


if __name__ == '__main__':
    main()
