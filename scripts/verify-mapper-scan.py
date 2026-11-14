#!/usr/bin/env python3
"""Mapper 全表扫描门禁：禁止在未收窄的查询里做不可索引的匹配。

本脚本通过启发式规则识别可能无法利用普通索引的子串匹配，并检查是否有
无条件等值收窄或经登记的例外。它不能代替 SQL 语义审查或数据库执行计划。

判定方式：
1. 递归展开 <include refid> 后再判断，避免条件抽到 <sql> 片段后规则漏检。
2. 收窄条件必须是**无条件**的（先剔除 <if> 包裹的部分）。可选的 merchantId
   参数不等于收窄——消费者搜索恰恰不传它。
"""
import glob
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAPPER_GLOB = 'campus-shopping-*/src/main/resources/mybatis/mapper/*.xml'
APP_MAPPER_DIR = 'campus-shopping-app/src/main/resources/mybatis/mapper'

# 全表扫描谓词：命中任意一条即视为不可索引匹配。
IDENTIFIER = r'(?:`[^`]+`|[a-z_]\w*)'
SCAN_PATTERNS = [
    ('LOCATE_SUBSTRING', re.compile(r'\blocate\s*\(', re.IGNORECASE)),
    ('LEADING_WILDCARD', re.compile(r'''\blike\b\s*\(?\s*(?:['"]%|concat\s*\(\s*['"]%)''', re.IGNORECASE)),
    ('FUNCTION_ON_COLUMN', re.compile(
        rf'\blower\s*\(\s*(?:{IDENTIFIER}\s*\.\s*)?{IDENTIFIER}\s*\)', re.IGNORECASE)),
]

# 只认可独立的顶层 AND 合取项；不能把 OR 分支或子查询中的条件当成全局收窄。
NARROWING_TERM = re.compile(
    r'\s*(?:[a-z_]\w*\s*\.\s*)?(?:merchant_id|store_id|product_id|category_code)\s*=\s*#\{[^}]+\}\s*'
    r'|\s*(?:[a-z_]\w*\s*\.\s*)?(?:id|sku_id|product_id)\s+in\s*\('
    r'\s*(?:#\{[^}]+\}|\d+)(?:\s*,\s*(?:#\{[^}]+\}|\d+))*\s*\)\s*',
    re.IGNORECASE,
)

# 用于保守识别 SQL 顶层 WHERE、AND 和 OR；这不是完整的 SQL 解析器。
SQL_TOKEN = re.compile(
    r"(?P<quoted>'(?:''|\\.|[^'\\])*'|\"(?:\"\"|\\.|[^\"\\])*\"|`(?:``|[^`])*`)"
    r'|(?P<parameter>[#$]\{[^}]*\})|(?P<comment>--[^\n]*|#(?!\{)[^\n]*|/\*[\s\S]*?\*/)'
    r'|(?P<paren>[()])|(?P<word>[a-z_]\w*)|(?P<other>.)',
    re.IGNORECASE | re.DOTALL,
)
LIKE_BIND = re.compile(r'\blike\b\s*\(?\s*[#$]\{\s*([a-z_]\w*)(?:\s*,[^}]*)?\s*\}', re.IGNORECASE)
BIND_LITERAL = re.compile(r'''^\s*\(*\s*['"]%''')
BIND_REFERENCE = re.compile(r'^\s*\(*\s*([a-z_]\w*)\b', re.IGNORECASE)

