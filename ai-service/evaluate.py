"""统一评测入口。无参数保留8例legacy-demo，历史证据永不覆盖。"""
import os
import subprocess
import sys

from evaluation.cli import main

if __name__ == "__main__":
    # 生产BM25遍历set时的浮点累加顺序受进程哈希种子影响；只固定评测进程，保持生产算法不变。
    if os.environ.get('PYTHONHASHSEED') != '20261031':
        env = dict(os.environ, PYTHONHASHSEED='20261031')
        raise SystemExit(subprocess.run([sys.executable, '-X', 'utf8', __file__, *sys.argv[1:]], env=env).returncode)
    raise SystemExit(main())
