import copy
import json
import pytest
from evaluation.java_adapter import read_export
from evaluation.reports import dependency_version
from importlib.metadata import PackageNotFoundError


def fixture():
    data = dict(datasetHash='hash', splits={'smoke': ['a', 'b']},
                cases=[dict(caseId=c, taskScopes=['product']) for c in ('a', 'b')],
                products=[], merchants={'merchants': []})
    export = dict(datasetHash='hash', adapter='java-mysql', database='campus_shopping_it',
                  fixtureLoadedViaDomains=True, split='smoke', profile='controlled',
                  rows=[dict(caseId=c, experiment=e, status='NOT_RUN', stages={})
                        for c in ('a', 'b') for e in ('P-L', 'P-H')])
    return data, export


@pytest.mark.parametrize('corruption', ['none', 'duplicate', 'missing', 'extra-case', 'extra-experiment', 'missing-experiment', 'wrong-status'])
def test_java_export_exact_coverage(tmp_path, corruption):
    data, export = fixture()
    if corruption == 'duplicate': export['rows'].append(copy.deepcopy(export['rows'][0]))
    if corruption == 'missing': export['rows'].pop()
    if corruption == 'extra-case': export['rows'][0]['caseId'] = 'other'
    if corruption == 'extra-experiment': export['rows'][0]['experiment'] = 'P-D'
    if corruption == 'missing-experiment': export['rows'] = [r for r in export['rows'] if r['experiment'] == 'P-L']
    if corruption == 'wrong-status': export['rows'][0]['status'] = 'PASS'
    path = tmp_path / 'export.json'
    path.write_text(json.dumps(export), encoding='utf-8')
    if corruption == 'none':
        assert len(read_export(path, data, profile='controlled', split='smoke', experiments=('P-L', 'P-H'))) == 4
    else:
        with pytest.raises(ValueError):
            read_export(path, data, profile='controlled', split='smoke', experiments=('P-L', 'P-H'))


def test_missing_optional_distribution_metadata(monkeypatch):
    def missing(package): raise PackageNotFoundError(package)
    monkeypatch.setattr('evaluation.reports.version', missing)
    assert dependency_version('pytest') is None


def test_cli_report_without_dev_distribution_metadata(tmp_path, monkeypatch):
    from evaluation.cli import main
    from evaluation import reports
    original = reports.version
    def metadata(package):
        if package == 'pytest': raise PackageNotFoundError(package)
        return original(package)
    monkeypatch.setattr(reports, 'version', metadata)
    out = tmp_path / 'run'
    assert main(['--dataset', 'campus-shopping-v1', '--split', 'smoke', '--experiments', 'R-RULE', '--output-dir', str(out)]) == 0
    manifest = json.loads((out / 'manifest.json').read_text(encoding='utf-8'))
    assert manifest['dependencies']['pytest'] is None
    assert manifest['status'] == 'PARTIAL'
    from evaluation.summary import export_run
    summary = tmp_path / 'summary.json'
    export_run(out, summary)
    compact = json.loads(summary.read_text(encoding='utf-8'))
    assert compact['manifest']['snapshotHash'] == manifest['snapshotHash']
    assert 'cases.jsonl' in compact['rawFiles']
    assert len(compact['failureSamples']) <= 10
    assert all('caseNumerators' not in m for g in compact['metrics'] for m in g['metrics'].values())
