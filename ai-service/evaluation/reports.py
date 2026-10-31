"""保存合成输入/逐例结果；离线重算不重新请求供应商。"""
from __future__ import annotations
import json
import platform
from importlib.metadata import version
import secrets
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .dataset import digest, write_json, write_jsonl, read_jsonl
from .metrics import score, aggregate

ROOT = Path(__file__).resolve().parents[2]
SCORER_VERSION = '1'


def now():
    return datetime.now(timezone.utc).isoformat()


def revision():
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=ROOT, encoding='utf-8', stderr=subprocess.DEVNULL).strip()
    sources = [p for base in (ROOT/'ai-service', ROOT/'campus-shopping-app/src/test') for p in base.rglob('*')
               if p.is_file() and p.suffix in ('.py', '.java', '.json', '.jsonl') and '__pycache__' not in p.parts
               and '.venv' not in p.parts]
    import hashlib
    return {'commit': git('rev-parse', 'HEAD'), 'dirtyHash': digest(git('diff', 'HEAD')),
            'sourceHash': digest({p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources})}


def new_run(output=None):
    path = Path(output) if output else ROOT / 'var/evaluation/runs' / (
        datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + revision()['commit'][:8] + '-' + secrets.token_hex(4))
    # 永不覆盖旧报告，包括用户指定的目录。
    path.mkdir(parents=True, exist_ok=False)
    return path.resolve()


def render(manifest, groups, rows):
    lines = ['# 智能导购评测报告', '', '状态：**' + manifest['status'] + '**。' +
             ' 自动执行与人工业务验收分别记录；DRAFT标签不能作为正式质量基线。', '',
             '## 版本与范围', '', '```json', json.dumps({k: manifest[k] for k in
              ('dataset', 'split', 'profile', 'adapter', 'code', 'annotation', 'resources')}, ensure_ascii=False, indent=2), '```', '',
             '## 实验与质量', '', '主表为含失败/降级的计划范围保守宏平均；正常、降级及未运行分表见metrics.json的byExecutionStatus，不能作为正常live总分。', '',
             '| 实验/来源/适配器 | 指标 | scored/planned | 分子 / 分母（逐例） | 宏平均 |',
             '|---|---|---|---|---|']
    for g in groups:
        label = '/'.join(g[k] for k in ('experiment', 'profile', 'adapter'))
        for name, m in g['metrics'].items():
            value = 'N/A' if m['value'] is None else f'{m["value"]:.4f}'
            fractions = ', '.join(f'{a:g}/{b:g}' for a, b in zip(m['caseNumerators'], m['caseDenominators']))
            lines.append(f'| {label} | {name} | {m["scored"]}/{g["planned"]} | {fractions} | {value} |')
    lines += ['', '## 安全、耗时与执行完整率', '', '首Token：N/A（当前非流式）。延迟仅是本次评测进程墙钟，不是生产性能。', '']
    for g in groups:
        components = {k: sorted({s for r in g['actualComponents'] for s in r.get(k, {}).get('source', [])})
                      for k in ('embedding', 'llm', 'productVector', 'knowledgeVector', 'javaMysql')}
        lines += ['- ' + g['experiment'] + ': ' + json.dumps({k: g[k] for k in
                  ('planned', 'failed', 'notRun', 'degraded', 'latency')}, ensure_ascii=False),
                  '  实际组件：' + json.dumps(components, ensure_ascii=False)]
    lines += ['', '## 失败与待评', '', '引用来源合法不代表语义正确；回答/解释/语义泄漏待人类实际评审。', '']
    for r in rows:
        if r['status'] not in ('EXECUTED',) or any(m['value'] == 0 for m in r.get('scores', {}).values()):
            lines.append('- ' + '/'.join(str(r.get(k, '')) for k in ('caseId', 'experiment', 'repeat', 'status')) +
                         ' ' + r.get('reason', '') + '；详见cases.jsonl，不隐去原始失败。')
    lines += ['', '## 复现与清理', '', '`python ai-service/evaluate.py --recompute <本目录>`', '',
              'Python-only的商品全目录召回、Java权限裁决和提案事务均NOT_RUN。真实外部服务未调用即NOT_USED。',
              '独立reranker E4=UNSUPPORTED。历史8条报告不属于本数据集。',
              '差异只在同数据/标签/适配器/profile/候选快照下配对；小样本不宣称统计显著。', '']
    return '\n'.join(lines)


