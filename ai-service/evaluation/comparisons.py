"""同冻结输入的配对差值；family bootstrap仅供探索，不宣称显著性。"""
from collections import defaultdict
import random
from .metrics import percentile


def paired(left, right, metric, *, metadata_left, metadata_right):
    for key in ('datasetHash', 'split', 'profile', 'adapter', 'configuration'):
        if metadata_left.get(key) != metadata_right.get(key):
            raise ValueError('incompatible comparison: ' + key)
    fixed = {r['caseId']: r['fixedGenerationInputHash'] for r in left if 'fixedGenerationInputHash' in r}
    for r in right:
        if r['caseId'] in fixed and r.get('fixedGenerationInputHash') != fixed[r['caseId']]:
            raise ValueError('generation candidates/evidence changed')
    def index(rows):
        values = defaultdict(list)
        for r in rows:
            value = r.get('scores', {}).get(metric, {}).get('value')
            if value is not None:
                values[(r['caseId'], r['familyId'])].append(value)
        return {k: sum(v) / len(v) for k, v in values.items()}
    a, b = index(left), index(right)
    keys = sorted(a.keys() & b.keys())
    families = defaultdict(list)
    for k in keys:
        families[k[1]].append(b[k] - a[k])
    if not keys:
        return {'pairedCases': 0, 'meanDelta': None, 'interval': None}
    randomizer = random.Random(20261031)
    groups = list(families.values())
    trials = []
    for _ in range(1000):
        sample = [d for group in randomizer.choices(groups, k=len(groups)) for d in group]
        trials.append(sum(sample) / len(sample))
    return {'pairedCases': len(keys), 'leftUnpaired': len(a.keys() - b.keys()),
            'rightUnpaired': len(b.keys() - a.keys()), 'meanDelta': sum(b[k] - a[k] for k in keys) / len(keys),
            'interval': [percentile(trials, .025), percentile(trials, .975)],
            'method': 'family-paired-bootstrap-1000-seed-20261031', 'interpretation': 'EXPLORATORY'}
