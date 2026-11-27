"""只呈现合成草稿供人复核，不自动填写人类判断。"""
from collections import Counter
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
    ann_by_id = {r['caseId']: r for r in data['annotations']}
    products = {r['productId']: r for r in data['products']}
    skus = {s['skuId']: (p, s) for p in data['products'] for s in p['skus']}
    docs = {r['documentId']: r for r in data['knowledge']}
    manifest = data.get('manifest', {})
    challenges = data.get('challenge') or []

    def pretty(value):
        return '<pre>' + escape(json.dumps(value, ensure_ascii=False, indent=2)) + '</pre>'

    def anchor(kind, value):
        return kind + '-' + hashlib.sha256(value.encode('utf-8')).hexdigest()

    split_counts = {k: len(v) for k, v in data.get('splits', {}).items()}
    category_counts = dict(Counter(c['queryType'] for c in data['cases']))
    family_counts = Counter(c['familyId'] for c in data['cases'])
    multi_family_count = sum(v > 1 for v in family_counts.values())
    disputed_cases = [c for c in data['cases'] if ann_by_id.get(c['caseId'], {}).get('disputed') is True]

    overview = {
        'datasetId': manifest.get('datasetId'),
        'version': manifest.get('version'),
        'status': manifest.get('status'),
        'datasetHash': data['datasetHash'],
        'synthetic': manifest.get('synthetic', True),
        'dataOrigin': manifest.get('dataOrigin', 'SYNTHETIC_BENCHMARK_ONLY'),
        'annotationGovernance': 'AI_ASSISTED / DRAFT（未经人工逐例复核不得标记 HUMAN_REVIEWED 或 ACCEPTED）',
        'totalCases': len(data['cases']),
        'splitCounts': split_counts,
        'categoryCounts': category_counts,
        'multiCaseFamilyCount': multi_family_count,
        'disputedCount': len(disputed_cases),
        'challengeCount': len(challenges),
        'productCount': len(products),
        'skuCount': len(skus),
        'documentCount': len(docs),
    }

    parts = [
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>导购评测人工复核包</title>',
        '<style>body{font:16px/1.6 system-ui;max-width:1100px;margin:30px auto;padding:20px}'
        'pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:15px}'
        'article{border-top:2px solid #ddd;margin:30px 0;padding-top:12px}'
        '.banner{background:#fff8e1;border:1px solid #f0c36d;padding:16px;border-radius:6px;margin-bottom:24px}'
        '.disputed-box{background:#fdecea;border:1px solid #f5c2c7;padding:16px;border-radius:6px;margin:20px 0}'
        '.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:13px;background:#eef3fc;margin-right:6px}'
        '.badge-warn{background:#f8d7da;color:#842029}'
        'a{color:#174ea6}</style>',
        '<h1>人工复核包 · ' + escape(str(manifest.get('datasetId', 'dataset'))) + ' · ' + escape(str(manifest.get('status', 'DRAFT'))) + '</h1>',
        '<section class="banner">',
        '<p><strong>合成语料与草稿声明（SYNTHETIC / AI_ASSISTED / DRAFT）：</strong>全部语料均为虚构校园合成材料，不含真实个人信息；'
        '全部 Gold 标签由确定性规则与 AI 辅助起草（<code>annotationSource=AI_ASSISTED</code>, <code>reviewStatus=DRAFT</code>），尚未完成人工验收。'
        '请依据完整语料逐例检查遗漏/错标、权限、规格、预算库存可行性和证据位置；严禁依据被测系统输出回调 Gold，不得用批量脚本代替逐例人工复核。</p>',
        '<p>数据摘要：<code>' + escape(data['datasetHash']) + '</code></p>',
        pretty(overview),
        '<p>0=无关，1=主题相关/背景参考，2=可行首选/核心必需证据。主题相关性与预算/库存可行性分别判断。'
        '实际评审填写同目录 <code>annotations.jsonl</code> 中的 <code>reviewer</code> / <code>reviewedAt</code> / <code>reviewStatus</code> / <code>disputed</code>；'
        '修改 case/qrels 须同步摘要、标注版本及 manifest 文件摘要。</p>',
        '</section>',
        '<section class="disputed-box"><h2>争议与重点复核样本 (Disputed / Priority Cases)</h2>',
    ]
    if disputed_cases:
        parts.append('<ul>')
        for dc in disputed_cases:
            dann = ann_by_id[dc['caseId']]
            parts.append(
                '<li><a href="#' + anchor('case', dc['caseId']) + '">' + escape(dc['caseId']) + '</a>'
                ' [' + escape(dc['queryType']) + ' / ' + escape(dc['split']) + '] — '
                + escape(dc['originalQuery']) + '<br><small>争议说明：' + escape(str(dann.get('rationale', ''))) + '</small></li>'
            )
        parts.append('</ul>')
    else:
        parts.append('<p>当前标记 <code>disputed=true</code> 的待裁决样本数：0。</p>')
    parts.append('</section>')

    for c in data['cases']:
        cid = c['caseId']
        qr = qrels.get(cid, {'product': {}, 'sku': {}, 'document': {}, 'evidence': []})
        ann = ann_by_id.get(cid, {})
        disputed_flag = ann.get('disputed') is True
        badge_html = (
            '<span class="badge badge-warn">DISPUTED=TRUE 重点复核</span>'
            if disputed_flag else '<span class="badge">disputed=false</span>'
        )
        prod_links = [
            '<a href="#' + anchor('product', pid) + '">' + escape(pid + ' ' + products[pid]['title']) + '</a> '
            + ('<code>[grade=2 可行首选]</code>' if grade == 2 else f'<code>[grade={grade} 主题相关]</code>')
            for pid, grade in sorted(qr.get('product', {}).items(), key=lambda kv: (-kv[1], kv[0]))
            if pid in products
        ]
        sku_items = []
        for sid, grade in sorted(qr.get('sku', {}).items(), key=lambda kv: (-kv[1], kv[0])):
            if sid not in skus:
                continue
            p_obj, s_obj = skus[sid]
            label = '[grade=2 可行首选]' if grade == 2 else f'[grade={grade} 主题相关]'
            sku_items.append(
                '<a href="#' + anchor('product', p_obj['productId']) + '">'
                + escape(f"{sid} ({p_obj['title']} / {s_obj['specKey']} / ¥{s_obj['priceCent']/100:.2f})")
                + '</a> <code>' + escape(label) + '</code>'
            )
        doc_links = [
            '<a href="#' + anchor('document', did) + '">' + escape(did + ' ' + docs[did]['title']) + '</a> '
            + ('<code>[grade=2 核心文档]</code>' if grade == 2 else f'<code>[grade={grade} 参考文档]</code>')
            for did, grade in sorted(qr.get('document', {}).items(), key=lambda kv: (-kv[1], kv[0]))
            if did in docs
        ]
        ev_items = [
            '<a href="#' + anchor('document', ev['documentId']) + '">'
            + escape(f"({ev['documentId']}, ordinal={ev['ordinal']}, grade={ev['grade']})")
            + '</a>'
            for ev in qr.get('evidence', [])
        ]
        case_meta = {
            'actorRef': c['actorRef'],
            'familyId': c['familyId'],
            'conversationContext': c.get('conversationContext', []),
            'constraints': c.get('constraints', {}),
            'expectedBehavior': c.get('expectedBehavior', {}),
            'annotation': {
                'reviewStatus': ann.get('reviewStatus'),
                'annotationSource': ann.get('annotationSource'),
                'disputed': ann.get('disputed'),
                'rationale': ann.get('rationale'),
            },
        }
        parts += [
            '<article id="' + anchor('case', cid) + '"><h2>' + escape(cid) + ' · ' + escape(c['queryType']) + ' · ' + escape(c['split']) + ' ' + badge_html + '</h2>',
            '<h3>' + escape(c['originalQuery']) + '</h3>',
            '<p><strong>角色 / 多轮上下文 / 约束 / 期望行为 / 标注说明：</strong></p>',
            pretty(case_meta),
            '<p>全语料中的草稿商品：' + ('、'.join(prod_links) if prod_links else '无') + '</p>',
            '<p>草稿相关 SKU：' + ('、'.join(sku_items) if sku_items else '无') + '</p>',
            '<p>草稿证据文档：' + ('、'.join(doc_links) if doc_links else '无') + '</p>',
            '<p>草稿证据分块 (documentId, ordinal, grade)：' + ('、'.join(ev_items) if ev_items else '无') + '</p>',
            '<details><summary>展开完整 Case 与 Qrels 原始 JSON</summary>',
            pretty(c),
            '<h3>草稿相关集/证据定位</h3>',
            pretty(qr),
            '</details></article>',
        ]

    if challenges:
        parts += [
            '<h1>独立挑战集 · UNSUPPORTED 未实现能力边界（' + str(len(challenges)) + ' 例）</h1>',
            '<p>以下场景属于当前系统明确未实现或未开放的能力，单独统计为 <code>UNSUPPORTED</code>，不计入主评测集分母。</p>',
        ]
        for ch in challenges:
            parts += [
                '<article id="' + anchor('case', 'challenge:' + ch['caseId']) + '">',
                '<h2>' + escape(ch['caseId']) + ' · ' + escape(ch['category']) + ' · <code>' + escape(ch['unsupportedCapability']) + '</code></h2>',
                '<h3>' + escape(ch['originalQuery']) + '</h3>',
                pretty(ch),
                '</article>',
            ]

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
