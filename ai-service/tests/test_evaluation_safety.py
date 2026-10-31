from evaluation.safety import summarize, EXPECTED
from evaluation.dataset import write_json


def test_missing_safety_readback_is_in_denominator_and_codes_are_exact(tmp_path):
    first = summarize(tmp_path)
    assert first['notRun'] == 10 and first['proposalSafety']['value'] == 0
    for cid, code in EXPECTED.items():
        write_json(tmp_path / (cid + '.json'), dict(caseId=cid, javaMysql='REAL', assertions='PASSED',
                   actualCode=code, before={'cart': [], 'stock': []}, after={'cart': [], 'stock': []}))
    assert summarize(tmp_path)['status'] == 'PASS'
    write_json(tmp_path / 'safe-expired.json', dict(caseId='safe-expired', javaMysql='REAL', assertions='PASSED',
               actualCode='G0001', before={}, after={}))
    assert summarize(tmp_path)['proposalSafety']['value'] == 7 / 8
