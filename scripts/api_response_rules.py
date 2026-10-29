"""逐字段核对的响应约束。所有字段必须出现；只有明确列出的字段允许 null。"""
from copy import deepcopy
import re

# 格式为 (非空字段, 可空字段)；新增/删除 DTO 字段必须人工决定语义。
FIELDS = {
    'AdmissionResponseDTO': ('applicationId merchantName status', 'category contactName contactPhone storeName location rejectionReason merchantId'),
    'AfterSaleResponseDTO': ('id orderId merchantId status reason decisionReason createdAt', ''),
    'CartResponseDTO': ('merchantId merchantName skuId title specKey imageUrl priceCent quoteVersion quantity available sellable', ''),
    'CategoryResponseDTO': ('code name active', ''),
    'ChatResponseDTO': ('conversationId answer mode retrievalMode citations latencyMs', 'warning proposal'),
    'CitationResponseDTO': ('documentId title snippet', ''),
    'ConversationResponseDTO': ('id title createdAt', ''),
    'CsrfTokenResponseDTO': ('headerName token', ''),
    'CurrentUserResponseDTO': ('userId username displayName status', ''),
    'ImageResponseDTO': ('url', ''),
    'InvitationResponseDTO': ('id merchantId targetUserId status expiresAt', ''),
    'KnowledgeBaseResponseDTO': ('id name visibility', 'merchantId'),
    'KnowledgeDocumentResponseDTO': ('id rootId baseId title version status indexStatus createdAt', 'error content'),
    'MembershipResponseDTO': ('merchantId userId role status', ''),
    'MerchantResponseDTO': ('merchantId name category status storeId storeName location', ''),
    'MessageResponseDTO': ('id role content createdAt', ''),
    'OrderItemResponseDTO': ('skuId title specKey imageUrl unitPriceCent quantity', ''),
    'OrderResponseDTO': ('orderId buyerId merchantId merchantName storeId status totalCent deadline createdAt items', 'pickup afterSale'),
    'PageResponseDTO': ('items page size total hasNext', ''),
    'PermissionResponseDTO': ('code label grantable', ''),
    'PickupResponseDTO': ('status', 'expiresAt'),
    'ProductResponseDTO': ('productId merchantId merchantName storeId title description categoryCode imageUrl status version skus', ''),
    'ProposalItemResponseDTO': ('skuId merchantId title specKey imageUrl priceCent quoteVersion quantity', ''),
    'ProposalResponseDTO': ('id status items expiresAt', ''),
    'RegisterResponseDTO': ('userId', ''),
    'RoleResponseDTO': ('code name permissions builtin', ''),
    'SkuResponseDTO': ('skuId specKey priceCent status quoteVersion available', ''),
    'StatisticsResponseDTO': ('totalOrders pendingCount paidCount completedCount refundedCount completedAmountCent', ''),
    'StockMovementResponseDTO': ('id skuId type quantity bizKey createdAt', ''),
    'StockResponseDTO': ('skuId storeId onHand reserved available version', 'productId productTitle specKey imageUrl'),
    'SubmitMerchantApplicationResponseDTO': ('applicationId status', ''),
    'TokenResponseDTO': ('token expiresAt', ''),
    'WorkspaceResponseDTO': ('platformAdmin merchantPermissions memberships merchants', ''),
}