def recompute(path):
    path = Path(path)
    manifest = json.loads((path / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['scorerVersion'] != SCORER_VERSION:
        raise ValueError('scorer version mismatch')
    data = json.loads((path / 'dataset-snapshot.json').read_text(encoding='utf-8'))
    if digest(data) != manifest['snapshotHash']:
        raise ValueError('dataset snapshot hash mismatch')
    rows = read_jsonl(path / 'cases.jsonl')
    if digest([{k: v for k, v in r.items() if k != 'scores'} for r in rows]) != manifest['resultsHash']:
        raise ValueError('raw result hash mismatch')
    cases = {c['caseId']: c for c in data['cases']}
    qrels = {c['caseId']: c for c in data['qrels']}
    reviews = {(r['caseId'], r['experiment'], r['repeat']): r for r in read_jsonl(path / 'review.jsonl')}
    for r in rows:
        if r['caseId'] in cases:
            r['scores'] = score(data, cases[r['caseId']], qrels[r['caseId']], r,
                                reviews.get((r['caseId'], r['experiment'], r['repeat'])))
    groups = aggregate(rows)
    from .comparisons import paired
    comparisons = []
    for a, b, metric in (('K-D', 'K-H', 'knowledge.documents/ndcg@5'),
                         ('K-H', 'K-H-R', 'knowledge.documents/ndcg@5'),
                         ('P-L', 'P-H', 'product.fused/recall@50'),
                         ('R-RULE', 'R-LLM', 'requestSuccess')):
        left = [r for r in rows if r['experiment'] == a]
        right = [r for r in rows if r['experiment'] == b]
        if left and right:
            metadata = dict(datasetHash=manifest['snapshotHash'], split=manifest['split'], profile=manifest['profile'],
                            adapter=manifest['adapter'], configuration=manifest['configuration'])
            comparisons.append(dict(left=a, right=b, metric=metric,
                               **paired(left, right, metric, metadata_left=metadata, metadata_right=metadata)))
    write_json(path / 'comparisons.json', comparisons)
    required_reviews = [r for r in rows if r['task'] in ('knowledge', 'recommendation')]
    completed_reviews = [reviews.get((r['caseId'], r['experiment'], r['repeat']), {}) for r in required_reviews]
    complete = bool(completed_reviews) and all(r.get('reviewer') and r.get('reviewedAt') and
                r.get('reviewStatus') == 'HUMAN_REVIEWED' and isinstance(r.get('semanticLeak'), bool)
                for r in completed_reviews)
    manifest['humanReview'] = 'COMPLETE' if complete else 'PENDING'
    if complete and manifest['dataset']['status'] == 'ACCEPTED' and manifest['exitCode'] == 0:
        manifest['status'] = 'FAILED' if any(r.get('semanticLeak') or any(a.get('supported') is False
            for a in r.get('assertions', [])) for r in completed_reviews) else 'PASS'
    write_json(path / 'manifest.json', manifest)
    write_json(path / 'metrics.json', groups)
    write_jsonl(path / 'cases.jsonl', rows)
    (path / 'report.md').write_text(render(manifest, groups, rows), encoding='utf-8')
    return groups


def save(path, data, rows, metadata):
    manifest = dict(schemaVersion=1, scorerVersion=SCORER_VERSION, runId=path.name, code=revision(),
                    python=platform.python_version(), platform=platform.system(),
                    dependencies={p: version(p) for p in ('httpx', 'pytest', 'fastapi')},
                    dataset={k: data['manifest'][k] for k in ('datasetId', 'version', 'status')},
                    annotation=data['validation'], snapshotHash=digest(data),
                    resultsHash=digest([{k: v for k, v in r.items() if k != 'scores'} for r in rows]), **metadata)
    write_json(path / 'manifest.json', manifest)
    write_json(path / 'dataset-snapshot.json', data)
    write_jsonl(path / 'cases.jsonl', rows)
    write_jsonl(path / 'review.jsonl', [dict(caseId=r['caseId'], experiment=r['experiment'], repeat=r['repeat'],
                 reviewStatus='PENDING', reviewer=None, reviewedAt=None, assertions=[], semanticLeak=None)
                 for r in rows if r['task'] in ('knowledge', 'recommendation')])
    recompute(path)
    return manifest
