#!/usr/bin/env python3
"""从 Java Controller/DTO 生成当前 API 参考文档与可检查的 OpenAPI JSON。

仅提取源码中能证明的类型、路由和注解。权限/业务前提统一记录在行为契约中，
不依据方法名猜测 DTO 必填属性。运行 --check 可在 CI 拒绝契约文档漂移。
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CTRL = ROOT / 'campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http'
DTO = ROOT / 'campus-shopping-api/src/main/java/cn/bugstack/ai/api/dto'
DEST = ROOT / 'docs/api'
RE = re.compile(r'@(Get|Post|Put|Patch|Delete)Mapping\("([^"\n]+)"\)')
WRITES = {'POST', 'PUT', 'PATCH', 'DELETE'}
ANON = {'GET /api/v1/auth/csrf', 'GET /api/v1/categories',
        'GET /api/v1/products', 'GET /api/v1/products/page',
        'GET /api/v1/products/{productId}', 'GET /api/v1/merchants/public',
        'GET /api/v1/merchants/public/page', 'GET /api/v1/merchants/public/{merchantId}',
        'POST /api/v1/auth/login', 'POST /api/v1/auth/register'}
REQUIRED_KEYS = {'POST /api/v1/merchant-applications', 'POST /api/v1/orders',
                 'POST /api/v1/merchants/{merchantId}/stocks/{skuId}/replenish'}


def split_top(src, sep=','):
    parts, start, depth_a, depth_p, in_string = [], 0, 0, 0, False
    for i, ch in enumerate(src):
        if ch == '"' and (i == 0 or src[i-1] != '\\'):
            in_string = not in_string
        if in_string:
            continue
        if ch == '<': depth_a += 1
        elif ch == '>': depth_a -= 1
        elif ch == '(': depth_p += 1
        elif ch == ')': depth_p -= 1
        elif ch == sep and depth_a == depth_p == 0:
            parts.append(src[start:i].strip()); start = i + 1
    parts.append(src[start:].strip())
    return [p for p in parts if p]


def java_type_schema(text):
    text = text.strip()
    if text.startswith('List<') or text.startswith('Set<'):
        return {'type': 'array', 'items': java_type_schema(text[text.index('<')+1:-1])}
    if text.startswith('PageResponseDTO<'):
        return {'type': 'object', 'required': ['items', 'page', 'size', 'total', 'hasNext'],
                'properties': {'items': {'type': 'array', 'items': java_type_schema(text[16:-1])},
                               'page': {'type': 'integer'}, 'size': {'type': 'integer'},
                               'total': {'type': 'integer', 'format': 'int64'}, 'hasNext': {'type': 'boolean'}}}
    if text.startswith('Map<'):
        return {'type': 'object', 'additionalProperties': True}
    if text in {'int', 'Integer'}: return {'type': 'integer', 'format': 'int32'}
    if text in {'long', 'Long'}: return {'type': 'integer', 'format': 'int64'}
    if text in {'boolean', 'Boolean'}: return {'type': 'boolean'}
    if text in {'double','Double','float','Float','BigDecimal'}: return {'type':'number'}
    if text in {'Instant', 'OffsetDateTime', 'LocalDateTime'}: return {'type':'string','format':'date-time'}
    if text in {'String','UUID'}: return {'type': 'string'}
    if text in {'Void', 'void'}: return {'type':'null'}
    if (DTO / (text + '.java')).exists():return {'$ref': '#/components/schemas/' + text}
    return {'type': 'object', 'description': 'Java 类型：' + text}


def dto_schemas():
    schemas = {}
    for file in sorted(DTO.glob('*.java')):
        s=file.read_text(encoding='utf-8')
        props={}
        for type_, name in re.findall(r'\bprivate\s+(?!static\b)([\w.<>?, ]+)\s+([A-Za-z_]\w*)\s*;',s):
            props[name] = java_type_schema(type_)
        if re.search(r'\brecord\s+'+re.escape(file.stem)+r'\s*[<(]',s):
            mt=re.search(r'\brecord\s+'+re.escape(file.stem)+r'[^\(]*\(([^)]*)\)',s,re.S)
            if mt:
                for param in split_top(mt.group(1)):
                    a=param.strip().split()
                    if len(a)>=2:props[a[-1]]=java_type_schema(' '.join(a[:-1]))
        if props:
            schemas[file.stem]={'type':'object','properties':props, 'description':'来自 '+file.relative_to(ROOT).as_posix()+'（字段类型来自源码；必填以领域规则为准）'}
    return schemas


def parse_method(src, index):
    m = re.search(r'\bpublic\s+(Response<[^\n{]+?>)\s+(\w+)\s*\(', src[index:])
    if not m or m.start()>450:
        raise ValueError('映射注解后找不到方法：'+src[index:index+120])
    response=m.group(1); name=m.group(2)
    at=index+m.end(); level=1; end=at
    while level and end<len(src):
        if src[end]=='(':level+=1
        if src[end]==')':level-=1
        end+=1
    if level:raise ValueError('Java 方法括号不闭合：'+name)
    inputs=[]
    for part in split_top(src[at:end-1]):
        tokens=part.split()
        if not tokens:continue
        var=tokens[-1]
        if '@PathVariable' in part:
            inputs.append({'in':'path','name':var,'type':tokens[-2],'required':True})
        elif '@RequestParam' in part:
            default=re.search(r'defaultValue\s*=\s*"([^"]*)"',part)
            optional='required=false' in part or bool(default)
            inputs.append({'in':'query','name':var,'type':tokens[-2],'required':not optional,
                           **({'default':default.group(1)} if default else {})})
        elif '@RequestHeader' in part:
            quoted=re.search(r'"([^"]+)"',part)
            header=quoted.group(1) if quoted else var
            inputs.append({'in':'header','name':header,'type':tokens[-2],
                           'required':'required=false' not in part})
        elif '@RequestBody' in part:
            inputs.append({'in':'body','name':var,'type':tokens[-2],'required':True})
    assert response.startswith('Response<') and response.endswith('>'),response
    return name,response[len('Response<'):-1],inputs


def routes():
    rows=[]
    for file in sorted(CTRL.glob('*Controller.java')):
        src=file.read_text(encoding='utf-8')
        base=re.search(r'@RequestMapping\("([^"]+)"\)',src)
        assert base,file
        for m in RE.finditer(src):
            name,response,params=parse_method(src,m.end())
            method=m.group(1).upper(); url=base.group(1).rstrip('/')+m.group(2)
            key=method+' '+url
            if key in [x['method']+' '+x['path'] for x in rows]:raise ValueError('重复路由 '+key)
            is_anon=key in ANON
            if key in REQUIRED_KEYS:
                for inp in params:
                    if inp['in']=='header' and inp['name']=='Idempotency-Key': inp['required']=True;inp['description']='领域规则必填（Controller 为便于统一业务错误码使用 required=false）'
            rows.append({'method':method,'path':url,'controller':file.name,'handler':name,
                         'responseType':response,'inputs':params,
                         'access':'anonymous' if is_anon else ('platform-admin' if url.startswith('/api/v1/admin/') else 'authenticated + domain ACL'),
                         'csrf':method in WRITES})
    return sorted(rows,key=lambda x:(x['path'],x['method']))


def openapi(rows,schemas):
    paths={}
    for row in rows:
        parameters=[];body=None
        for inp in row['inputs']:
            if inp['in']=='body':
                body={'required':True,'content':{'application/json':{'schema':java_type_schema(inp['type'])}}}
            else:
                param={'name':inp['name'],'in':inp['in'],'required':inp['required'],'schema':java_type_schema(inp['type'])}
                if 'default' in inp:
                    val=inp['default'];param['schema']['default']=int(val) if inp['type'] in ('int','Integer') else val
                if 'description' in inp:param['description']=inp['description']
                parameters.append(param)
        if row['csrf']:
            parameters.append({'name':'X-CSRF-TOKEN','in':'header','required':True,'schema':{'type':'string'},
                               'description':'由 GET /api/v1/auth/csrf 的 data.headerName 和 data.token 动态确定；本工程默认为该名称'})
        data_schema=java_type_schema(row['responseType'])
        operation={'tags':[row['controller'].removesuffix('Controller.java')],
                   'operationId':row['controller'].removesuffix('.java')+'_'+row['handler'],
                   'x-java-controller':row['controller'],'x-java-method':row['handler'],
                   'x-authorization':row['access'],
                   'parameters':parameters,
                   'responses':{
                       '200':{'description':'业务成功 code=0000；业务失败仍可能 HTTP 200 且 code 非 0000',
                              'content':{'application/json':{'schema':{'type':'object','required':['code','info'],
                                                                       'properties':{'code':{'type':'string'},'info':{'type':'string'},'data':data_schema}}}}},
                       '401':{'description':'未登录'},'403':{'description':'安全拒绝/CSRF'}},
                   'security':[] if row['access']=='anonymous' else [{'SessionCookie':[]}]}
        if body:operation['requestBody']=body
        paths.setdefault(row['path'],{})[row['method'].lower()]=operation
    return {'openapi':'3.1.0', 'info':{'title':'校园智能导购交易平台 HTTP API','version':'1.1.0',
                                   'description':'由 Java Controller/DTO 静态提取；业务校验/状态流转详见 docs/api/behavior-v1.1.md。未声称真实端到端验证。'},
            'servers':[{'url':'/'}], 'paths':paths,
            'components':{'securitySchemes':{'SessionCookie':{'type':'apiKey','in':'cookie','name':'JSESSIONID'}},
                          'schemas':schemas}}


def md(rows,schemas):
    out=['# HTTP API 当前权威契约（v1.1）','',
         '> 本文件由 `python scripts/generate-api-contract.py` 从当前 Controller/DTO **生成**；禁止手工追加旧版路由。',
         '> 接口字段来自源码，未带 Bean Validation 的 DTO 不代表任何字段都可为空。业务规则见 [行为契约](behavior-v1.1.md)，',
         f'> 机器可读的 {len(rows)} 条接口、参数、返回结构见 [OpenAPI JSON](openapi.json)，可在 CI 运行 `--check` 发现漂移。','',
         '## 统一约定','',
         '- URL 前缀：`/api/v1`；普通 JSON 响应结构为 `{ "code":"0000", "info":"成功", "data":... }`；HTTP 200 也可能有失败业务码。',
         '- 使用同源 `JSESSIONID` Session；写请求先从 `GET /api/v1/auth/csrf` 取得 `data.token` 与 `data.headerName`，随请求头发送。',
         '- 公共匿名 GET：商品、分类、公开商户；注册/登录仅匿名用户可 POST，且必须带 CSRF。其他 API 需登录并执行领域权限校验。',
         '- 幂等键：入驻申请、补货、结算的 `Idempotency-Key` **业务必填且最长 64 字符**；同键不同内容返回业务冲突。',
         '- 分页：`page` 从 1 开始，`size` 范围 1–100；`data.items/page/size/total/hasNext`。搜索参数 `q` 先在 SQL 过滤，再按相同条件 COUNT。',
         '- 错误码以 `ResponseCode.java` 为准；HTTP 状态与业务码相互独立，鉴权缺失一般 401、CSRF/拒绝访问一般 403。',
         '- Spring MVC 安全过滤器与真实 MySQL 仍需实际集成测试；此文档是静态契约，不是运行证明。','',
         f'## 全量路由（共 {len(rows)} 条）','',
         '| 方法 | 路径 | 请求参数 / 主体 | data 类型 | 访问控制 | 实现类 |','|---|---|---|---|---|---|']
    for r in rows:
        def spec(i):
            suffix='' if i['required'] else '?'
            return f"{i['name']}{suffix}:{i['type']}" if i['in']!='body' else f"body:{i['type']}"
        args='、'.join(spec(i) for i in r['inputs']) or '—'
        out.append(f"| `{r['method']}` | `{r['path']}` | {args} | `{r['responseType']}` | {r['access']} | `{r['controller']}` |")
    out += ['', '## DTO 字段索引','',
            '以下字段由 API DTO 自动提取，约束、权限和枚举含义以 `behavior-v1.1.md` 与领域校验为准。','']
    for name, schema in sorted(schemas.items()):
        out.append(f"### `{name}`")
        out.append('')
        out.append('、'.join(f'`{k}`' for k in schema['properties']))
        out.append('')
    out += ['## 执行与持续一致性验证','',
            '```bash', 'python scripts/generate-api-contract.py --check', 'python scripts/verify-api-contract.py', '```', '',
            '前端当前请求层是 `frontend/src/services/api.js`，旧版 `static/assets/app.js` 仅供 legacy 参考。',
            '完整真实浏览器与后端联调命令见 `frontend/tests/live_ui.py` 和 `scripts/smoke-full.py`。','']
    return '\n'.join(out)


def output_files():
    all_routes=routes();schema=dto_schemas()
    assert len(all_routes)>=80,f'路由数量异常：{len(all_routes)}'
    return {'docs/api/route-manifest.json':json.dumps({'version':'1.1.0','routes':all_routes},ensure_ascii=False,indent=2)+'\n',
            'docs/api/openapi.json':json.dumps(openapi(all_routes,schema),ensure_ascii=False,indent=2)+'\n',
            'docs/api/http-api.md':md(all_routes,schema)}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs=output_files()
    for name,content in outputs.items():
        file=ROOT/name
        if args.check:
            if not file.exists() or file.read_text(encoding='utf-8')!=content:
                print('契约漂移：'+name,file=sys.stderr);raise SystemExit(1)
        else:
            file.parent.mkdir(parents=True,exist_ok=True);file.write_text(content,encoding='utf-8')
    print('契约 '+('校验' if args.check else '生成')+'通过：'+str(len(routes()))+' 条路由')


if __name__=='__main__':main()