# 已登记豁免：必须写明原因与到期日；到期后重新评审，不允许无限期挂账。
ALLOW = {
    f'{APP_MAPPER_DIR}/icatalogquerydao_mapper.xml#search': {
        'reason': '消费者全局搜索，候选集必须覆盖全量已上架商品，无法用等值条件收窄；整改方向见 A2（FULLTEXT/向量召回）。',
        'until': '2027-03-31',
    },
    f'{APP_MAPPER_DIR}/icatalogquerydao_mapper.xml#count': {
        'reason': '与 search 共用同一过滤片段，必须同批整改，否则列表与总数会分叉。',
        'until': '2027-03-31',
    },
    f'{APP_MAPPER_DIR}/icatalogquerydao_mapper.xml#recall': {
        'reason': 'AI 召回需对全量公开商品打分；整改方向是把打分移出 SQL、只保留有界候选召回。',
        'until': '2027-03-31',
    },
    # 平台后台的全量列表：调用方 /admin/orders、/admin/merchant-applications、/admin/merchants
    # 均把过滤参数声明为可选，不传就没有任何收窄条件。订单表是最大表，优先级最高。
    f'{APP_MAPPER_DIR}/itradingdao_mapper.xml#orders': {
        'reason': '平台后台订单列表，state/q 均可选，不传时全表扫描且 countOrders 同形；整改=强制时间窗或游标。',
        'until': '2026-12-31',
    },
    f'{APP_MAPPER_DIR}/itradingdao_mapper.xml#countOrders': {
        'reason': '与 orders 共用同一过滤条件，必须与二者同批整改。',
        'until': '2026-12-31',
    },
    f'{APP_MAPPER_DIR}/itradingdao_mapper.xml#ordersByPickupState': {
        'reason': '平台工作台按履约状态筛订单，buyer/merchant 均为空；整改随 orders 同批。',
        'until': '2026-12-31',
    },
    f'{APP_MAPPER_DIR}/itradingdao_mapper.xml#countOrdersByPickupState': {
        'reason': '与 ordersByPickupState 共用条件，必须同批整改。',
        'until': '2026-12-31',
    },
    f'{APP_MAPPER_DIR}/imerchantapplicationdao_mapper.xml#list': {
        'reason': '平台审核列表 state 可选；表行数与入驻申请量同级（百量级），分页可接受；整改=待审默认 state=SUBMITTED。',
        'until': '2027-03-31',
    },
    f'{APP_MAPPER_DIR}/imerchantapplicationdao_mapper.xml#count': {
        'reason': '与 list 共用条件，必须同批整改。',
        'until': '2027-03-31',
    },
    f'{APP_MAPPER_DIR}/imerchantdao_mapper.xml#list': {
        'reason': '平台商户列表 activeOnly=false 时无收窄；商户数量与校区规模同级，分页可接受。',
        'until': '2027-03-31',
    },
    f'{APP_MAPPER_DIR}/imerchantdao_mapper.xml#count': {
        'reason': '与 list 共用条件，必须同批整改。',
        'until': '2027-03-31',
    },
}

# 这些动态分支可能不执行，不能把其中的条件算作无条件收窄。
CONDITIONAL_TAGS = {'if', 'choose', 'when', 'otherwise', 'foreach'}