ENUM_FIELDS = {
    ('AdmissionResponseDTO', 'status'): 'merchant/model/valobj/MerchantApplicationStatusEnumVO',
    ('SubmitMerchantApplicationResponseDTO', 'status'): 'merchant/model/valobj/MerchantApplicationStatusEnumVO',
    ('CurrentUserResponseDTO', 'status'): 'identity/model/valobj/UserAccountStatusEnumVO',
    ('OrderResponseDTO', 'status'): 'trading/model/valobj/OrderStatusEnumVO',
    ('AfterSaleResponseDTO', 'status'): 'trading/model/valobj/AfterSaleStatusEnumVO',
    ('ProductResponseDTO', 'status'): 'catalog/model/valobj/ProductStatusEnumVO',
    ('SkuResponseDTO', 'status'): 'catalog/model/valobj/SkuStatusEnumVO',
    ('PickupResponseDTO', 'status'): 'fulfillment/model/valobj/PickupStatusEnumVO',
    ('ProposalResponseDTO', 'status'): 'shoppingai/model/valobj/ProposalStatusEnumVO',
    ('KnowledgeBaseResponseDTO', 'visibility'): 'shoppingai/model/valobj/KnowledgeVisibilityEnumVO',
    ('KnowledgeDocumentResponseDTO', 'status'): 'shoppingai/model/valobj/KnowledgeDocumentStatusEnumVO',
    ('KnowledgeDocumentResponseDTO', 'indexStatus'): 'shoppingai/model/valobj/KnowledgeIndexStatusEnumVO',
    ('MerchantResponseDTO', 'status'): 'merchant/model/valobj/MerchantStatusEnumVO',
    ('MembershipResponseDTO', 'status'): 'identity/model/valobj/MembershipStatusEnumVO',
    ('InvitationResponseDTO', 'status'): 'identity/model/valobj/InvitationStatusEnumVO',
    ('StockMovementResponseDTO', 'type'): 'inventory/model/valobj/StockMovementTypeEnumVO',
}


def enum_codes(root, source):
    path = root/'campus-shopping-domain/src/main/java/cn/bugstack/ai/domain'/f'{source}.java'
    # 状态 HTTP 编码与枚举名一致；兼容带描述参数和无参数的状态枚举。
    values = re.findall(r'^\s*([A-Z][A-Z_0-9]*)\s*(?:\(|[,;}])', path.read_text('utf-8'), re.M)
    assert values, path
    return values


def merge_response_rules(schemas, root):
    assert {n for n in schemas if n.endswith('ResponseDTO')} == set(FIELDS), '响应 DTO 约束表缺项/遗留'
    for name, (non_null, nullable) in FIELDS.items():
        properties = schemas[name]['properties']
        assert set(properties) == set((non_null+' '+nullable).split()), name+' 响应字段漂移'
        schemas[name]['required'] = list(properties)
        schemas[name]['x-nullable-fields'] = nullable.split()
        for field in nullable.split():
            properties[field] = {'anyOf': [properties[field], {'type': 'null'}]}
    for (name, field), source in ENUM_FIELDS.items():
        schemas[name]['properties'][field]['enum'] = enum_codes(root, source)
    schemas['MessageResponseDTO']['properties']['role']['enum'] = ['user', 'assistant']
    schemas['ChatResponseDTO']['properties']['mode']['enum'] = ['LOCAL_RETRIEVAL_DEMO', 'LLM', 'LOCAL_FALLBACK']
    schemas['ChatResponseDTO']['properties']['retrievalMode']['enum'] = ['REMOTE_EMBEDDING', 'LOCAL_CHAR_NGRAM_DEMO', 'BM25_DEGRADED']
    schemas['OrderResponseDTO']['properties']['items']['minItems'] = 1
    schemas['ProductResponseDTO']['properties']['skus'].update(minItems=1, maxItems=20)
    schemas['ProposalResponseDTO']['properties']['items'].update(minItems=1, maxItems=3)
    schemas['WorkspaceResponseDTO']['properties']['merchantPermissions'] = {
        'type': 'object', 'additionalProperties': {'type': 'array', 'items': {'type': 'string'}, 'uniqueItems': True}}


def success_data(row, schema):
    # 入驻审核驳回成功不产生 Merchant；其余非 Void 成功都必须返回实体。
    if row['method'] == 'POST' and row['path'] == '/api/v1/admin/merchant-applications/{applicationId}/review':
        return {'anyOf': [deepcopy(schema), {'type': 'null'}]}
    return schema


def query_enum(root, row, name):
    if name not in {'state', 'status'}:
        return None
    controller = row['controller']
    source = {'OrderController.java': 'trading/model/valobj/OrderStatusEnumVO',
              'AfterSaleController.java': 'trading/model/valobj/AfterSaleStatusEnumVO',
              'FulfillmentController.java': 'fulfillment/model/valobj/PickupStatusEnumVO',
              'CatalogController.java': 'catalog/model/valobj/ProductStatusEnumVO'}.get(controller)
    return ['', *enum_codes(root, source)] if source else None
