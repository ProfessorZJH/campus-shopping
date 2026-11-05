#!/usr/bin/env python3
"""从唯一 frontend/src 构建同源 UI；--check 拒绝源码/快照漂移，--out 用于独立构建。"""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / 'frontend'
STATIC = ROOT / 'campus-shopping-app/src/main/resources/static'


def _node_cmd():
    pi_node = Path('/mnt/c/Users/Profe/AppData/Local/pi-node/current/node.exe')
    return str(pi_node) if pi_node.is_file() else 'node'

def _to_win_path(p):
    s = str(p)
    if s.startswith('/mnt/'):
        drive = s[5].upper()
        return drive + ':' + s[6:].replace('/', '\\')
    return s

def _node_cmd():
    pi_node = Path('/mnt/c/Users/Profe/AppData/Local/pi-node/current/node.exe')
    return str(pi_node) if pi_node.is_file() else 'node'

def build(output):
    cmd = _node_cmd()
    script = _to_win_path(UI/'scripts/build.mjs') if cmd.endswith('.exe') else str(UI/'scripts/build.mjs')
    out_arg = '--out=' + (_to_win_path(output) if cmd.endswith('.exe') else str(output))
    subprocess.run([cmd, script, out_arg], check=True, cwd=ROOT)
def snapshots(output, check=False):
    mappings = [(output/'ui.bundle.js', UI/'ui.bundle.js'), (output/'ui-build.json', UI/'ui-build.json')]
    for source in output.rglob('*'):
        if source.is_file():
            mappings.append((source, STATIC/source.relative_to(output)))
    for source, target in mappings:
        if check:
            if not target.is_file() or source.read_bytes() != target.read_bytes():
                raise SystemExit('UI artifact drift: '+str(target.relative_to(ROOT)))
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    expected = {source.relative_to(output) for source in output.rglob('*') if source.is_file()}
    for name in ('src', 'vendor', 'images'):
        for target in (STATIC/name).rglob('*'):
            if target.is_file() and target.relative_to(STATIC) not in expected:
                if check:raise SystemExit('Unexpected generated UI file: '+str(target.relative_to(ROOT)))
                target.unlink()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--out', type=Path)
    args=parser.parse_args()
    if args.out:
        build(args.out.resolve())
        return
    build_dir = UI / 'dist'
    if build_dir.exists(): shutil.rmtree(build_dir)
    build_dir.mkdir(parents=True, exist_ok=True)
    try:
        build(build_dir)
        snapshots(build_dir, args.check)
    finally:
        if build_dir.exists(): shutil.rmtree(build_dir)
    print('UI source/artifacts verified' if args.check else 'UI compiled and offline snapshots synchronized')


if __name__=='__main__':main()