def top_level_where(statement):
    """提取顶层 WHERE 和其顶层关键字；不理解的结构不作为收窄证据。"""
    depth = 0
    words = []
    for token in SQL_TOKEN.finditer(statement):
        kind, value = token.lastgroup, token.group()
        if kind == 'paren':
            depth += 1 if value == '(' else -1
            if depth < 0:
                return None
        elif kind == 'other' and value in "'\"`":
            return None
        elif kind == 'word' and depth == 0:
            words.append((value.upper(), token.start(), token.end()))
    if depth:
        return None
    if any(word in {'UNION', 'INTERSECT', 'EXCEPT'} for word, _, _ in words):
        return None
    where = next((i for i, (word, _, _) in enumerate(words) if word == 'WHERE'), None)
    if where is None:
        return None
    start = words[where][2]
    end = len(statement)
    for word, position, _ in words[where + 1:]:
        if word in {'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'FOR'}:
            end = position
            break
    relevant = [(word, position, stop) for word, position, stop in words[where + 1:] if position < end]
    return start, end, relevant


def has_unconditional_narrowing(statement, unconditional):
    """仅在完整和无条件路径均无顶层 OR 时，接受顶层 AND 中的独立收窄项。"""
    full_where = top_level_where(statement)
    required_where = top_level_where(unconditional)
    if full_where is None or required_where is None:
        return False
    for where in (full_where, required_where):
        if any(word in {'OR', 'BETWEEN', 'CASE'} for word, _, _ in where[2]):
            return False
    start, end, words = required_where
    boundaries = [(position, stop) for word, position, stop in words if word == 'AND']
    for position, stop in boundaries + [(end, end)]:
        term = unconditional[start:position].strip()
        # 单层括号包住纯等值条件时也可以安全识别。
        if term.startswith('(') and term.endswith(')'):
            term = term[1:-1].strip()
        if NARROWING_TERM.fullmatch(term):
            return True
        start = stop
    return False


def expanded_sql(element, fragments, include_optional=True, stack=()):
    """递归展开片段；判定收窄时跳过可能不执行的动态分支。"""
    parts = [element.text or '']
    for child in element:
        if child.tag == 'include':
            name = child.get('refid')
            if name not in fragments:
                raise ValueError(f'无法解析 mapper 片段: {name}')
            if name in stack:
                raise ValueError(f'mapper 片段循环引用: {name}')
            parts.append(expanded_sql(fragments[name], fragments, include_optional, (*stack, name)))
        elif include_optional or child.tag not in CONDITIONAL_TAGS:
            parts.append(expanded_sql(child, fragments, include_optional, stack))
        parts.append(child.tail or '')
    return ' '.join(parts)


def wildcard_bindings(element, fragments):
    """收集可能产生前导 % 的 bind；无法推断的运行时参数仍需人工审查。"""
    bindings = {}

    def collect(node, stack=()):
        for child in node:
            if child.tag == 'bind':
                bindings.setdefault(child.get('name', ''), []).append(child.get('value', ''))
            elif child.tag == 'include':
                name = child.get('refid')
                if name not in fragments or name in stack:
                    raise ValueError(f'无法解析 mapper 片段: {name}')
                collect(fragments[name], (*stack, name))
            else:
                collect(child, stack)

    collect(element)
    wildcard = set()
    changed = True
    while changed:
        changed = False
        for name, expressions in bindings.items():
            for expression in expressions:
                reference = BIND_REFERENCE.match(expression)
                if name not in wildcard and (BIND_LITERAL.match(expression) or
                                             (reference and reference.group(1) in wildcard)):
                    wildcard.add(name)
                    changed = True
    return wildcard


def scan(path):
    """返回该 mapper 里每一处不可索引匹配的发现。"""
    root = ET.parse(path).getroot()
    fragments = {fragment.get('id'): fragment for fragment in root.findall('sql')}
    findings = []
    for select in root.findall('select'):
        statement = expanded_sql(select, fragments)
        hits = [name for name, pattern in SCAN_PATTERNS if pattern.search(statement)]
        if any(token.lastgroup == 'word' and token.group().upper() in {'REGEXP', 'RLIKE', 'REGEXP_LIKE'}
               for token in SQL_TOKEN.finditer(statement)):
            hits.append('REGEXP_MATCH')
        bound_wildcards = wildcard_bindings(select, fragments)
        if any(match.group(1) in bound_wildcards for match in LIKE_BIND.finditer(statement)):
            if 'LEADING_WILDCARD' not in hits:
                hits.append('LEADING_WILDCARD')
        if not hits:
            continue
        unconditional = expanded_sql(select, fragments, include_optional=False)
        try:
            filename = path.resolve().relative_to(ROOT.resolve()).as_posix()
        except ValueError:
            filename = path.resolve().as_posix()
        findings.append({
            'file': filename,
            'statement': select.get('id', '<unknown>'),
            'patterns': hits,
            'narrowed': has_unconditional_narrowing(statement, unconditional),
        })
    return findings


def main():
    argv = sys.argv[1:]
    verbose = '--list' in argv
    paths = [Path(p) for p in sorted(glob.glob(str(ROOT / MAPPER_GLOB)))]
    if not paths:
        print('未找到任何 mapper 文件，检查 MAPPER_GLOB 是否与实际布局一致')
        return 1

    failures = []
    scanned = 0
    for path in paths:
        for finding in scan(path):
            scanned += 1
            key = f"{finding['file']}#{finding['statement']}"
            allowed = ALLOW.get(key)
            # 豁免带到期日：过期后自动恢复为越界，防止挂账变成永久豁免。
            expired = allowed is not None and allowed['until'] < date.today().isoformat()
            effective = allowed is not None and not expired
            verdict = 'PASS' if finding['narrowed'] or effective else 'FAIL'
            if verdict == 'FAIL':
                failures.append((key, finding, expired))
            if verbose or verdict == 'FAIL':
                if finding['narrowed']:
                    detail = 'narrowed'
                elif expired:
                    detail = f"allowlist-expired({allowed['until']})"
                elif effective:
                    detail = f"allowlisted(until {allowed['until']})"
                else:
                    detail = 'unbounded'
                print(f"{verdict} {key} patterns={','.join(finding['patterns'])} scope={detail}")

    print(f"mapper 扫描完成：{len(paths)} 个文件，{scanned} 处子串匹配，{len(failures)} 处越界")
    if not failures:
        return 0

    print('\n未收窄的全表扫描（要么加等值收窄，要么登记到 ALLOW 并写明原因与到期日）：')
    for key, finding, expired in failures:
        tag = '  [豁免已过期]' if expired else ''
        print(f"  - {key}  {','.join(finding['patterns'])}{tag}")
    return 1


if __name__ == '__main__':
    sys.exit(main())
