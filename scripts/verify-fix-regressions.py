#!/usr/bin/env python3
"""SDD-04 源码静态回归门禁；不替代 Maven、MySQL 和 Chromium 动态验证。"""
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
mapper=ROOT/'campus-shopping-app/src/main/resources/mybatis/mapper/icatalogquerydao_mapper.xml'

def verify_mapper(mapper_path):
    root=ET.parse(mapper_path).getroot()
    selectors={s.attrib['id']:s for s in root.findall('select')}
    fragments={s.attrib['id']:s for s in root.findall('sql')}

    def query_nodes(element, stack=()):
        # 只沿无条件 include 展开；把 include 放入其他动态分支不能冒充顶层过滤。
        for node in element:
            if node.tag=='if' and node.get('test')=="query!=null and query!=''":
                yield node
            elif node.tag=='include':
                ref=node.get('refid')
                assert ref in fragments and ref not in stack, ('include', ref)
                yield from query_nodes(fragments[ref], (*stack, ref))

    def predicate(name):
        nodes=list(query_nodes(selectors[name]))
        assert len(nodes)==1,(name,len(nodes))
        # 对 MyBatis 动态标签在内的整个 q 过滤分支做结构化对照。
        result=''.join(ET.tostring(nodes[0],encoding='unicode').split())
        assert 'LOCATE' in result and 'LIKE' not in result.upper(),name
        assert 's.spec_key' in result and 's.id' in result,name
        return result

    assert predicate('search')==predicate('count'),'公共商品 SELECT 与 COUNT 的 q 条件不一致'
    assert predicate('searchManaged')==predicate('countManaged'),'商户商品 SELECT 与 COUNT 的 q 条件不一致'
    assert 'm.name' in predicate('search'),'公开搜索未匹配商户名'
    assert 's.status' in predicate('search'),'公开搜索应屏蔽不再激活的 SKU'

# SKU 分批由 CatalogPageSkuBatchTest 经生产 Controller 和查询 Case 验证；
# 上下文切换与旧请求防护由 ui_fix_regression.py 的浏览器行为断言验证。
# 不再绑定变量名、空白或具体循环写法，也不在 Python 重写 Java 算法。
if __name__=='__main__':
    verify_mapper(mapper)
    print('[PASS] SDD-04 Mapper 搜索/COUNT 结构一致；行为回归由 Maven/Chromium 执行')
