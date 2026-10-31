"""向隔离JUnit传递冻结合成输入；Java生产策略只在Java中执行。"""
import json
import tempfile
from pathlib import Path
from app.retrieval import KnowledgeStore
from app.engine import recall_terms
from .dataset import digest, write_json
from .provenance import Recorder, RecordedProvider, settings_for, preflight, transport_scope
from .resources import collection_name, OwnedIndex
from .stubs import FakeMilvus, FakeEmbedding


def prepare(path, data, *, split='smoke', profile='local', experiments=('P-L',), allow_external=False, budget=0):
    records = []
    recorder = Recorder(profile, 1000000 if profile == 'controlled' else budget)
    resources = []
    with tempfile.TemporaryDirectory(prefix='campus-eval-java-input-') as tmp:
        settings = settings_for(profile, Path(tmp) / 'knowledge.db', collection_name(data['datasetHash']))
        reason = preflight(profile, settings, allow_external, budget)
        if reason:
            raise ValueError(reason)
        settings.validate()
        with transport_scope(settings, recorder):
            store = KnowledgeStore(settings)
            store.provider = RecordedProvider(store.provider, recorder)
            owned, index = None, None
            try:
                if profile in ('controlled', 'real-milvus', 'live-full'):
                    provider = store.provider
                    if profile == 'controlled':
                        settings = __import__('dataclasses').replace(settings, milvus_uri='https://milvus.eval.invalid', milvus_token='stub')
                        fake = FakeEmbedding()
                        class Embedding:
                            model_tag = fake.model_tag
                            def embed(self, texts, input_type='passage'):
                                recorder.event('embedding', 'STUB', 'SUCCESS', input_type)
                                vectors = fake.embed(texts, input_type)
                                recorder.models['productEmbedding'] = dict(model=self.model_tag, dimension=len(vectors[0]) if vectors else None)
                                return vectors
                        provider = Embedding()
                    owned = OwnedIndex(settings, provider, recorder, FakeMilvus() if profile == 'controlled' else None,
                                       'STUB' if profile == 'controlled' else 'REAL')
                    index = owned.open([dict(productId=p['productId'], merchantId=p['merchantId'], title=p['title'],
                                            description=p['description'], categoryCode=p['categoryCode'],
                                            specs=[s['specKey'] for s in p['skus']]) for p in data['products']])
                for case in data['cases']:
                    if case['caseId'] not in data['splits'][split]:
                        continue
                    # 词面对照固定无模型terms；P-TERMS才启用当前可选模型terms。
                    rule_settings = store.settings
                    from dataclasses import replace
                    store.settings = replace(rule_settings, llm_key='')
                    fixed = recall_terms(store, case['originalQuery'], case['conversationContext'])
                    store.settings = rule_settings
                    for exp in experiments:
                        start = len(recorder.events)
                        why = None
                        query = case['originalQuery']
                        terms = fixed['terms']
                        semantic_ids = []
                        try:
                            if exp in ('P-H-R', 'P-TERMS'):
                                dynamic = recall_terms(store, case['originalQuery'], case['conversationContext'])
                                query = dynamic['query']
                                if exp == 'P-TERMS':
                                    terms = dynamic['terms']
                            if exp != 'P-L':
                                if index is None:
                                    why = 'MILVUS_NOT_RUN'
                                else:
                                    semantic_ids = index.search(query, 80)['productIds']
                        except Exception as error:
                            why = type(error).__name__
                        if any(e['outcome'] != 'SUCCESS' for e in recorder.events[start:]) and not why:
                            why = 'PROVIDER_DEGRADED'
                        provenance = recorder.snapshot(start)
                        records.append(dict(caseId=case['caseId'], experiment=exp, query=query, terms=terms,
                                            semanticIds=semantic_ids, provenance=provenance,
                                            status='NOT_RUN' if why else 'EXECUTED', reason=why))
            finally:
                if owned:
                    owned.close()
                    resources.append(owned.manifest())
                store.close()
    plan = dict(schemaVersion=1, datasetHash=data['datasetHash'], dataset=data, split=split, profile=profile,
                records=records, resources=resources, providerRequests=recorder.used, actualModels=recorder.models)
    write_json(path, plan)
    return plan


