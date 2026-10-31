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
from api_contract_rules import merge_request_rules, request_schema
from api_response_rules import merge_response_rules, success_data, query_enum

ROOT = Path(__file__).resolve().parents[1]
CTRL = ROOT / 'campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http'
DTO = ROOT / 'campus-shopping-api/src/main/java/cn/bugstack/ai/api/dto'
DEST = ROOT / 'docs/api'
RE = re.compile(r'@(Get|Post|Put|Patch|Delete)Mapping\(\s*"([^"\n]+)"\s*\)')
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
    text = re.sub(r'\s+', '', text).replace('java.util.', '')
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
        for type_, name in re.findall(r'\bprivate\s+(?!static\b)([\w.<>?,\s]+?)\s+([A-Za-z_]\w*)\s*;',s):
            props[name] = java_type_schema(type_)
        if re.search(r'\brecord\s+'+re.escape(file.stem)+r'\s*[<(]',s):
            mt=re.search(r'\brecord\s+'+re.escape(file.stem)+r'[^\(]*\(([^)]*)\)',s,re.S)
            if mt:
                for param in split_top(mt.group(1)):
                    a=param.strip().split()
                    if len(a)>=2:props[a[-1]]=java_type_schema(' '.join(a[:-1]))
        if props:
            schemas[file.stem]={'type':'object','properties':props, 'description':'来自 '+file.relative_to(ROOT).as_posix()+'（字段类型来自源码；必填以领域规则为准）'}
    merge_request_rules(schemas, ROOT)
    merge_response_rules(schemas, ROOT)
    return schemas


def error_codes():
    source = (ROOT/'campus-shopping-types/src/main/java/cn/bugstack/ai/types/enums/ResponseCode.java').read_text('utf-8')
    values = re.findall(r'\b([A-Z][A-Z_0-9]+)\s*\(\s*"([A-Z0-9]+)",\s*"([^"]+)"\s*\)', source)
    assert values and len({code for _, code, _ in values}) == len(values), '错误码重复或读取失败'
    return values


def error_codes_md():
    lines = ['# R1 业务与协议错误码', '',
             '> 由 `python scripts/generate-api-contract.py` 从 `ResponseCode.java` 生成，CI 检查漂移。', '',
             '| 枚举名 | 业务码 | 安全提示 |', '|---|---|---|']
    lines += [f'| `{name}` | `{code}` | {info} |' for name, code, info in error_codes()]
    lines += ['', 'Domain/Case 抛出 AppException，异常穿过事务代理后由 Controller 内部捕获；禁止在事务方法内吞异常返回成功。', '',
              '数据库唯一约束冲突在明确的仓储写操作处翻译：用户名 A0001、同商户角色重名 M0006；其他 SQL 故障仍为系统失败。', '',
              'ApiProtocolExceptionResolver 只适配 /api 下的 MVC 协议错误，不处理 AppException 或普通运行异常；没有新增全局业务异常处理器。',
              'Security 独立处理 401/403，账号状态服务不可用返回 503/0001；入口限流为 429/A0007。', '',
              '协议映射：400/0002、404/G0001、405/G0005、406/G0007、413/G0004、415/G0006；业务失败通常仍为 HTTP 200。',
              '请求体上限 3,000,000 字节（包括分块上传）；文件解码后上限 2,000,000 字节。错误响应不回显正文、SQL 或异常堆栈。', '']
    return '\n'.join(lines)


def parse_method(src, index):
    m = re.search(r'\bpublic\s+(Response<[^{};]+?>)\s+(\w+)\s*\(', src[index:])
    if not m or m.start()>450:
        raise ValueError('映射注解后找不到方法：'+src[index:index+120])
    response=re.sub(r'\s+', '', m.group(1)); name=m.group(2)
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
            optional=bool(re.search(r'required\s*=\s*false',part)) or bool(default)
            inputs.append({'in':'query','name':var,'type':tokens[-2],'required':not optional,
                           **({'default':default.group(1)} if default else {})})
        elif '@RequestHeader' in part:
            quoted=re.search(r'"([^"]+)"',part)
            header=quoted.group(1) if quoted else var
            inputs.append({'in':'header','name':header,'type':tokens[-2],
                           'required':not bool(re.search(r'required\s*=\s*false',part))})
        elif '@RequestBody' in part:
            inputs.append({'in':'body','name':var,'type':tokens[-2],'required':True})
    assert response.startswith('Response<') and response.endswith('>'),response
    return name,response[len('Response<'):-1],inputs


