import copy
import hashlib
import json
from dataclasses import replace
from pathlib import Path

import httpx
import pytest
from app.retrieval import KnowledgeStore, Provider
from evaluation.dataset import load, digest
from evaluation.provenance import (Recorder, RecordedProvider, RecordedClient, preflight, settings_for, transport_scope)
from evaluation.resources import OwnedIndex, collection_name
from evaluation.reports import new_run, recompute
from evaluation.runner import run
from evaluation.stubs import FakeEmbedding, FakeMilvus
from evaluation.cli import main
from evaluation.comparisons import paired


def test_repeat_and_recompute_are_deterministic_and_legacy_immutable(tmp_path):
    data = load()
    paths = [new_run(tmp_path / str(i)) for i in range(2)]
    for p in paths:
        result = run(data, p, split='smoke')
        assert result['exitCode'] == 0 and result['boundaryViolations'] == []
        assert result['status'] == 'PARTIAL'  # DRAFT仍非正式业务效果通过。
        rows = [json.loads(l) for l in (p / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
        spec_row = next(r for r in rows if r['caseId'] == 'case-041' and r['experiment'] == 'R-RULE')
        assert {r['skuId'] for r in spec_row['result']['recommendations']} == {'s000-0', 's040-0', 's160-0'}
        assert spec_row['scores']['constraint.attributes']['value'] == 1
        assert spec_row['scores']['recommendationCoverage']['value'] == 1
        before = json.loads((p / 'metrics.json').read_text(encoding='utf-8'))
        assert recompute(p) == before
    def normalized(path):
        rows = [json.loads(l) for l in (path / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
        for r in rows:
            r.pop('latencyMs')
            r.get('result', {}).pop('latencyMs', None)
        return rows
    assert normalized(paths[0]) == normalized(paths[1])
    old = Path(__file__).resolve().parents[2] / 'docs/testing/evidence/ai-retrieval-evaluation.json'
    prior = old.read_bytes()
    assert main(['--output-dir', str(tmp_path / 'legacy')]) == 0
    assert old.read_bytes() == prior
    assert main(['--dataset', 'campus-shopping-v1', '--formal']) == 2
    assert main(['--dataset', 'campus-shopping-v1', '--split', 'smoke', '--experiments', 'E4', '--output-dir', str(tmp_path / 'bad')]) == 2


def test_stub_cannot_claim_real_and_network_blocked(tmp_path):
    settings = settings_for('controlled', tmp_path / 'k.db', 'eval_test')
    recorder = Recorder('controlled', 2)
    with transport_scope(settings, recorder):
        p = Provider(settings)
        assert p.complete('ignored', {'question': '茶'}) == {'query': '茶'}
        p.embed(['茶'])
        with pytest.raises(httpx.TransportError):
            p.embed(['茶'])
        import socket
        with pytest.raises(OSError, match='blocked'):
            socket.create_connection(('example.org', 443))
    assert recorder.snapshot()['llm']['source'] == ['STUB']
    assert recorder.snapshot()['embedding']['failure'] == 1
    assert recorder.used == 2


def test_live_preflight_budget_failure_and_safe_errors(tmp_path, monkeypatch):
    settings = settings_for('local', tmp_path / 'k.db', 'eval_test')
    assert preflight('real-llm', settings, False, 5) == 'EXTERNAL_NOT_ENABLED'
    assert preflight('real-llm', settings, True, 5) == 'MISSING_PROVIDER_CONFIG'
    monkeypatch.setenv('LLM_BASE_URL', 'https://llm.example.test/v1')
    monkeypatch.setenv('LLM_API_KEY', 'secret-must-not-leak')
    monkeypatch.setenv('LLM_MODEL', 'test')
    data = load()
    path = new_run(tmp_path / 'budget')
    def failure(request):
        raise httpx.ConnectError('secret-must-not-leak full prompt exception')
    manifest = run(data, path, split='smoke', profile='real-llm', experiments=('R-LLM',), allow_external=True,
                   budget=2, handler=failure)
    assert manifest['exitCode'] == 1
    assert manifest['providerRequests'] == 2
    assert 'secret-must-not-leak' not in '\n'.join(p.read_text(encoding='utf-8') for p in path.iterdir())
    rows = [json.loads(l) for l in (path / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
    assert len(rows) == 36 and all(r['status'] == 'DEGRADED' for r in rows)


def test_owned_resources_cleanup_collision_and_tls(tmp_path):
    settings = settings_for('local', tmp_path / 'k.db', collection_name('a' * 64))
    settings = replace(settings, milvus_uri='https://milvus.example.test', milvus_token='stub',
                       embedding_url='https://embedding.example.test', embedding_key='stub', embedding_model='stub')
    fake = FakeMilvus()
    fake.collections['campus_products_v1'] = {'keep': {}}
    recorder = Recorder('controlled', 100)
    owned = OwnedIndex(settings, FakeEmbedding(), recorder, fake, 'STUB')
    index = owned.open([])
    assert index.search('茶饮')['mode'] == 'MILVUS'
    assert recorder.snapshot()['productVector']['source'] == ['STUB']
    owned.close()
    assert owned.cleanup == 'DELETED'
    assert fake.collections == {'campus_products_v1': {'keep': {}}}
    fake.collections[settings.product_collection] = {}
    collision = OwnedIndex(settings, FakeEmbedding(), recorder, fake, 'STUB')
    with pytest.raises(ValueError, match='collision'):
        collision.open([])
    collision.close()
    assert settings.product_collection in fake.collections
    with pytest.raises(ValueError, match='TLS'):
        replace(settings, milvus_uri='http://8.8.8.8:19530').validate()


def test_live_profile_with_successful_stub_is_still_incomplete(tmp_path, monkeypatch):
    from evaluation.provenance import controlled_response
    monkeypatch.setenv('LLM_BASE_URL', 'https://llm.example.test/v1')
    monkeypatch.setenv('LLM_API_KEY', 'private-test-only')
    monkeypatch.setenv('LLM_MODEL', 'test')
    path = new_run(tmp_path / 'claimed-real')
    result = run(load(), path, split='smoke', profile='real-llm', experiments=('R-LLM',),
                 allow_external=True, budget=100, handler=controlled_response)
    assert result['exitCode'] == 1
    rows = [json.loads(l) for l in (path / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
    assert all(r['status'] == 'DEGRADED' and r['provenance']['llm']['source'] == ['STUB'] for r in rows)


def test_controlled_llm_repeats_fixed_candidates_and_metadata(tmp_path):
    data = load()
    path = new_run(tmp_path / 'controlled')
    result = run(data, path, split='smoke', profile='controlled', experiments=('R-RULE', 'R-LLM'))
    assert result['exitCode'] == 0 and result['boundaryViolations'] == []
    rows = [json.loads(l) for l in (path / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
    for cid in data['splits']['smoke']:
        case_rows = [r for r in rows if r['caseId'] == cid]
        assert len(case_rows) == 4
        assert len({r.get('candidatesHash') for r in case_rows}) == 1
        assert all('REAL' not in r['provenance']['llm']['source'] for r in case_rows)
        if cid == 'case-041':
            assert all({i['skuId'] for i in r['result']['recommendations']} == {'s000-0', 's040-0', 's160-0'} for r in case_rows)
            assert all(r['scores']['constraint.attributes']['value'] == 1 for r in case_rows)
            assert all(r['scores']['recommendationCoverage']['value'] == 1 for r in case_rows)
    with pytest.raises(ValueError, match='incompatible'):
        paired([], [], 'x', metadata_left={'profile': 'local'}, metadata_right={'profile': 'controlled'})
    metadata = dict(datasetHash='x', split='dev', profile='controlled', adapter='python', configuration={})
    assert paired(rows, rows, 'requestSuccess', metadata_left=metadata, metadata_right=metadata)['meanDelta'] == 0


def test_java_import_is_offline_and_preserves_execution_metadata(tmp_path, monkeypatch):
    import evaluation.runner as runner
    data = load()
    original_settings = runner.settings_for
    def offline_settings(profile, *args):
        assert profile == 'local'
        return original_settings(profile, *args)
    def no_store(*args, **kwargs):
        pytest.fail('importing results must not initialize retrieval or call providers')
    monkeypatch.setattr(runner, 'settings_for', offline_settings)
    monkeypatch.setattr(runner, 'KnowledgeStore', no_store)
    monkeypatch.setenv('LLM_BASE_URL', 'not-a-valid-provider-url')
    rows = [dict(caseId=cid, experiment='P-L', status='EXECUTED', stages={}, result={}, latencyMs=None,
                 provenance={'javaMysql': dict(source=['REAL'], attempts=1, success=1, failure=0)})
            for cid in data['splits']['smoke']]
    metadata = dict(resources=[dict(collection='eval_unit_fixture', cleanup='DELETED')],
                    actualModels={'productEmbedding': dict(model='stub', dimension=3)})
    output = new_run(tmp_path / 'import')
    manifest = run(data, output, split='smoke', profile='controlled', adapter='java-mysql',
                   experiments=('P-L',), java_rows=rows, java_metadata=metadata)
    assert manifest['exitCode'] == 0 and manifest['importedExecution']
    assert manifest['warmup'] == 0 and manifest['providerRequests'] == 0
    assert manifest['resources'] == metadata['resources']
    assert manifest['actualModels'] == metadata['actualModels']
    assert manifest['actualComponents']['javaMysql']['success'] == 12
    saved = [json.loads(line) for line in (output / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
    assert len(saved) == 12 and all(r['latencyMs'] is None for r in saved)


def test_cli_dev_results_are_reproducible_across_process_hash_seeds(tmp_path):
    import os
    import subprocess
    import sys
    script = Path(__file__).resolve().parents[1] / 'evaluate.py'
    results = []
    for seed in ('1', '2'):
        output = tmp_path / seed
        completed = subprocess.run([sys.executable, str(script), '--dataset', 'campus-shopping-v1', '--split', 'dev',
                        '--experiments', 'K-B,K-D,K-H,K-D-R,K-H-R,R-RULE', '--output-dir', str(output)],
                       env=dict(os.environ, PYTHONHASHSEED=seed), capture_output=True)
        assert completed.returncode == 0
        manifest = json.loads((output / 'manifest.json').read_text(encoding='utf-8'))
        assert manifest['status'] == 'PARTIAL' and manifest['boundaryViolations'] == []
        assert manifest['configuration']['pythonHashSeed'] == '20261031'
        rows = [json.loads(line) for line in (output / 'cases.jsonl').read_text(encoding='utf-8').splitlines()]
        spec_rows = [r for r in rows if r['caseId'] in [f'case-{i:03d}' for i in range(41, 45)] and r['experiment'] == 'R-RULE']
        assert len(spec_rows) == 4
        assert all(r['result']['recommendations'] and r['scores']['constraint.attributes']['value'] == 1
                   and r['scores']['recommendationCoverage']['value'] == 1 for r in spec_rows)
        for r in rows:
            r.pop('latencyMs', None)
            r.get('result', {}).pop('latencyMs', None)
        results.append(rows)
    assert results[0] == results[1]
