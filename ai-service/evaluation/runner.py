"""复用真实检索与推荐函数的离线/受控/显式live执行器。"""
from __future__ import annotations
from dataclasses import replace
import hashlib
import os
import tempfile
import time
from pathlib import Path

from app.engine import answer, query_rewrite, recall_terms
from app.retrieval import KnowledgeStore
from .dataset import digest
from .provenance import Recorder, RecordedProvider, settings_for, preflight, transport_scope
from .resources import collection_name, OwnedIndex
from .reports import now, save

EXPERIMENTS = ('K-B', 'K-D', 'K-H', 'K-D-R', 'K-H-R', 'R-RULE', 'R-LLM',
               'P-L', 'P-D', 'P-H', 'P-H-R', 'P-TERMS', 'SAFE')


def offers_for(data, case):
    """fixture报价，不宣称执行过Java召回/权限。保持同案例R-RULE/R-LLM候选相同。"""
    merchants = {m['merchantId']: m['status'] for m in data['merchants']['merchants']}
    return [dict(skuId=s['skuId'], merchantId=p['merchantId'], productId=p['productId'], title=p['title'],
                 description=p['description'], specKey=s['specKey'], priceCent=s['priceCent'], available=s['onHand'] - s['reserved'])
            for p in data['products'] if p['status'] == 'PUBLISHED' and p['merchantId'] in case['allowedMerchantIds']
            and merchants[p['merchantId']] == 'ACTIVE' for s in p['skus'] if s['status'] == 'ACTIVE'][:300]


