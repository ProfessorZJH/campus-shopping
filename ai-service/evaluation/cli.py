import argparse
import json
from pathlib import Path
from .dataset import load, DatasetError
from .provenance import PROFILES
from .reports import new_run, recompute
from .runner import run


def main(argv=None):
    parser = argparse.ArgumentParser(description='校园导购评测：默认legacy-demo；正式数据须人工冻结。')
    parser.add_argument('--dataset')
    parser.add_argument('--split', choices=('smoke', 'dev', 'test'), default='dev')
    parser.add_argument('--profile', choices=PROFILES, default='local')
    parser.add_argument('--adapter', choices=('python', 'java-mysql'), default='python')
    parser.add_argument('--experiments', default='K-B,K-D,K-H,R-RULE')
    parser.add_argument('--formal', action='store_true')
    parser.add_argument('--allow-external', action='store_true')
    parser.add_argument('--max-provider-requests', type=int, default=0)
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--recompute', type=Path)
    parser.add_argument('--java-results', type=Path, help='仅接收本次隔离JUnit导出；不能用fixture冒充MySQL')
    parser.add_argument('--prepare-java-input', type=Path, help='生成传给隔离JUnit的合成语料/Port计划')
    parser.add_argument('--safety-results', type=Path, help='汇总JUnit独立安全fixture读回证据')
    parser.add_argument('--export-review', type=Path, help='生成合成数据人工逐例复核HTML与草稿记录')
    args = parser.parse_args(argv)
    try:
        if args.safety_results:
            from .safety import summarize
            result = summarize(args.safety_results)
            print(json.dumps({'status': result['status'], 'planned': result['planned'], 'notRun': result['notRun']}))
            return 0 if result['status'] == 'PASS' else 1
        if args.recompute:
            recompute(args.recompute)
            print(json.dumps({'recomputed': str(args.recompute)}, ensure_ascii=False))
            return json.loads((args.recompute / 'manifest.json').read_text(encoding='utf-8'))['exitCode']
        if not args.dataset:
            from .legacy import execute
            return execute(args.output_dir)
        data = load(args.dataset, formal=args.formal)
        if args.export_review:
            from .review import export
            print(json.dumps({'review': str(export(args.export_review, data)), 'humanStatus': 'PENDING'}))
            return 0
        if args.prepare_java_input:
            from .java_adapter import prepare
            plan = prepare(args.prepare_java_input, data, split=args.split, profile=args.profile,
                           experiments=args.experiments.split(','), allow_external=args.allow_external,
                           budget=args.max_provider_requests)
            print(json.dumps({'javaInput': str(args.prepare_java_input), 'planned': len(plan['records'])}))
            return 0 if all(r['status'] == 'EXECUTED' for r in plan['records']) else 1
        java_rows = None
        java_metadata = None
        if args.java_results:
            from .java_adapter import read_export
            java_rows = read_export(args.java_results, data, profile=args.profile, split=args.split)
            java_metadata = json.loads(args.java_results.read_text(encoding='utf-8')).get('inputMeta')
        output = new_run(args.output_dir)
        manifest = run(data, output, split=args.split, profile=args.profile, adapter=args.adapter,
                       experiments=tuple(args.experiments.split(',')), allow_external=args.allow_external,
                       budget=args.max_provider_requests, java_rows=java_rows, java_metadata=java_metadata)
        print(json.dumps({'output': str(output), 'status': manifest['status'], 'exitCode': manifest['exitCode']}, ensure_ascii=False))
        return manifest['exitCode']
    except (DatasetError, ValueError, KeyError, FileExistsError, FileNotFoundError) as error:
        # 错误正文可能含地址/凭据，公共输出仅给安全类型，详细输入由本地检查。
        print(json.dumps({'status': 'INVALID_INPUT', 'errorType': type(error).__name__}))
        return 2