def read_export(path, data, *, profile=None, split=None, experiments=None):
    export = json.loads(Path(path).read_text(encoding='utf-8'))
    if export['datasetHash'] != data['datasetHash'] or export['adapter'] != 'java-mysql':
        raise ValueError('Java dataset/adapter mismatch')
    if (profile and export.get('profile') != profile) or (split and export.get('split') != split):
        raise ValueError('Java experiment metadata mismatch')
    if export['database'] != 'campus_shopping_it' or not export['fixtureLoadedViaDomains']:
        raise ValueError('Java isolation evidence missing')
    from .runner import EXPERIMENTS
    selected_split = split or export.get('split')
    if selected_split not in data['splits'] or not experiments or len(set(experiments)) != len(experiments):
        raise ValueError('Java expected split/experiments missing or duplicated')
    if any(e not in EXPERIMENTS for e in experiments):
        raise ValueError('Java unexpected experiment')
    expected = set()
    for case in data['cases']:
        if case['caseId'] not in data['splits'][selected_split]: continue
        for exp in experiments:
            task = 'knowledge' if exp.startswith('K-') else 'recommendation' if exp.startswith('R-') else 'product'
            if task in ('knowledge', 'recommendation') and task not in case['taskScopes']: continue
            expected.add((case['caseId'], exp))
    seen = set()
    for row in export['rows']:
        key = (row['caseId'], row['experiment'])
        if key in seen or key not in expected:
            raise ValueError('Java duplicate or unexpected case/experiment')
        seen.add(key)
        if row['status'] not in ('EXECUTED', 'NOT_RUN', 'FAILED', 'UNSUPPORTED'):
            raise ValueError('Java unknown execution status')
    if seen != expected:
        raise ValueError('Java incomplete case/experiment coverage')
    products = {p['productId']: p for p in data['products']}
    merchants = {m['merchantId']: m for m in data['merchants']['merchants']}
    skus = {s['skuId']: (p, s) for p in data['products'] for s in p['skus']}
    for row in export['rows']:
        if row['status'] == 'EXECUTED':
            evidence = row.get('provenance', {}).get('javaMysql', {})
            if (evidence.get('source') != ['REAL'] or type(evidence.get('attempts')) is not int
                    or type(evidence.get('success')) is not int or evidence['success'] < 1
                    or evidence.get('failure') != 0 or evidence['attempts'] != evidence['success']):
                raise ValueError('Java successful execution evidence missing')
            if row['experiment'] not in ('P-L', 'P-D', 'P-H', 'P-H-R', 'P-TERMS'):
                raise ValueError('Java unsupported executed experiment')
            for stage in ('product.fused', 'sku.pool'):
                values = row.get('stages', {}).get(stage)
                if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
                    raise ValueError('Java required stage missing or malformed')
            if row['experiment'] != 'P-L':
                source = ['STUB'] if export.get('profile') == 'controlled' else ['REAL']
                for component in ('embedding', 'productVector'):
                    proof = row.get('provenance', {}).get(component, {})
                    if proof.get('source') != source or not proof.get('success', 0) or proof.get('failure', 0):
                        raise ValueError('Java semantic source evidence missing')
        stages = row.get('stages', {})
        ranked = stages.get('product.fused', [])
        for pid in ranked:
            p = products[pid]
            if p['status'] != 'PUBLISHED' or merchants[p['merchantId']]['status'] != 'ACTIVE' or not any(s['status'] == 'ACTIVE' for s in p['skus']):
                raise ValueError('Java returned stale product')
        for sid in stages.get('sku.pool', []):
            p, s = skus[sid]
            if s['status'] != 'ACTIVE' or p['productId'] not in ranked:
                raise ValueError('Java product/SKU stage mismatch')
        if len(ranked) != len(set(ranked)) or len(stages.get('sku.pool', [])) != len(set(stages.get('sku.pool', []))):
            raise ValueError('Java stage duplicate IDs')
    return export['rows']
