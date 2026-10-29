#!/usr/bin/env python3
"""SDD-04 源码静态回归门禁；不替代 Maven、MySQL 和 Chromium 动态验证。"""
from pathlib import Path
from xml.etree import ElementTree as ET
import re

ROOT=Path(__file__).resolve().parents[1]
mapper=ROOT/'campus-shopping-app/src/main/resources/mybatis/mapper/icatalogdao_mapper.xml'
root=ET.parse(mapper).getroot()
selectors={s.attrib['id']:s for s in root.findall('select')}

def predicate(name):
    nodes=[node for node in selectors[name] if node.tag=='if' and node.get('test')=="query!=null and query!=''"]
    assert len(nodes)==1,(name,len(nodes))
    # 对 MyBatis 动态标签在内的整个 q 过滤分支做结构化对照。
    node=nodes[0]
    result=''.join(ET.tostring(node,encoding='unicode').split())
    assert 'LOCATE' in result and 'LIKE' not in result.upper(),name
    assert 's.spec_key' in result and 's.id' in result,name
    return result

assert predicate('search')==predicate('count'),'公共商品 SELECT 与 COUNT 的 q 条件不一致'
assert predicate('searchManaged')==predicate('countManaged'),'商户商品 SELECT 与 COUNT 的 q 条件不一致'
assert 'm.name' in predicate('search'),'公开搜索未匹配商户名'
assert 's.status' in predicate('search'),'公开搜索应屏蔽不再激活的 SKU'

controller=(ROOT/'campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/CatalogController.java').read_text('utf-8')
assert 'start+=500' in controller and 'ids.subList(start,Math.min(start+500,ids.size()))' in controller
assert 'inventory.stocks(ids)' not in controller,'商品页仍一次查询全部 SKU'
for amount in (0,1,999,1000,1020,2000):
    groups=[list(range(amount))[start:start+500] for start in range(0,amount,500)]
    assert all(0<len(x)<=500 for x in groups)
    assert sum(map(len,groups))==amount
# Java 的运行时分批行为由 CatalogPageSkuBatchTest（Maven）进一步断言。

source=(ROOT/'frontend/src/services/store.js').read_text('utf-8')
assert 'sessionEpoch' in source and 'merchantEpoch' in source and 'publicEpoch' in source
assert 'setRoute(){' in source and '++publicEpoch;++merchantEpoch' in source
for f, fragments in {
    'frontend/src/pages/Home.js':('beginPublicSearch','publicSearchCurrent'),
    'frontend/src/pages/MerchantOps.js':('loadVersion','store.merchantId===mid'),
    'frontend/src/pages/Platform.js':('clearPrivateViews','const valid=','()=>store.user?.userId'),
    'frontend/src/pages/Shop.js':('loadVersion','currentPage===page.value'),
    'frontend/src/pages/Guide.js':('conversationEpoch','historyEpoch'),
    'frontend/src/pages/Knowledge.js':('baseEpoch','docEpoch','b.merchantId===mid'),
    'frontend/src/components/ConsumerShell.js':('replaceSession(null)','@success="loadPublic"'),
}.items():
    body=(ROOT/f).read_text('utf-8')
    for token in fragments:assert token in body,(f,token)
print('[PASS] SDD-04 静态专项检查：商品 SKU 分批、搜索/COUNT 同构、上下文与旧请求防护')
