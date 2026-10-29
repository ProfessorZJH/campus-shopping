#!/usr/bin/env python3
"""根据本次源码、构建产物及显式提供的验收证据生成交付清单，不复用历史通过状态。"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', '.idea', '.vscode', 'node_modules', 'target', 'dist', 'var', 'artifacts', '__pycache__', '.pytest_cache', '.venv', 'venv'}


def source_digest():
    entries = []
    for directory, children, names in os.walk(ROOT):
        children[:] = sorted(child for child in children if child not in EXCLUDED)
        parent = Path(directory)
        if parent == ROOT/'docs/testing':
            children[:] = [child for child in children if child != 'evidence']
        for name in sorted(names):
            path = parent/name
            relative = path.relative_to(ROOT).as_posix()
            if (name.startswith('.env') and name != '.env.example') or name == 'release-manifest.json' or name.endswith(('.log', '.pyc')):
                continue
            entries.append((relative, hashlib.sha256(path.read_bytes()).hexdigest()))
    digest = hashlib.sha256()
    for relative, checksum in sorted(entries):
        digest.update((relative+'\0'+checksum+'\n').encode('utf-8'))
    return digest.hexdigest(), len(entries)


def junit_totals(root):
    totals = dict(tests=0, failures=0, errors=0, skipped=0)
    reports = list(root.glob('campus-shopping-*/target/surefire-reports/TEST-*.xml'))
    for path in reports:
        suite = ET.parse(path).getroot()
        for key in totals:
            totals[key] += int(suite.get(key, 0))
    totals['passed'] = totals['tests'] - totals['skipped'] - totals['failures'] - totals['errors']
    totals['status'] = ('NOT_RUN' if not reports else 'FAIL' if totals['failures'] or totals['errors']
                        else 'PARTIAL' if totals['skipped'] else 'PASS')
    return totals


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'campus-shopping-app/target/release-manifest.json')
    parser.add_argument('--evidence', action='append', default=[], help='本次执行的证据 label=path，可重复')
    parser.add_argument('--begin-build', action='store_true', help='在 Maven validate 阶段记录本次构建的源码摘要')
    parser.add_argument('--require-full-tests', action='store_true', help='要求本次完整验收没有失败或跳过的 JUnit 用例')
    args = parser.parse_args()
    try:
        commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True)
        status = subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True)
        git_commit = commit.stdout.strip() if commit.returncode == 0 else None
        git_dirty = bool(status.stdout.strip()) if status.returncode == 0 else None
    except OSError:
        git_commit = git_dirty = None
    source_hash, count = source_digest()
    build_record = ROOT/'campus-shopping-app/target/build-source.json'
    if args.begin_build:
        build_record.parent.mkdir(parents=True, exist_ok=True)
        build_record.write_text(json.dumps({'sha256': source_hash, 'files': count,
            'recordedAt': datetime.now(timezone.utc).isoformat()})+'\n', encoding='utf-8')
        print('Recorded build source checksum')
        return
    build_source = json.loads(build_record.read_text('utf-8')) if build_record.is_file() else None
    totals = junit_totals(ROOT)
    if args.require_full_tests and totals['status'] != 'PASS':
        raise SystemExit('Full acceptance requires JUnit reports with zero failures/errors/skips: '+json.dumps(totals))
    artifacts = []
    jar = ROOT/'campus-shopping-app/target/campus-shopping-app.jar'
    if args.require_full_tests and (not jar.is_file() or not build_source or build_source['sha256'] != source_hash):
        raise SystemExit('Full acceptance requires an artifact built from the current source; rerun clean verify')
    if jar.exists():
        artifacts.append({'path': jar.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(jar.read_bytes()).hexdigest(), 'bytes': jar.stat().st_size})
    evidence = {}
    for entry in args.evidence:
        label, filename = entry.split('=', 1)
        path = Path(filename)
        # 原始证据通过摘要关联，不把可能包含用户数据的响应正文复制进交付清单。
        evidence[label] = {'path': path.as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    version = ET.parse(ROOT/'pom.xml').getroot().find('{*}version').text
    manifest = {'schemaVersion': 2, 'name': 'campus-shopping', 'version': version,
                'generatedAt': datetime.now(timezone.utc).isoformat(),
                'source': {'gitCommit': git_commit,
                           'workingTreeDirty': git_dirty,
                           'sha256': source_hash, 'files': count},
                'buildSource': build_source,
                'sourceMatchesBuild': build_source['sha256'] == source_hash if build_source else None,
                'artifacts': artifacts, 'verification': {'maven': totals, 'evidence': evidence},
                'notClaimed': ['production deployment', 'performance acceptance', 'external AI acceptance unless separately evidenced']}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Generated release manifest: '+str(args.output))


if __name__ == '__main__':main()
