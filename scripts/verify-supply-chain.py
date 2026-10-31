"""离线核对交付镜像及Actions固定引用；不声称完成签名或漏洞验证。"""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def main():
    lock = json.loads((ROOT / 'supply-chain/images.lock.json').read_text('utf-8'))
    approved = set()
    for tag, item in lock['images'].items():
        assert re.fullmatch(r'sha256:[0-9a-f]{64}', item['digest']), '非法镜像摘要'
        approved.add(tag + '@' + item['digest'])
    refs = []
    for name in ['Dockerfile', 'ai-service/Dockerfile']:
        refs.extend(re.findall(r'^FROM\s+(\S+)', (ROOT / name).read_text('utf-8'), re.M))
    for path in ROOT.glob('compose*.yml'):
        refs.extend(re.findall(r'^\s*image:\s*[\'"]?([^\s\'"]+)', path.read_text('utf-8'), re.M))
    workflow = (ROOT / '.github/workflows/full-release.yml').read_text('utf-8')
    refs.extend(re.findall(r'\b(?:mysql|redis):[0-9][^\s\'"]+', workflow))
    assert refs and all(ref in approved for ref in refs), '镜像须与images.lock.json同步固定'
    for path in (ROOT / '.github/workflows').glob('*.yml'):
        for action in re.findall(r'uses:\s*([^\s#]+)', path.read_text('utf-8')):
            assert action.startswith('./') or re.fullmatch(r'[^@]+@[0-9a-f]{40}', action), '第三方Action须固定SHA'
    print(json.dumps({'status': 'PASS', 'imageReferences': len(refs), 'lockedImages': len(approved)}))


if __name__ == '__main__':
    main()