def run(data, path, *, split='dev', profile='local', adapter='python', experiments=('K-B', 'K-D', 'K-H', 'R-RULE'),
        allow_external=False, budget=0, java_rows=None, java_metadata=None, handler=None):
    started = now()
    ids = set(data['splits'][split])
    cases = [c for c in data['cases'] if c['caseId'] in ids]
    recorder = Recorder(profile, 1000000 if profile == 'controlled' else budget)
    rows, resources = [], []
    requested = list(experiments)
    index = None
    owned = None
    with tempfile.TemporaryDirectory(prefix='campus-eval-') as tmp:
        importing = adapter == 'java-mysql' and java_rows is not None
        settings = settings_for('local' if importing else profile, Path(tmp) / 'knowledge.db', collection_name(data['datasetHash']))
        reason = None if importing else preflight(profile, settings, allow_external, budget)
        store = None
        if reason is None:
            try:
                settings.validate()
            except ValueError:
                reason = 'UNSAFE_OR_INVALID_CONFIG'
        with transport_scope(settings, recorder, handler):
            try:
                if reason is None and not importing:
                    store = KnowledgeStore(settings)
                    store.provider = RecordedProvider(store.provider, recorder)
                    for d in data['knowledge']:
                        store.index(d['documentId'], d['title'], d['content'])
                    if profile in ('real-milvus', 'live-full'):
                        owned = OwnedIndex(settings, store.provider, recorder)
                        products = [dict(productId=p['productId'], merchantId=p['merchantId'], title=p['title'],
                                         description=p['description'], categoryCode=p['categoryCode'],
                                         specs=[s['specKey'] for s in p['skus']]) for p in data['products']]
                        index = owned.open(products)
                    # 预热同一种调用两次，不计质量/延迟；供应商预算仍计入。
                    warm = cases[0]
                    for _ in range(2):
                        store.search(warm['originalQuery'], warm['allowedDocumentIds'])
            except Exception as error:
                reason = 'SETUP_' + type(error).__name__
            try:
                for experiment in requested:
                    task = 'knowledge' if experiment.startswith('K-') else 'product' if experiment.startswith('P-') else 'safety' if experiment == 'SAFE' else 'recommendation'
                    for case in cases:
                        if task in ('knowledge', 'recommendation') and task not in case['taskScopes']:
                            continue
                        for repeat in range(3 if experiment == 'R-LLM' else 1):
                            r = dict(caseId=case['caseId'], familyId=case['familyId'], queryType=case['queryType'], split=split,
                                     experiment=experiment, repeat=repeat, profile=profile, adapter=adapter, task=task,
                                     status='NOT_RUN', stages={}, result={}, latencyMs=None, labelVersion=case['annotatorVersion'])
                            start_event = len(recorder.events)
                            t = time.perf_counter()
                            why = reason
                            if experiment not in EXPERIMENTS:
                                r['status'], why = 'UNSUPPORTED', 'UNSUPPORTED_EXPERIMENT'
                            elif task in ('product', 'safety') or adapter == 'java-mysql':
                                # 只能消费真实JUnit适配器产物，绝不用Python重写Java策略。
                                match = next((j for j in (java_rows or []) if j['caseId'] == case['caseId']
                                              and j['experiment'] == experiment), None)
                                if match is not None:
                                    r.update(match)
                                else:
                                    why = 'JAVA_MYSQL_NOT_RUN' if adapter == 'python' or not java_rows else 'JAVA_CASE_NOT_EXPORTED'
                            elif experiment == 'R-LLM' and not settings.llm_key:
                                why = 'LLM_NOT_CONFIGURED'
                            if why is None and r['status'] == 'NOT_RUN' and task in ('knowledge', 'recommendation') and adapter == 'python':
                                try:
                                    trace = {}
                                    original = case['originalQuery']
                                    history = case['conversationContext']
                                    if task == 'knowledge':
                                        query = query_rewrite(original, history, store) if experiment.endswith('-R') else original
                                        hits, mode = store.search(query, case['allowedDocumentIds'], 6,
                                            _strategy='sparse' if experiment == 'K-B' else 'dense' if experiment.startswith('K-D') else 'hybrid', _trace=trace)
                                        recorder.event('knowledgeVector', 'SQLITE', 'SUCCESS', 'search')
                                        r.update(result=dict(citations=hits, answer=''), stages={
                                            'knowledge.chunks': [h['chunkId'] for h in hits],
                                            'knowledge.documents': list(dict.fromkeys(h['documentId'] for h in hits))},
                                            returnedMode=mode, queryHash=digest(query), rewriteNoOp=query == original, trace=trace)
                                    else:
                                        offers = offers_for(data, case)
                                        old_settings = store.settings
                                        # R-RULE和R-LLM保持同一query、offers、evidence及semantic输入。
                                        # 只切换complete，禁止让LLM改写先改变候选。
                                        if experiment == 'R-RULE':
                                            store.settings = replace(old_settings, llm_key='', llm_url='', llm_model='')
                                        try:
                                            query = original
                                            result = answer(store, original, case['allowedDocumentIds'], offers, history,
                                                            retrieval_query=query, _trace=trace)
                                        finally:
                                            store.settings = old_settings
                                        r.update(result=result, stages={'recommendations': trace['selected']}, trace=trace,
                                                 candidatesHash=digest(offers), fixedGenerationInputHash=digest([offers, trace['candidates'], result['citations']]),
                                                 returnedMode=result['mode'])
                                        recorder.event('knowledgeVector', 'SQLITE', 'SUCCESS', 'search')
                                    failures = any(e['outcome'] != 'SUCCESS' for e in recorder.events[start_event:])
                                    r['status'] = 'DEGRADED' if failures or 'DEGRADED' in r['returnedMode'] or r['returnedMode'] == 'LOCAL_FALLBACK' else 'EXECUTED'
                                except Exception as error:
                                    r['status'], why = 'FAILED', type(error).__name__
                            if why:
                                r['reason'] = why
                            r['provenance'] = r.get('provenance') or recorder.snapshot(start_event)
                            required = []
                            if task == 'knowledge' and experiment != 'K-B' and profile in ('real-embedding', 'real-milvus', 'live-full'):
                                required.append('embedding')
                            if experiment == 'R-LLM' and profile in ('real-llm', 'live-full'):
                                required.append('llm')
                            if r['status'] == 'EXECUTED' and any(
                                r['provenance'].get(c, {}).get('source') != ['REAL'] or not r['provenance'][c]['success']
                                for c in required):
                                r['status'], r['reason'] = 'DEGRADED', 'REQUIRED_REAL_COMPONENT_NOT_EXECUTED'
                            if r['status'] not in ('NOT_RUN', 'UNSUPPORTED') and adapter == 'python':
                                r['latencyMs'] = (time.perf_counter() - t) * 1000
                            rows.append(r)
            finally:
                if owned:
                    owned.close()
                    resources.append(owned.manifest())
                if store:
                    store.close()
    incomplete = any(r['status'] in ('FAILED', 'NOT_RUN', 'DEGRADED') for r in rows)
    unsupported = any(r['status'] == 'UNSUPPORTED' for r in rows)
    from .metrics import score
    case_index = {c['caseId']: c for c in data['cases']}
    qrels = {q['caseId']: q for q in data['qrels']}
    boundary_violations = []
    for row in rows:
        row['scores'] = score(data, case_index[row['caseId']], qrels[row['caseId']], row)
        metrics = row['scores']
        if metrics.get('unauthorizedDisclosure', {}).get('value') == 1 or any(
            metrics.get('constraint.' + name, {}).get('value') not in (None, 1)
            for name in ('knownSku', 'stock', 'publication', 'merchant')):
            boundary_violations.append([row['caseId'], row['experiment'], row['repeat']])
    exit_code = 2 if unsupported else 1 if incomplete or boundary_violations or any(r['cleanup'].startswith('FAILED') for r in resources) else 0
    metadata = dict(startedAt=started, endedAt=now(), split=split, profile=profile, adapter=adapter,
                    experiments=requested, warmup=2, warmupStages=['knowledge.search'],
                    providerRequests=recorder.used, requestBudget=budget, boundaryViolations=boundary_violations,
                    actualComponents=recorder.snapshot(), resources=resources, humanReview='PENDING',
                    actualModels=recorder.models, usage=dict(tokens='UNKNOWN', cost='UNKNOWN', providerSeedSupport='UNKNOWN'),
                    status='PARTIAL', exitCode=exit_code,
                    configuration=dict(pythonHashSeed=os.environ.get('PYTHONHASHSEED', 'UNCONTROLLED'),
                                       rrfConstant=60, knowledgeSelectionDepth=6, skuPoolLimit=300,
                                       candidateLimit=12, recommendationLimit=3, llmRepetitions=3,
                                       indexHash=digest(data['products']), promptHash=prompt_hash()))
    if adapter == 'java-mysql' and java_rows is not None:
        metadata['importedExecution'] = True
        metadata['warmup'] = 0
        metadata['warmupStages'] = []
        metadata['executionRequests'] = 'SEE_INPUT_PLAN'
        metadata['resources'] = (java_metadata or {}).get('resources', [{'type': 'input-plan-resources', 'cleanup': 'NOT_CAPTURED'}])
        metadata['actualModels'] = (java_metadata or {}).get('actualModels', {'status': 'NOT_CAPTURED'})
        combined = {}
        for component in ('embedding', 'llm', 'productVector', 'knowledgeVector', 'javaMysql'):
            parts = [r['provenance'].get(component, {}) for r in rows]
            combined[component] = dict(source=sorted({s for p in parts for s in p.get('source', [])}) or ['NOT_USED'],
                **{k: sum(p.get(k, 0) for p in parts) for k in ('attempts', 'success', 'failure')})
        metadata['actualComponents'] = combined
    manifest = save(path, data, rows, metadata)
    return manifest


def prompt_hash():
    from app.engine import INTENT_SYSTEM, RECALL_SYSTEM, ANSWER_SYSTEM
    return digest([INTENT_SYSTEM, RECALL_SYSTEM, ANSWER_SYSTEM])
