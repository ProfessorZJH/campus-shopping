#!/usr/bin/env python3
"""用 JSON Schema 2020-12 验证生成契约及有效/无效业务样例；不替代运行时领域校验。"""
import argparse
import json
from pathlib import Path

from jsonschema import Draft202012Validator, RefResolver

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT/'docs/api/openapi.json').read_text('utf-8'))


def at(*parts):
    pointer = '/'+'/'.join(str(p).replace('~', '~0').replace('/', '~1') for p in parts)
    return Draft202012Validator({'$ref': '#'+pointer}, resolver=RefResolver.from_schema(SPEC))


def body(path, method='post'):
    return at('paths', path, method, 'requestBody', 'content', 'application/json', 'schema')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'docs/testing/evidence/ddd-refactor-20261029/api-schemas.json')
    args = parser.parse_args()
    checks = []
    for name, schema in SPEC['components']['schemas'].items():
        Draft202012Validator.check_schema(schema)
    checks.append('every generated component is a valid JSON Schema 2020-12')

    def check(validator, value, expected, label):
        assert validator.is_valid(value) == expected, label
        checks.append(label)

    register = at('components', 'schemas', 'RegisterRequestDTO')
    account = {'username': 'student001', 'password': 'test-only-password', 'displayName': '测'*50}
    check(register, account, True, '50-unit display name is accepted')
    check(register, {**account, 'displayName': '测'*51}, False, '51-unit display name is rejected')
    check(register, {**account, 'username': 's'*33}, False, '33-character username is rejected')
    check(register, {**account, 'role': 'PLATFORM_ADMIN'}, True, 'unknown fields remain compatible and confer no authority')
    category = at('components', 'schemas', 'CategoryRequestDTO')
    check(category, {'code': 'c'*32, 'name': '类'*50, 'active': True}, True, 'category upper boundaries are accepted')
    check(category, {'code': 'c'*33, 'name': '类别', 'active': True}, False, 'oversize category code is rejected')
    product = {'title': '考试笔', 'categoryCode': 'stationery'}
    create = body('/api/v1/merchants/{merchantId}/products')
    edit = body('/api/v1/merchants/{merchantId}/products/{productId}', 'put')
    check(create, product, False, 'create requires at least one SKU')
    check(create, {**product, 'skus': [{'specKey': '黑色', 'priceCent': 500}]}, True, 'product create with integer price is accepted')
    check(create, {**product, 'skus': [{'specKey': '黑色', 'priceCent': 500.5}]}, False, 'fractional price is rejected')
    check(edit, product, False, 'edit requires expectedVersion')
    check(edit, {**product, 'expectedVersion': 0, 'imageUrl': None}, True, 'edit permits explicit missing image')
    admission = body('/api/v1/admin/merchant-applications/{applicationId}/review')
    refund = body('/api/v1/admin/orders/{orderId}/refund-decision')
    check(admission, {'approved': True}, True, 'admission approval has no mandatory reason')
    check(admission, {'approved': False}, False, 'admission rejection requires reason')
    check(refund, {'approved': True}, False, 'refund approval requires reason')
    check(refund, {'approved': False, 'reason': '核对后驳回'}, True, 'refund rejection with reason is accepted')
    knowledge = body('/api/v1/knowledge/bases')
    check(knowledge, {'name': '公开库', 'visibility': 'PUBLIC'}, True, 'platform public knowledge is accepted')
    check(knowledge, {'name': '错误范围', 'visibility': 'MERCHANT_INTERNAL'}, False, 'platform base cannot use merchant visibility')
    check(knowledge, {'merchantId': 'm', 'name': '错误范围', 'visibility': 'PLATFORM_INTERNAL'}, False,
          'merchant base cannot use platform visibility')
    order = at('paths', '/api/v1/orders/{orderId}', 'get', 'responses', '200', 'content', 'application/json', 'schema')
    for payload in ({'code':'0000','info':'成功'}, {'code':'0000','info':'成功','data':None},
                    {'code':'0000','info':'成功','data':{}}, {'code':'0000','info':'成功','data':{'orderId':'o','items':None}}):
        check(order, payload, False, 'incomplete success response is rejected: '+str(payload))
    valid_order = {'orderId':'o','buyerId':'b','merchantId':'m','merchantName':'店铺','storeId':'s',
                   'status':'PAID','totalCent':100,'deadline':'2026-10-29T00:00:00Z','createdAt':'2026-10-29T00:00:00Z',
                   'items':[{'skuId':'sku','title':'笔','specKey':'黑色','imageUrl':'','unitPriceCent':100,'quantity':1}],
                   'pickup':None,'afterSale':None}
    check(order, {'code':'0000','info':'成功','data':valid_order}, True, 'complete order with optional pickup/refund is accepted')
    for field in SPEC['components']['schemas']['OrderResponseDTO']['required']:
        damaged = dict(valid_order); del damaged[field]
        check(order, {'code':'0000','info':'成功','data':damaged}, False, 'missing order field is rejected: '+field)
    check(order, {'code':'0000','info':'成功','data':{**valid_order,'status':'PAYED'}}, False, 'unregistered order status is rejected')
    check(order, {'code':'0000','info':'成功','data':{**valid_order,'items':[]}}, False, 'empty order items are rejected')
    check(order, {'code': 'G0001', 'info': '资源不存在或不可访问', 'data': None}, True,
          'HTTP 200 business failure accepts null data')
    check(order, {'code': 'G0001', 'info': '失败', 'data': {'orderId': 'forged'}}, False,
          'failure cannot carry a success-shaped business object')
    check(order, {'code': 'unknown', 'info': '失败', 'data': None}, False, 'unknown response code is rejected')
    status_examples = {
        'AdmissionResponseDTO': {'applicationId': 'a', 'merchantName': '店铺', 'category': '文具',
                                 'contactName': '经营者', 'contactPhone': '13800000000', 'storeName': '校园店',
                                 'location': '校内', 'rejectionReason': None, 'merchantId': None},
        'CurrentUserResponseDTO': {'userId': 'u', 'username': 'student001', 'displayName': '同学'},
        'SubmitMerchantApplicationResponseDTO': {'applicationId': 'a'},
    }
    for name, example in status_examples.items():
        validator = at('components', 'schemas', name)
        for state in SPEC['components']['schemas'][name]['properties']['status']['enum']:
            check(validator, {**example, 'status': state}, True, name+' accepts declared status '+state)
        check(validator, {**example, 'status': 'UNKNOWN'}, False, name+' rejects an unknown status')
        check(validator, {**example, 'status': None}, False, name+' rejects a null status')
        check(validator, example, False, name+' requires status')
    report = {'status': 'PASS', 'kind': 'JSON_SCHEMA_EXAMPLES_NOT_RUNTIME', 'checks': checks}
    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('PASS', len(checks), 'schema checks')


if __name__ == '__main__':
    main()
