"""从用户原文与服务端SKU规格核实明确要求；不读取评测标签或信任模型改写。"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


def normalize(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text).casefold())


def values(spec):
    # 兼容单值和“颜色:黑色;包装:标准装”；描述/标题不是SKU规格证据。
    return {part.rsplit(':', 1)[-1] for part in re.split(r'[,，;；/|、]', normalize(spec)) if part}


def dimension(value):
    if value.endswith('装'): return 'pack'
    if value.endswith('色'): return 'color'
    if value.endswith('杯'): return 'cup'
    if value.endswith(('号', '型')): return 'size'
    for units, axis in ((r'(?:ml|l)', 'volume'), (r'(?:kg|g)', 'mass'), (r'(?:cm|mm)', 'length'), (r'码', 'size')):
        if re.fullmatch(r'\d+(?:\.\d+)?' + units, value): return axis
    return 'spec'


NEGATIVE = r'不要推荐|不想要|不想选|不想买|不需要|不要选|不推荐|不接受|不喜欢|不要|不选|不买|不用|别推荐|别选|别买|排除|不考虑|不含|不是|拒绝|非'
CUES = re.compile(r'(' + NEGATIVE + r'|只要|想要|规格为|规格是|要|选择|选|换成|改成|改为)')


@dataclass(frozen=True)
class SpecConstraints:
    required: frozenset = frozenset()
    forbidden: frozenset = frozenset()
    ambiguous: bool = False

    @property
    def active(self):
        return bool(self.required or self.forbidden or self.ambiguous)

    def accepts(self, offer):
        actual = values(offer['specKey'])
        return (not self.ambiguous and self.required <= actual and not self.forbidden & actual
                and all(any(dimension(v) == dimension(term) for v in actual) for term in self.forbidden))


def extract(question, vocabulary, titles=()):
    text = normalize(question)
    terms = set(vocabulary)
    # 即使当前报价没有该规格，也不能悄悄用其他规格替代。
    terms.update(re.findall(r'(?<![a-z0-9.])\d+(?:\.\d+)?(?:ml|kg|cm|mm|l|g|码)(?![a-z0-9.])', text))
    # 显式属性前缀即使不在候选中也必须约束；数量/商品名称不当作属性。
    for match in re.finditer(r'(?<!需)(?:' + NEGATIVE + r'|只要|想要|规格为|规格是|换成|改成|改为|选择|要|选)([^,，。;；!?？]{1,40})', text):
        token = re.split(CUES, match.group(1))[0]
        original_token = token
        token = re.sub(r'^[0-9一二两三四五六七八九十]+(?:个|件|份|瓶|盒|包|本|支|杯|袋)', '', token)
        starts_attribute = any(token.startswith(v) for v in vocabulary) or re.match(r'^.{1,2}?(?:装|色|码|杯|号|型)|^\d+(?:\.\d+)?(?:ml|kg|cm|mm|l|g)', token)
        if original_token != token and not starts_attribute: continue
        for title in sorted(titles, key=len, reverse=True):
            token = token.split(normalize(title), 1)[0]
        token = token.rstrip('的')
        # 逐个消费组合属性，不能因第一个属性已知就丢掉后续未知维度。
        atoms = '|'.join(re.escape(v) for v in sorted(vocabulary, key=lambda v: (-len(v), v)))
        atom_pattern = (atoms + '|' if atoms else '') + r'\d+(?:\.\d+)?(?:ml|kg|cm|mm|l|g|码)|.{1,12}?(?:装|色|码|杯|号|型)'
        cursor = 0
        for attribute in re.finditer(atom_pattern, token):
            value = re.sub(r'^(?:和|及|与|并且|同时|的|也)+', '', attribute.group())
            if value: terms.add(value)
            cursor = attribute.end()
        remainder = re.sub(r'^(?:和|及|与|并且|同时|的|也)+', '', token[cursor:])
        product_name = any(remainder and remainder in normalize(title) for title in titles)
        if remainder and not product_name and (match.group().startswith(('规格为', '规格是')) or (match.group().startswith(('只要', '要', '换成', '改成', '改为')) and len(remainder) <= 8)):
            terms.add(remainder)
    if not terms: return SpecConstraints()
    pattern = '|'.join(re.escape(v) for v in sorted(terms, key=lambda v: (-len(v), v)))
    required, forbidden = set(), set()
    ambiguous = bool(re.search(r'不是不要|并非不要', text))
    for match in re.finditer(pattern, text):
        term = match.group()
        if term.isascii() and (re.search(r'[a-z0-9.]$', text[:match.start()]) or re.match(r'[a-z0-9.]', text[match.end():])):
            continue
        clause = re.split(r'[,，。;；!?？]|但是|而是', text[:match.start()])[-1]
        cues = list(CUES.finditer(clause))
        negative = bool(cues and re.fullmatch(NEGATIVE, cues[-1].group()))
        if re.match(r'(?:不要|不选|不考虑)(?:[,，。;；!?？]|$)', text[match.end():]): negative = True
        suffix_clause = re.split(r'[,，。;；!?？]', text[match.end():])[0]
        if re.search(r'都(?:不要|不选|不考虑)$', suffix_clause): negative = True
        (forbidden if negative else required).add(term)
    return SpecConstraints(frozenset(required), frozenset(forbidden), ambiguous or bool(required & forbidden))


def spec_constraints(question, history, offers, followup):
    vocabulary = {v for offer in offers for v in values(offer['specKey']) if len(v) >= 2}
    titles = [offer['title'] for offer in offers]
    current = extract(question, vocabulary, titles)
    required, forbidden = set(current.required), set(current.forbidden)
    axes = {dimension(v) for v in required | forbidden}
    ambiguous = current.ambiguous
    if followup.search(question):
        for previous in reversed([h['content'] for h in history if h['role'] == 'user']):
            inherited = extract(previous, vocabulary, titles)
            inherited_terms = inherited.required | inherited.forbidden
            new_axes = {dimension(v) for v in inherited_terms} - axes
            required.update(v for v in inherited.required if dimension(v) in new_axes)
            forbidden.update(v for v in inherited.forbidden if dimension(v) in new_axes)
            if new_axes: ambiguous = ambiguous or inherited.ambiguous
            axes.update(new_axes)
            if not followup.search(previous): break
    return SpecConstraints(frozenset(required), frozenset(forbidden), ambiguous)
