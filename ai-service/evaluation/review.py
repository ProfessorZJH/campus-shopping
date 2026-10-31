"""只呈现合成草稿供人复核，不自动填写人类判断。"""
from html import escape
import hashlib
import json
from pathlib import Path
from .dataset import write_jsonl


def export(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    annotations = path.parent / 'annotations.jsonl'
    for existing in (path, annotations):
        if existing.exists():
            raise FileExistsError(existing)
    qrels = {r['caseId']: r for r in data['qrels']}
    products = {r['productId']: r for r in data['products']}
    docs = {r['documentId']: r for r in data['knowledge']}
    def pretty(value):
        return '<pre>' + escape(json.dumps(value, ensure_ascii=False, indent=2)) + '</pre>'
    def anchor(kind, value):
        return kind + '-' + hashlib.sha256(value.encode('utf-8')).hexdigest()
    parts = ['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>导购评测人工复核包</title>',
             '<style>body{font:16px/1.6 system-ui;max-width:1100px;margin:30px auto;padding:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:15px}article{border-top:2px solid #ddd;margin:30px 0}a{color:#174ea6}</style>',
             '<h1>人工复核包 · DRAFT</h1><p>全部标签由AI辅助起草，尚未人工验收。请依据完整语料检查遗漏/错标、权限、规格、可行性和证据位置；不要依据被测结果改gold。不得用一次确认代替逐例复核。</p>',
             '<p>数据摘要：' + escape(data['datasetHash']) + '</p>',
             '<p>0=无关，1=背景/部分匹配，2=直接满足。主题相关性与预算/库存可行性分别判断。下方每例是草稿，页尾提供全240商品和24文档，不只展示当前gold。</p>',
             '<p>实际评审填写同目录annotations.jsonl中的reviewer/reviewedAt/reviewStatus；改case/qrels须同步摘要、标注版本及manifest文件摘要。完整规则见数据README。</p>']
    for c in data['cases']:
        qr = qrels[c['caseId']]
        parts += ['<article id="' + anchor('case', c['caseId']) + '"><h2>' + escape(c['caseId']) + ' · ' + escape(c['queryType']) + ' · ' + escape(c['split']) + '</h2>',
                  '<h3>' + escape(c['originalQuery']) + '</h3>', pretty(c), '<h3>草稿相关集/证据定位</h3>', pretty(qr),
                  '<p>全语料中的草稿商品：' + '、'.join('<a href="#' + anchor('product', pid) + '">' + escape(products[pid]['title']) + '</a>' for pid in qr['product']) + '</p>',
                  '<p>草稿证据：' + '、'.join('<a href="#' + anchor('document', did) + '">' + escape(docs[did]['title']) + '</a>' for did in qr['document']) + '</p></article>']
    parts += ['<h1>完整商品语料</h1>']
    for p in data['products']:
        parts += ['<details id="' + anchor('product', p['productId']) + '"><summary>' + escape(p['productId'] + ' ' + p['title']) + '</summary>', pretty(p), '</details>']
    parts += ['<h1>完整知识语料（全部为合成材料）</h1>']
    for d in data['knowledge']:
        parts += ['<details id="' + anchor('document', d['documentId']) + '"><summary>' + escape(d['documentId'] + ' ' + d['title']) + '</summary>', pretty(d), '</details>']
    parts += ['</html>']
    path.write_text('\n'.join(parts), encoding='utf-8')
    write_jsonl(annotations, data['annotations'])
    return path
