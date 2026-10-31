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


def build(output):
    subprocess.run(['node', str(UI/'scripts/build.mjs'), '--out='+str(output)], check=True, cwd=ROOT)


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
    with tempfile.TemporaryDirectory(prefix='campus-ui-build-') as folder:
        output=Path(folder)
        build(output)
        snapshots(output, args.check)
    print('UI source/artifacts verified' if args.check else 'UI compiled and offline snapshots synchronized')


if __name__=='__main__':main()
