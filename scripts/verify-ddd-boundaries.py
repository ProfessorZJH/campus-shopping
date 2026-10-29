#!/usr/bin/env python3
"""领域依赖、能力接口、查询读写与表归属门禁。带拒绝样例，不替代编译/真实事务测试。"""
from pathlib import Path
import datetime
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = ROOT/'campus-shopping-domain/src/main/java/cn/bugstack/ai/domain'
OWNERS = {'IAccessDao': 'iam_', 'IUserAccountDao': 'iam_', 'IAiDao': 'ai_',
          'ICatalogDao': 'cat_', 'ICatalogQueryDao': 'cat_', 'IInventoryDao': 'inv_',
          'IInventoryQueryDao': 'inv_', 'ITradingDao': 'trd_', 'IFulfillmentDao': 'ful_',
          'IMerchantDao': 'mer_', 'IMerchantApplicationDao': 'mer_'}
# 同库单体的明确只读投影。新增跨域表必须说明业务目的并修改此白名单。
READS = {
    ('ICatalogQueryDao', 'search'): {'mer_merchant', 'inv_stock_balance'},
    ('ICatalogQueryDao', 'count'): {'mer_merchant'},
    ('ICatalogQueryDao', 'recall'): {'mer_merchant'},
    ('ICatalogQueryDao', 'publicByIds'): {'mer_merchant'},
    ('ICatalogQueryDao', 'searchManaged'): {'inv_stock_balance'},
    ('IInventoryQueryDao', 'list'): {'cat_product', 'cat_sku'},
    ('IInventoryQueryDao', 'countStocks'): {'cat_product', 'cat_sku'},
}


def java_errors(path, source):
    source = re.sub(r'/\*.*?\*/|//[^\n]*', '', source, flags=re.S)
    errors = []
    match = re.search(r'package\s+cn\.bugstack\.ai\.domain\.(\w+)', source)
    if match:
        context = match[1]
        for target in re.findall(r'cn\.bugstack\.ai\.domain\.(\w+)\.', source):
            if target != context:
                errors.append('cross-domain-type')
        if re.search(r'cn\.bugstack\.ai\.(?:infrastructure|cases|trigger|api)\.', source):
            errors.append('domain-direction')
        if re.search(r'\b(?:org\.apache\.ibatis|java\.net|java\.sql|javax\.sql|okhttp3|org\.springframework\.web)\.', source):
            errors.append('domain-external-sdk')
        if '/model/aggregate/' in path and re.search(r'\b(?:private|protected)\s+String\s+(?:status|state)\b', source):
            errors.append('untyped-aggregate-state')
    if ('/cases/' in '/'+path or '/trigger/' in '/'+path) and re.search(r'\b(?:ITradingService|IAiStateService)\b', source):
        errors.append('broad-service-dependency')
    if path.endswith('/OrderController.java') and re.search(r'(?<![.\w])(?:trading|fulfillment|merchants|access)\.', source):
        errors.append('controller-order-orchestration')
    return sorted(set(errors))


def sql_errors(owner, statement, kind, sql):
    if owner not in OWNERS:
        return ['unregistered-mapper']
    errors = []
    if 'QueryDao' in owner and (kind != 'select' or re.search(r'\bFOR\s+UPDATE\b', sql, re.I)):
        errors.append('query-side-write-or-lock')
    sql = re.sub(r'ON\s+DUPLICATE\s+KEY\s+UPDATE.*', '', sql, flags=re.I|re.S)
    tables = set(re.findall(r'\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z][a-z_0-9]+)', sql, re.I))
    for table in tables:
        if table == 'recent':  # ai_message 的有界子查询别名。
            continue
        allowed = table.startswith(OWNERS[owner]) or (owner == 'IAccessDao' and table == 'sys_audit')
        if allowed:
            continue
        if kind == 'select' and table in READS.get((owner, statement), set()):
            continue
        errors.append('cross-domain-table-'+table)
    return sorted(set(errors))


def rejection_checks():
    cases = [
        ('cross-domain type', java_errors('domain/catalog/service/Bad.java',
            'package cn.bugstack.ai.domain.catalog.service; import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;'), 'cross-domain-type'),
        ('wrong dependency direction', java_errors('domain/catalog/service/Bad.java',
            'package cn.bugstack.ai.domain.catalog.service; import cn.bugstack.ai.infrastructure.dao.ICatalogDao;'), 'domain-direction'),
        ('HTTP SDK in domain', java_errors('domain/catalog/service/Bad.java',
            'package cn.bugstack.ai.domain.catalog.service; class Bad {java.net.http.HttpClient client;}'), 'domain-external-sdk'),
        ('raw aggregate state', java_errors('domain/trading/model/aggregate/Bad.java',
            'package cn.bugstack.ai.domain.trading.model.aggregate; class Bad {private String status;}'), 'untyped-aggregate-state'),
        ('broad service returns', java_errors('trigger/http/Bad.java',
            'class Bad { ITradingService trading; }'), 'broad-service-dependency'),
        ('cross-domain write', sql_errors('ITradingDao','bad','update','UPDATE mer_merchant SET status=1'), 'cross-domain-table-mer_merchant'),
        ('unapproved read', sql_errors('ICatalogDao','bad','select','SELECT * FROM mer_merchant'), 'cross-domain-table-mer_merchant'),
        ('query write', sql_errors('ICatalogQueryDao','bad','delete','DELETE FROM cat_product'), 'query-side-write-or-lock'),
        ('query lock', sql_errors('ICatalogQueryDao','bad','select','SELECT * FROM cat_product FOR UPDATE'), 'query-side-write-or-lock'),
        ('new projection table', sql_errors('ICatalogQueryDao','search','select','SELECT * FROM iam_user'), 'cross-domain-table-iam_user'),
    ]
    for label, actual, expected in cases:
        assert expected in actual, '门禁拒绝样例未被拦截：'+label
    assert not sql_errors('ICatalogQueryDao','search','select','SELECT p.* FROM cat_product p JOIN mer_merchant m ON m.id=p.merchant_id')
    return [label for label, _, _ in cases]


def verify():
    errors = []
    sources = list(ROOT.glob('campus-shopping-*/src/main/java/**/*.java'))
    for path in sources:
        name = path.relative_to(ROOT).as_posix()
        errors.extend(f'{name}: {e}' for e in java_errors(name, path.read_text('utf-8')))
    sql_count = 0
    for path in (ROOT/'campus-shopping-app/src/main/resources/mybatis/mapper').glob('*.xml'):
        mapper = ET.parse(path).getroot()
        owner = mapper.attrib['namespace'].rsplit('.',1)[-1]
        for node in mapper:
            if node.tag not in {'select','insert','update','delete'}:
                continue
            sql_count += 1
            errors.extend(f'{path.name}#{node.get("id")}: {e}' for e in sql_errors(owner,node.get('id'),node.tag,' '.join(node.itertext())))
    rejected = rejection_checks()
    report = {'status': 'FAIL' if errors else 'PASS', 'kind':'STATIC_BOUNDARIES_WITH_REJECTION_FIXTURES',
              'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'javaSources':len(sources),'sqlStatements':sql_count,'rejectedFixtures':rejected,'errors':errors}
    output=ROOT/'docs/testing/evidence/ddd-refactor-20261029/boundaries.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    assert not errors, 'DDD 边界门禁失败'


if __name__ == '__main__':
    verify()
