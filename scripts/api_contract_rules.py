"""人工核对的领域输入约束，供生成器合并到源码提取的 DTO 类型中。

这里不执行校验；运行规则仍在 Domain/Case。DTO 改字段或新增请求必须同步本表。
长度描述规范化后的业务输入；Java 长度以 UTF-16 单元计，密码额外限制 UTF-8 字节。
"""
from copy import deepcopy


def text(maximum, **extra):
    return {'minLength': 1, 'maxLength': maximum, 'pattern': r'\S', **extra}


def optional_text(maximum, **extra):
    return {'type': ['string', 'null'], 'maxLength': maximum, **extra}


def rule(required, properties, source):
    return {'required': required.split(), 'properties': properties, 'x-constraint-source': source}


USERNAME = text(32, minLength=4, pattern='^[a-z][a-z0-9_]{3,31}$',
                description='服务器先 trim 并转小写，再检查格式。')
PASSWORD = {'minLength': 8, 'maxLength': 64, 'writeOnly': True,
            'description': '不可 trim；UTF-8 编码最长 72 字节。', 'x-maxUtf8Bytes': 72}
PRICE = {'minimum': 1, 'maximum': 100_000_000, 'description': '金额单位为整数分。'}
VERSION = {'minimum': 0}
REASON = text(500)
IDENTITY = 'domain/identity/service/impl/UserAccountServiceImpl.java'
CATALOG = 'domain/catalog/model/aggregate/ProductAggregate.java'
MERCHANT = 'domain/merchant/model/aggregate/MerchantApplicationAggregate.java'
ACCESS = 'domain/identity/service/impl/AccessServiceImpl.java'
TRADING = 'cases/trading/impl/CheckoutCaseImpl.java'
KNOWLEDGE = 'cases/shoppingai/impl/KnowledgeCaseImpl.java'

REQUEST_RULES = {
    'RegisterRequestDTO': rule('username password displayName', {
        'username': USERNAME, 'password': PASSWORD, 'displayName': text(50)}, IDENTITY),
    'LoginRequestDTO': rule('username password', {'username': USERNAME, 'password': PASSWORD}, IDENTITY),
    'SubmitMerchantApplicationRequestDTO': rule('merchantName category contactName contactPhone storeName location', {
        'merchantName': text(100), 'category': text(50), 'contactName': text(50),
        'contactPhone': text(30), 'storeName': text(100), 'location': text(200)}, MERCHANT),
    'MerchantProfileRequestDTO': rule('name storeName location', {
        'name': text(100), 'storeName': text(100), 'location': text(200)},
        'domain/merchant/service/impl/MerchantServiceImpl.java'),
    'CategoryRequestDTO': rule('code name active', {
        'code': text(32, pattern='^[a-z0-9_-]+$'), 'name': text(50), 'active': {}},
        'domain/catalog/service/impl/CatalogServiceImpl.java'),
    'ProductRequestDTO': rule('title categoryCode', {
        'title': text(100), 'description': optional_text(5000), 'categoryCode': text(32),
        'imageUrl': optional_text(255, pattern=r'^$|^/media/[a-f0-9-]+\.png$'),
        'skus': {'minItems': 1, 'maxItems': 20}, 'expectedVersion': VERSION}, CATALOG),
    'SkuRequestDTO': rule('specKey priceCent', {'specKey': text(100), 'priceCent': PRICE}, CATALOG),
    'PriceRequestDTO': rule('priceCent expectedVersion', {'priceCent': PRICE, 'expectedVersion': VERSION}, CATALOG),
    'PublishRequestDTO': rule('published', {'published': {}}, 'trigger/http/CatalogController.java'),
    'ReplenishRequestDTO': rule('quantity', {'quantity': {'minimum': 1, 'maximum': 1_000_000}},
        'domain/inventory/model/aggregate/StockBalanceAggregate.java'),
    'CartSetRequestDTO': rule('skuId quantity', {'skuId': text(64), 'quantity': {'minimum': 1, 'maximum': 99}},
        'cases/trading/impl/CartCaseImpl.java'),
    'CheckoutRequestDTO': rule('merchantId items', {'merchantId': text(36),
        'items': {'minItems': 1, 'maxItems': 20, 'description': 'SKU 不可重复，且全部属于同一商户。'}}, TRADING),
    'CheckoutItemDTO': rule('skuId quantity expectedPriceCent expectedVersion', {
        'skuId': text(64), 'quantity': {'minimum': 1, 'maximum': 99},
        'expectedPriceCent': {'minimum': 1}, 'expectedVersion': VERSION}, TRADING),
    'ConfirmProposalRequestDTO': rule('selectedSkuIds', {
        'selectedSkuIds': {'minItems': 1, 'maxItems': 20, 'uniqueItems': True,
                           'items': {'type': 'string'}, 'description': '只能选择当前提案内 SKU，不可重复或包含 null。'}},
        'cases/shoppingai/impl/ShoppingAiCaseImpl.java'),
    'RefundRequestDTO': rule('reason', {'reason': REASON}, 'domain/trading/service/impl/AfterSaleServiceImpl.java'),
    'ReviewRequestDTO': rule('approved', {'approved': {},
        'reason': optional_text(500, description='入驻驳回必填；退款同意/驳回均必填，详见各操作 schema。')},
        'trigger/http/MerchantApplicationController.java'),
    'StateRequestDTO': rule('active reason', {'active': {}, 'reason': REASON},
        'cases/merchant/impl/MerchantAdmissionCaseImpl.java'),
    'VerifyPickupRequestDTO': rule('token', {'token': text(200, writeOnly=True)},
        'domain/fulfillment/model/aggregate/PickupAggregate.java'),
    'InvitationRequestDTO': rule('username', {'username': USERNAME}, IDENTITY),
    'RoleAssignmentRequestDTO': rule('roleCode', {'roleCode': {'pattern': r'^(CLERK|R[a-f0-9]{12})$'}}, ACCESS),
    'RoleRequestDTO': rule('name permissions', {'name': text(40),
        'permissions': {'minItems': 1, 'maxItems': 12, 'description':
            '仅允许 grantable 权限；写权限须包含对应读权限，dashboard.read 须包含 order.read。重复值按 Set 去重。'}}, ACCESS),
    'KnowledgeBaseRequestDTO': rule('name visibility', {'merchantId': optional_text(36), 'name': text(100),
        'visibility': {'enum': ['PUBLIC', 'MERCHANT_INTERNAL', 'PLATFORM_INTERNAL'],
                       'description': '平台库仅 PUBLIC/PLATFORM_INTERNAL；商户库仅 PUBLIC/MERCHANT_INTERNAL。'}},
        'domain/shoppingai/service/impl/KnowledgeServiceImpl.java'),
    'DocumentUploadRequestDTO': rule('title filename base64', {'rootId': optional_text(36), 'title': text(120),
        'filename': text(120), 'contentType': optional_text(100),
        'base64': text(2_800_000, writeOnly=True, description='标准 Base64，解码后 1–2,000,000 字节；文本/Markdown/文本 PDF。')}, KNOWLEDGE),
    'FileUploadRequestDTO': rule('base64', {'filename': {'description': '图片接口忽略此元数据，实际检查内容并重编码。'},
        'contentType': {'description': '图片接口以实际内容判定格式。'},
        'base64': text(2_800_000, writeOnly=True, description='标准 Base64，解码后 1–2,000,000 字节；图片重编码为 PNG。')},
        'trigger/http/RequestInputs.java'),
    'ChatRequestDTO': rule('question', {'conversationId': optional_text(36), 'question': text(2000,
        description='API 最长 2000；当前导购 UI 主动限制为 500。')}, 'cases/shoppingai/impl/ShoppingAiCaseImpl.java'),
}


