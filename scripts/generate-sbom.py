"""为实际JAR、npm锁、Python运行锁和镜像锁生成CycloneDX 1.5组件清单。"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import quote
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def component(name, version, ref, *, kind='library', data=None, properties=None, scope='required'):
    row = {'type': kind, 'name': name, 'version': version, 'bom-ref': ref, 'scope': scope}
    if ref.startswith('pkg:'):
        row['purl'] = ref
    if data is not None:
        row['hashes'] = [{'alg': 'SHA-256', 'content': sha(data)}]
    if properties:
        row['properties'] = [{'name': k, 'value': str(v)} for k, v in properties.items()]
    return row


def generate(jar):
    rows = []
    with zipfile.ZipFile(jar) as archive:
        libraries = [n for n in archive.namelist() if n.startswith('BOOT-INF/lib/') and n.endswith('.jar')]
        if not libraries:
            raise ValueError('需要实际Spring Boot交付JAR，不能用空依赖清单代替')
        for name in libraries:
            data = archive.read(name)
            with zipfile.ZipFile(io.BytesIO(data)) as nested:
                props = [n for n in nested.namelist() if n.startswith('META-INF/maven/') and n.endswith('/pom.properties')]
                values = {}
                # shaded JAR可能包含多个坐标；仅采用与JAR文件名匹配的主坐标。
                for path in props:
                    candidate = dict(re.findall(r'^([^#!\s=]+)=(.*)$', nested.read(path).decode('utf-8').replace('\r', ''), re.M))
                    if Path(name).name == candidate.get('artifactId', '') + '-' + candidate.get('version', '') + '.jar':
                        values = candidate
                        break
            if values:
                artifact, version, group = values['artifactId'], values['version'], values['groupId']
                ref = 'pkg:maven/' + quote(group, safe='') + '/' + quote(artifact, safe='') + '@' + quote(version, safe='')
            else:
                match = re.fullmatch(r'(.+?)-(\d.*)\.jar', Path(name).name)
                if not match:
                    raise ValueError('无法识别交付依赖版本：' + Path(name).name)
                artifact, version = match.groups()
                ref = 'pkg:generic/' + quote(artifact, safe='') + '@' + quote(version, safe='')
            rows.append(component(artifact, version, ref, data=data, properties={'campus:source': name}))
    npm = json.loads((ROOT / 'frontend/package-lock.json').read_text('utf-8'))
    for location, package in npm['packages'].items():
        if not location or not package.get('version'):
            continue
        name = location.rsplit('node_modules/', 1)[-1]
        version = package['version']
        ref = 'pkg:npm/' + quote(name, safe='/') + '@' + quote(version, safe='')
        rows.append(component(name, version, ref, scope='excluded' if package.get('dev') else 'required', properties={
            'campus:source': 'frontend/package-lock.json', 'campus:npm-integrity': package.get('integrity', ''),
            'campus:development-only': str(bool(package.get('dev'))).lower()}))
    runtime = (ROOT / 'ai-service/requirements.lock').read_text('utf-8')
    packages = re.findall(r'^([A-Za-z0-9_.-]+)==([^\s\\]+)', runtime, re.M)
    if not packages:
        raise ValueError('Python运行锁为空')
    for name, version in packages:
        name = re.sub(r'[-_.]+', '-', name).lower()
        rows.append(component(name, version, 'pkg:pypi/' + name + '@' + quote(version, safe=''), properties={
            'campus:source': 'ai-service/requirements.lock', 'campus:lock-sha256': sha(runtime.encode())}))
    images = json.loads((ROOT / 'supply-chain/images.lock.json').read_text('utf-8'))
    for name, value in images['images'].items():
        ref = name + '@' + value['digest']
        rows.append(component(name.rsplit(':', 1)[0], value['digest'], ref, kind='container', properties={
            'campus:reference': ref, 'campus:registry': value['registryUrl']}))
    unique = {}
    for row in rows:
        unique.setdefault(row['bom-ref'], row)
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    return {'bomFormat': 'CycloneDX', 'specVersion': '1.5', 'serialNumber': 'urn:uuid:' + str(uuid.uuid4()), 'version': 1,
            'metadata': {'component': component('campus-shopping-delivery', sha(jar.read_bytes()), 'campus-shopping-delivery', kind='application', data=jar.read_bytes()),
                         'properties': [{'name': 'campus:inventory-checkout-commit', 'value': revision}, {'name': 'campus:coverage', 'value': 'actual BOOT-INF/lib JARs; npm lock including excluded dev tools; Python runtime lock; base image references. OS packages, transitive dependency edges and vulnerability findings are not enumerated.'}]},
            'components': sorted(unique.values(), key=lambda x: x['bom-ref'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', type=Path, default=ROOT / 'campus-shopping-app/target/campus-shopping-app.jar')
    parser.add_argument('--output', type=Path, default=ROOT / 'var/supply-chain/application.cdx.json')
    args = parser.parse_args()
    result = generate(args.jar)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    summary = {'components': len(result['components']), 'sbomSha256': sha(args.output.read_bytes()),
               'jarSha256': sha(args.jar.read_bytes()), 'status': 'GENERATED'}
    args.output.with_suffix('.summary.json').write_text(json.dumps(summary, indent=2) + '\n', 'utf-8')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
