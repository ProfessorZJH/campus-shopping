"""可提交的评测摘要；原始逐例产物保留在var/及CI artifact。"""
import hashlib
from pathlib import Path
from .dataset import write_json
from .metrics import hard_violations


def compact_run(run):
    manifest = run['manifest']
    keys = ('scorerVersion', 'code', 'dataset', 'snapshotHash', 'resultsHash', 'split', 'profile', 'adapter',
            'experiments', 'status', 'exitCode', 'humanReview', 'boundaryViolations', 'boundaryViolationDetails')
    metrics = []
    for group in run.get('metrics', []):
        compact = {k: v for k, v in group.items() if k != 'metrics'}
        compact['metrics'] = {name: {k: v for k, v in value.items()
                                    if k not in ('caseNumerators', 'caseDenominators')}
                              for name, value in group.get('metrics', {}).items()}
        metrics.append(compact)
    return dict(run=run['run'], scope=run.get('scope', 'DRAFT_DIAGNOSTIC_NOT_FORMAL_BASELINE' if manifest['dataset']['status'] == 'DRAFT' else 'ACCEPTED_DATASET_RUN'),
                manifest={k: manifest[k] for k in keys if k in manifest}, metrics=metrics,
                rowCount=run.get('rowCount'), failureSamples=run.get('failureSamples', [])[:10])


def export_run(path, output):
    import json
    path = Path(path)
    manifest = json.loads((path / 'manifest.json').read_text(encoding='utf-8'))
    metrics = json.loads((path / 'metrics.json').read_text(encoding='utf-8'))
    rows = [json.loads(line) for line in (path / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
    run = compact_run(dict(run=path.name, manifest=manifest, metrics=metrics, rowCount=len(rows),
        failureSamples=[{k: r.get(k) for k in ('caseId', 'experiment', 'repeat', 'status', 'reason', 'scores')}
                        for r in rows if r['status'] != 'EXECUTED' or hard_violations(r.get('scores', {}))]))
    run['rawFiles'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in path.iterdir() if p.is_file()}
    write_json(output, run)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('run', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    export_run(args.run, args.output)
