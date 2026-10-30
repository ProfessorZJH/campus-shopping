#!/usr/bin/env python3
"""检查 HTTP 契约、公开权限、分页 SQL、浏览器验收入口和文档是否同步。

纯静态检查，不冒充 Spring Security/MySQL 运行；完整联调须执行 CI 的真实验收阶段。
"""
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/generate-api-contract.py'
mod_spec = importlib.util.spec_from_file_location('campus_contract_generator', SCRIPT)
module = importlib.util.module_from_spec(mod_spec)
mod_spec.loader.exec_module(module)


def check(ok, message):
    if not ok:
        raise AssertionError(message)
    print('[PASS]', message)


def source(relative):
    return (ROOT / relative).read_text(encoding='utf-8')


def schema_refs(obj):
    if isinstance(obj, dict):
        if '$ref' in obj:
            yield obj['$ref']
        for value in obj.values():
            yield from schema_refs(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from schema_refs(value)


def verify():
    proc = subprocess.run([sys.executable, '-X', 'utf8', str(SCRIPT), '--check'], cwd=ROOT,
                          capture_output=True, text=True, encoding='utf-8')
    check(proc.returncode == 0, '当前 Controller/DTO 与生成文档字节一致（无文档漂移）' + ('：' + proc.stderr.strip() if proc.returncode else ''))
    routes = module.routes()
    manifest = json.loads(source('docs/api/route-manifest.json'))
    spec = json.loads(source('docs/api/openapi.json'))
    keys = {r['method'] + ' ' + r['path'] for r in routes}
    check(len(keys) == len(routes) >= 80 and routes == manifest['routes'], str(len(keys)) + ' 条 Controller 路由与清单逐条一致且无重复')
    openapi_keys = {method.upper() + ' ' + path for path, verbs in spec['paths'].items() for method in verbs}
    check(keys == openapi_keys, 'OpenAPI 路由/方法与 Controller 一致')
    schemas = spec['components']['schemas']
    check(all(ref.startswith('#/components/schemas/') and ref.split('/')[-1] in schemas
              for ref in schema_refs(spec)), 'OpenAPI 所有 DTO schema 引用均可解析')
    request_names = {p.stem for p in (ROOT/'campus-shopping-api/src/main/java/cn/bugstack/ai/api/dto').glob('*RequestDTO.java')}
    check(all(schemas[name].get('required') and schemas[name].get('x-constraint-source')
              for name in request_names), '所有请求 DTO 均有显式必填规则及领域来源')
    for name, field, maximum in [('RegisterRequestDTO','username',32), ('RegisterRequestDTO','displayName',50),
                                 ('SubmitMerchantApplicationRequestDTO','contactName',50),
                                 ('CategoryRequestDTO','code',32), ('CategoryRequestDTO','name',50)]:
        check(schemas[name]['properties'][field]['maxLength'] == maximum,
              f'{name}.{field} 规范化后长度上限 {maximum}')
    code_values = module.error_codes()
    check(schemas['ResponseCode']['enum'] == [code for _,code,_ in code_values],
          '机器错误码与 Java 枚举逐项一致且无重复')
    for path, verbs in spec['paths'].items():
        for method, operation in verbs.items():
            check_statuses = {'400','401','403','404','405','406','413','415','503'}
            assert check_statuses <= set(operation['responses']), (path, method)
    check(True, '协议错误、鉴权和认证依赖故障均有 JSON 错误 schema')
    product_path = spec['paths']['/api/v1/merchants/{merchantId}/products']
    create = product_path['post']['requestBody']['content']['application/json']['schema']
    edit = spec['paths']['/api/v1/merchants/{merchantId}/products/{productId}']['put']['requestBody']['content']['application/json']['schema']
    check(create['allOf'][1]['required'] == ['skus'] and edit['allOf'][1]['required'] == ['expectedVersion'],
          '商品共享 DTO 仍准确区分创建规格和编辑版本必填')
    for path in ('/api/v1/merchants/{merchantId}/orders/{orderId}/refund-decision',
                 '/api/v1/admin/orders/{orderId}/refund-decision'):
        shape = spec['paths'][path]['post']['requestBody']['content']['application/json']['schema']
        assert shape['allOf'][1]['required'] == ['reason'], path
    check(True, '退款同意/驳回均声明非空审核原因')
    app_schema = source('campus-shopping-app/src/main/resources/schema.sql')
    docker_schema = source('docs/dev-ops/mysql/sql/00_r1_schema.sql')
    check(docker_schema.endswith(app_schema),
          '应用与 Docker 的完整 DDL 字节一致（数据库创建前缀除外）')
    check('behavior-v1.1.md' in source('docs/api/http-api.md') and (ROOT/'docs/api/behavior-v1.1.md').exists(),
          '业务权限、CSRF、错误码和幂等语义有单独的现行行为契约')

    sec = source('campus-shopping-app/src/main/java/cn/bugstack/ai/config/SessionSecurityConfig.java')
    sec = re.sub(r'\s+', '', sec)
    public_get = re.findall(r'\.requestMatchers\(HttpMethod.GET,(.*?)\)\.permitAll\(\)', sec, re.S)
    check(bool(public_get), '可读取 Spring Security 公开 GET 匹配规则')
    public_paths = set(re.findall(r'"(/[^"]+)"', " ".join(public_get)))
    for path in ('/api/v1/auth/csrf', '/api/v1/categories', '/api/v1/merchants/public',
                 '/api/v1/merchants/public/page', '/api/v1/merchants/public/{merchantId}',
                 '/api/v1/products'):
        check(path in public_paths, '公开 GET 在 Security 白名单：' + path)
    check('/api/v1/products/*' in public_paths, '商品详情与 /products/page 被单段通配符覆盖')
    private_keys = {'GET /api/v1/admin/orders/page', 'GET /api/v1/merchants/{merchantId}/stocks/page'}
    check(not private_keys.intersection(module.ANON) and '.requestMatchers("/api/v1/**").authenticated()' in sec,
          '私有 Admin/商户路径不会误放行')
    check('"/api/v1/auth/register","/api/v1/auth/login").anonymous()' in sec,
          '注册与登录仅匿名用户开放，且仍经过 CSRF 过滤器')

    for key in ('GET /api/v1/merchants/public/page', 'GET /api/v1/merchants/public/{merchantId}'):
        check(key in module.ANON and next(x for x in routes if x['method'] + ' ' + x['path'] == key)['access'] == 'anonymous',
              '商户公开接口 ACL 与路由清单一致：' + key)
    for method, path in [('GET', '/api/v1/admin/merchants/page'),
                         ('GET', '/api/v1/admin/merchant-applications/page'),
                         ('GET', '/api/v1/admin/orders/page'),
                         ('GET', '/api/v1/merchants/{merchantId}/orders/page'),
                         ('GET', '/api/v1/merchants/{merchantId}/stocks/page')]:
        match = next(x for x in routes if x['method'] == method and x['path'] == path)
        check(any(i['name'] == 'q' and i['in'] == 'query' for i in match['inputs']),
              'SQL 服务端搜索路由声明 q：' + path)

    mappers = [
        ('campus-shopping-app/src/main/resources/mybatis/mapper/imerchantdao_mapper.xml', 'list', 'count'),
        ('campus-shopping-app/src/main/resources/mybatis/mapper/imerchantapplicationdao_mapper.xml', 'list', 'count'),
        ('campus-shopping-app/src/main/resources/mybatis/mapper/itradingdao_mapper.xml', 'orders', 'countOrders'),
        ('campus-shopping-app/src/main/resources/mybatis/mapper/iinventoryquerydao_mapper.xml', 'list', 'countStocks'),
    ]
    for path, list_name, count_name in mappers:
        contents = source(path)
        def sql(id_):
            match = re.search(r'<select\s+id="' + re.escape(id_) + r'"[^>]*>(.*?)</select>', contents, re.S)
            return match.group(1) if match else ''
        list_sql, count_sql = sql(list_name), sql(count_name)
        check(bool(list_sql and count_sql), path + '：分页 SELECT 与 COUNT 均存在')
        check('q != null and q !=' in list_sql and 'q != null and q !=' in count_sql,
              path + '：列表和 COUNT 均在分页前按 q 过滤')
        check('LIMIT #{limit} OFFSET #{offset}' in list_sql and 'COUNT(*)' in count_sql,
              path + '：查询分页与总数单独计算')
        pattern = r'<if\s+test="q != null and q != \'\'"\s*>(.*?)</if>'
        match_list, match_count = re.search(pattern, list_sql, re.S), re.search(pattern, count_sql, re.S)
        norm = lambda v: re.sub(r'\s+', '', v)
        check(bool(match_list and match_count) and norm(match_list.group(1)) == norm(match_count.group(1)),
              path + '：查询 q 谓词与 COUNT 谓词完全一致')

    cart = source('campus-shopping-api/src/main/java/cn/bugstack/ai/api/dto/CartResponseDTO.java')
    cart_schema = spec['components']['schemas']['CartResponseDTO']
    check('merchantName' in cart and 'merchantName' in cart_schema['required']
          and cart_schema['properties']['merchantName'].get('type') == 'string',
          '购物车 API 契约要求商户名必填且非 null，不依赖当前页商户缓存')
    live = source('frontend/tests/live_ui.py')
    check('form.login-dialog' in live and '.header-login' in live and 'page.route(' not in live
          and 'apiMockUsed' in live, '真实浏览器测试使用新版 Vue 选择器且不 mock API')
    workflow = source('.github/workflows/full-release.yml')
    check('python scripts/verify-api-contract.py' in workflow and 'python frontend/tests/live_ui.py' in workflow,
          'CI 在真实 Java/MySQL 阶段之前运行契约门禁，之后运行真实浏览器')
    check('specs/SDD-API-CONTRACT-03.md' in source('docs/README.md'),
          '文档索引已指向 SDD-03 当前契约')
    print('完成静态契约检查；注意：不是 Maven / Spring Security / MySQL 真实通过。')


if __name__ == '__main__':
    try:
        verify()
    except Exception as exc:
        print('[FAIL]', exc, file=sys.stderr)
        sys.exit(1)
