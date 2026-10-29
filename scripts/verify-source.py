#!/usr/bin/env python3
"""旧检查入口兼容转发，完整规则已集中到 verify-release.py。"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("verify-release.py")), run_name="__main__")