def routes():
    rows=[]
    for file in sorted(CTRL.glob('*Controller.java')):
        src=file.read_text(encoding='utf-8')
        base=re.search(r'@RequestMapping\(\s*"([^"]+)"\s*\)',src)
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
    schemas = dict(schemas)
    codes = error_codes()
    schemas['ResponseCode'] = {'type': 'string', 'enum': [v[1] for v in codes],
                              'x-enumNames': [v[0] for v in codes], 'x-enumDescriptions': [v[2] for v in codes]}
    schemas['FailureCode'] = {'type': 'string', 'enum': [v[1] for v in codes if v[1] != '0000']}
    schemas['ErrorResponse'] = {'type': 'object', 'required': ['code', 'info', 'data'],
        'properties': {'code': {'$ref': '#/components/schemas/FailureCode'},
                       'info': {'type': 'string'}, 'data': {'type': 'null'}}}
    paths={}
    for row in rows:
        parameters=[];body=None
        for inp in row['inputs']:
            if inp['in']=='body':
                body={'required':True,'content':{'application/json':{'schema':request_schema(row, inp['type'], java_type_schema(inp['type']))}}}
            else:
                param={'name':inp['name'],'in':inp['in'],'required':inp['required'],'schema':java_type_schema(inp['type'])}
                if 'default' in inp:
                    val=inp['default'];param['schema']['default']=int(val) if inp['type'] in ('int','Integer') else val
                if 'description' in inp:param['description']=inp['description']
                if inp['name'] == 'page': param['schema'].update(minimum=1, maximum=10000)
                if inp['name'] == 'size': param['schema'].update(minimum=1, maximum=100)
                if inp['name'] == 'q': param['schema']['maxLength'] = 100
                allowed_states = query_enum(ROOT, row, inp['name'])
                if allowed_states is not None: param['schema']['enum'] = allowed_states
                if inp['name'] == 'sort': param['schema']['enum'] = ['NEWEST', 'PRICE_ASC', 'STOCK_DESC']
                if inp['name'] == 'Idempotency-Key': param['schema'].update(minLength=1, maxLength=64)
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
                              'content':{'application/json':{'schema':{'oneOf':[
                                  {'type':'object','required':['code','info','data'], 'properties':{
                                      'code':{'const':'0000'},'info':{'type':'string'},
                                      'data':success_data(row,data_schema)}},
                                  {'$ref':'#/components/schemas/ErrorResponse'}]}}}},
                       '401':{'description':'未登录'},'403':{'description':'安全拒绝/CSRF'}},
                   'security':[] if row['access']=='anonymous' else [{'SessionCookie':[]}]}
        protocol_responses = {
            '400': '0002：JSON/参数绑定错误；小数不可绑定到整数，禁止尾随 JSON。',
            '401': 'A0004：未登录或会话失效。', '403': 'A0005/A0006/A0003：CSRF/授权/账号状态拒绝。',
            '404': 'G0001：无此 API 路由；私有路径先鉴权。', '405': 'G0005：方法不支持，附 Allow。',
            '406': 'G0007：响应媒体类型不支持。', '413': 'G0004：请求体超过 3,000,000 字节。',
            '415': 'G0006：请求媒体类型不支持。', '503': '0001：账号状态服务暂不可用，失败关闭。',
        }
        for status, description in protocol_responses.items():
            operation['responses'][status] = {'description': description,
                'content': {'application/json': {'schema': {'$ref': '#/components/schemas/ErrorResponse'}}}}
        operation['responses']['405']['headers'] = {'Allow': {'schema': {'type': 'string'}, 'description': '支持的 HTTP 方法。'}}
        if row['path'] in {'/api/v1/auth/register', '/api/v1/auth/login'} and row['method'] == 'POST':
            operation['responses']['429'] = {'description': 'A0007：单实例入口限流。',
                'headers': {'Retry-After': {'schema': {'type': 'integer', 'minimum': 1}, 'description': '距窗口重置的秒数。'}},
                'content': {'application/json': {'schema': {'$ref': '#/components/schemas/ErrorResponse'}}}}
        if body: operation['x-maxRequestBodyBytes'] = 3_000_000
        if body:operation['requestBody']=body
        paths.setdefault(row['path'],{})[row['method'].lower()]=operation
    return {'openapi':'3.1.0', 'info':{'title':'校园智能导购交易平台 HTTP API','version':'1.1.0',
                                   'description':'路由/类型从 Java 提取；输入约束由 scripts/api_contract_rules.py 显式核对合并。约束针对规范化后的业务输入，Java 长度按 UTF-16 单元；密码另限 UTF-8 72 字节。业务校验/状态流转详见 docs/api/behavior-v1.1.md。'},
            'servers':[{'url':'/'}], 'paths':paths,
            'components':{'securitySchemes':{'SessionCookie':{'type':'apiKey','in':'cookie','name':'JSESSIONID'}},
                          'schemas':schemas}}


