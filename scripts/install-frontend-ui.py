#!/usr/bin/env python3
"""兼容入口：每次同步均先从最新源码构建，禁止直接发布旧 bundle。"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('build-ui-bundle.py')), run_name='__main__')
