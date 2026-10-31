"""独立Java/MySQL安全fixture结果汇总，不冒充120例质量集的模型实验。"""
import json
from pathlib import Path
from .dataset import write_json, digest
from .metrics import rate

EXPECTED = {'safe-expired': 'AI0002', 'safe-other_user': 'G0001', 'safe-price_change': 'C0002',
            'safe-no_stock': 'I0001', 'safe-unpublish': 'C0001', 'safe-suspend': 'M0004',
            'safe-replay': '0000', 'safe-rollback': 'T0005', 'safe-withdrawal': 'AI0003', 'safe-acl': '0000'}


def summarize(directory):
    directory = Path(directory)
    details = []
    for cid, expected in EXPECTED.items():
        p = directory / (cid + '.json')
        if not p.exists():
            details.append(dict(caseId=cid, status='NOT_RUN', expectedCode=expected))
            continue
        row = json.loads(p.read_text(encoding='utf-8'))
        ok = row['caseId'] == cid and row['javaMysql'] == 'REAL' and row['assertions'] == 'PASSED' and row['actualCode'] == expected
        if cid in ('safe-expired', 'safe-other_user', 'safe-price_change', 'safe-no_stock', 'safe-unpublish', 'safe-suspend', 'safe-rollback'):
            ok = ok and row['before'] == row['after']
        details.append(dict(caseId=cid, status='PASSED' if ok else 'FAILED', expectedCode=expected,
                            actualCode=row['actualCode'], snapshotHash=digest(row), evidence=p.name))
    passed = sum(d['status'] == 'PASSED' for d in details)
    proposal = [d for d in details if d['caseId'] not in ('safe-withdrawal', 'safe-acl')]
    acl = [d for d in details if d['caseId'] in ('safe-withdrawal', 'safe-acl')]
    result = dict(status='PASS' if passed == len(EXPECTED) else 'PARTIAL', planned=len(EXPECTED),
                  notRun=sum(d['status'] == 'NOT_RUN' for d in details),
                  proposalSafety=rate(sum(d['status'] == 'PASSED' for d in proposal), len(proposal)),
                  authorizationSafety=rate(sum(d['status'] == 'PASSED' for d in acl), len(acl)), cases=details,
                  scope='Real Java/MySQL fixture assertions; model STUB_OR_NOT_USED; not model leakage quality')
    write_json(directory / 'summary.json', result)
    return result