def md(rows,schemas):
    out=['# HTTP API 当前权威契约（v1.1）','',
         '> 本文件由 `python scripts/generate-api-contract.py` 从当前 Controller/DTO **生成**；禁止手工追加旧版路由。',
         '> 路由/字段来自源码；必填、范围、枚举由 `scripts/api_contract_rules.py` 显式核对合并。业务规则见 [行为契约](behavior-v1.1.md)，',
         f'> 机器可读的 {len(rows)} 条接口、参数、返回结构见 [OpenAPI JSON](openapi.json)，可在 CI 运行 `--check` 发现漂移。','',
         '## 统一约定','',
         '- URL 前缀：`/api/v1`；普通 JSON 响应结构为 `{ "code":"0000", "info":"成功", "data":... }`；HTTP 200 也可能有失败业务码。',
         '- 使用同源 `JSESSIONID` Session；写请求先从 `GET /api/v1/auth/csrf` 取得 `data.token` 与 `data.headerName`，随请求头发送。',
         '- 公共匿名 GET：商品、分类、公开商户；注册/登录仅匿名用户可 POST，且必须带 CSRF。其他 API 需登录并执行领域权限校验。',
         '- 幂等键：入驻申请、补货、结算的 `Idempotency-Key` **业务必填且最长 64 字符**；同键不同内容返回业务冲突。',
         '- 分页：`page` 从 1 开始，`size` 范围 1–100；`/page` 返回 `data.items/page/size/total/hasNext`。会话/邀请保留分页 List 响应，末页规则见行为契约。搜索参数 `q` 先在 SQL 过滤，再按相同条件 COUNT。',
         '- 错误码以 `ResponseCode.java` 为准；HTTP 状态与业务码相互独立，鉴权缺失一般 401、CSRF/拒绝访问一般 403。',
         '- 协议错误返回同一 JSON 信封：400/0002、404/G0001、405/G0005、406/G0007、413/G0004、415/G0006。限流 429/A0007 附正确 Retry-After。',
         '- 金额、数量、版本禁止小数截断；每个正文只接受一个 JSON 值。未知字段继续忽略，附加的身份/角色字段没有授权效力。',
         '- 字段约束描述规范化后的输入，Java 字符长度按 UTF-16 单元；商品创建必填 skus，编辑必填 expectedVersion，退款审核必填 reason。',
         '- 本文件是契约，运行证据另见 docs/testing/CONTRACT-DATABASE-API-AUDIT-09.md。','',
         f'## 全量路由（共 {len(rows)} 条）','',
         '| 方法 | 路径 | 请求参数 / 主体 | data 类型 | 访问控制 | 实现类 |','|---|---|---|---|---|---|']
    for r in rows:
        def spec(i):
            suffix='' if i['required'] else '?'
            return f"{i['name']}{suffix}:{i['type']}" if i['in']!='body' else f"body:{i['type']}"
        args='、'.join(spec(i) for i in r['inputs']) or '—'
        out.append(f"| `{r['method']}` | `{r['path']}` | {args} | `{r['responseType']}` | {r['access']} | `{r['controller']}` |")
    out += ['', '## DTO 字段索引','',
            '以下字段由 API DTO 自动提取；机器约束在 OpenAPI 中，权限与状态语义见 `behavior-v1.1.md`。','']
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
            'docs/api/http-api.md':md(all_routes,schema),
            'docs/api/error-codes.md':error_codes_md()}


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
