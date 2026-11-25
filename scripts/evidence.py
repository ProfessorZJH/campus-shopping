"""测试证据输出策略：本地默认写忽略目录，CI 显式发布到跟踪目录。"""
from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROOT = ROOT / "var" / "verify"


def evidence_root() -> Path:
    """返回本次进程的证据根目录；相对配置按仓库根解析。"""
    configured = os.environ.get("CAMPUS_EVIDENCE_DIR", "").strip()
    path = Path(configured).expanduser() if configured else DEFAULT_ROOT
    return (path if path.is_absolute() else ROOT / path).resolve()


def evidence_dir(*parts: str) -> Path:
    """创建并返回证据目录。"""
    path = evidence_root().joinpath(*parts)
    path.mkdir(parents=True, exist_ok=True)
    return path


def evidence_path(*parts: str) -> Path:
    """返回证据文件路径，并只创建其父目录。"""
    path = evidence_root().joinpath(*parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