def merge_request_rules(schemas, root):
    expected = {name for name in schemas if name.endswith('RequestDTO')} | {'CheckoutItemDTO'}
    assert expected == set(REQUEST_RULES), '请求 DTO 约束表缺项或遗留：'+str(expected ^ set(REQUEST_RULES))
    for name, original in REQUEST_RULES.items():
        values = deepcopy(original)
        source = values['x-constraint-source']
        module = 'campus-shopping-'+{'cases': 'case'}.get(source.split('/')[0], source.split('/')[0])
        path = module+'/src/main/java/cn/bugstack/ai/'+source
        assert (root/path).is_file(), path
        values['x-constraint-source'] = path
        schema = schemas[name]
        assert set(values['required']) <= set(schema['properties']), name
        assert set(values['properties']) == set(schema['properties']), name+' 约束字段与 DTO 不一致'
        for field, constraints in values.pop('properties').items():
            schema['properties'][field].update(constraints)
        schema.update(values)
        schema['additionalProperties'] = True
        schema['description'] += '；业务约束经专项核对，未知属性忽略，身份/角色不从附加字段读取。'
    permissions = (root/'campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/model/valobj/MerchantPermissionEnumVO.java').read_text('utf-8')
    import re
    grantable = sorted(re.findall(r'\b[A-Z_]+\("([a-z.]+)",\s*"[^"]+",\s*true,', permissions))
    assert len(grantable) == 12
    schemas['RoleRequestDTO']['properties']['permissions']['items'] = {'type': 'string', 'enum': grantable}


def request_schema(row, dto, schema):
    if dto == 'ProductRequestDTO':
        additional = ['skus'] if row['method'] == 'POST' else ['expectedVersion']
        return {'allOf': [schema, {'required': additional}]}
    if dto == 'ReviewRequestDTO':
        reason = {'required': ['reason'], 'properties': {'reason': {'type': 'string', **REASON}}}
        if row['path'].endswith('/refund-decision'):
            return {'allOf': [schema, reason]}
        return {'allOf': [schema, {'if': {'properties': {'approved': {'const': False}}, 'required': ['approved']},
                                  'then': reason}]}
    if dto == 'KnowledgeBaseRequestDTO':
        return {'allOf': [schema, {
            'if': {'required': ['merchantId'], 'properties': {'merchantId': {'type': 'string', 'pattern': r'\S'}}},
            'then': {'properties': {'visibility': {'enum': ['PUBLIC', 'MERCHANT_INTERNAL']}}},
            'else': {'properties': {'visibility': {'enum': ['PUBLIC', 'PLATFORM_INTERNAL']}}},
        }]}
    return schema
