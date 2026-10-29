# HTTP API 当前权威契约（v1.1）

> 本文件由 `python scripts/generate-api-contract.py` 从当前 Controller/DTO **生成**；禁止手工追加旧版路由。
> 接口字段来自源码，未带 Bean Validation 的 DTO 不代表任何字段都可为空。业务规则见 [行为契约](behavior-v1.1.md)，
> 机器可读的 93 条接口、参数、返回结构见 [OpenAPI JSON](openapi.json)，可在 CI 运行 `--check` 发现漂移。

## 统一约定

- URL 前缀：`/api/v1`；普通 JSON 响应结构为 `{ "code":"0000", "info":"成功", "data":... }`；HTTP 200 也可能有失败业务码。
- 使用同源 `JSESSIONID` Session；写请求先从 `GET /api/v1/auth/csrf` 取得 `data.token` 与 `data.headerName`，随请求头发送。
- 公共匿名 GET：商品、分类、公开商户；注册/登录仅匿名用户可 POST，且必须带 CSRF。其他 API 需登录并执行领域权限校验。
- 幂等键：入驻申请、补货、结算的 `Idempotency-Key` **业务必填且最长 64 字符**；同键不同内容返回业务冲突。
- 分页：`page` 从 1 开始，`size` 范围 1–100；`data.items/page/size/total/hasNext`。搜索参数 `q` 先在 SQL 过滤，再按相同条件 COUNT。
- 错误码以 `ResponseCode.java` 为准；HTTP 状态与业务码相互独立，鉴权缺失一般 401、CSRF/拒绝访问一般 403。
- Spring MVC 安全过滤器与真实 MySQL 仍需实际集成测试；此文档是静态契约，不是运行证明。

## 全量路由（共 93 条）

| 方法 | 路径 | 请求参数 / 主体 | data 类型 | 访问控制 | 实现类 |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/aftersales` | state?:String、page?:int、size?:int | `List<AfterSaleResponseDTO>` | platform-admin | `AfterSaleController.java` |
| `GET` | `/api/v1/admin/aftersales/page` | state?:String、page?:int、size?:int | `PageResponseDTO<AfterSaleResponseDTO>` | platform-admin | `AfterSaleController.java` |
| `POST` | `/api/v1/admin/categories` | body:CategoryRequestDTO | `Void` | platform-admin | `CatalogController.java` |
| `GET` | `/api/v1/admin/merchant-applications` | state?:String、page?:int、size?:int | `List<AdmissionResponseDTO>` | platform-admin | `MerchantApplicationController.java` |
| `GET` | `/api/v1/admin/merchant-applications/page` | state?:String、page?:int、size?:int、q?:String | `PageResponseDTO<AdmissionResponseDTO>` | platform-admin | `MerchantApplicationController.java` |
| `POST` | `/api/v1/admin/merchant-applications/{applicationId}/review` | applicationId:String、body:ReviewRequestDTO | `MerchantResponseDTO` | platform-admin | `MerchantApplicationController.java` |
| `GET` | `/api/v1/admin/merchants` | page?:int、size?:int | `List<MerchantResponseDTO>` | platform-admin | `MerchantApplicationController.java` |
| `GET` | `/api/v1/admin/merchants/page` | page?:int、size?:int、q?:String | `PageResponseDTO<MerchantResponseDTO>` | platform-admin | `MerchantApplicationController.java` |
| `POST` | `/api/v1/admin/merchants/{merchantId}/state` | merchantId:String、body:StateRequestDTO | `Void` | platform-admin | `MerchantApplicationController.java` |
| `GET` | `/api/v1/admin/orders` | state?:String、page?:int、size?:int | `List<OrderResponseDTO>` | platform-admin | `OrderController.java` |
| `GET` | `/api/v1/admin/orders/page` | state?:String、page?:int、size?:int、q?:String | `PageResponseDTO<OrderResponseDTO>` | platform-admin | `OrderController.java` |
| `POST` | `/api/v1/admin/orders/{orderId}/refund-decision` | orderId:String、body:ReviewRequestDTO | `Void` | platform-admin | `AfterSaleController.java` |
| `GET` | `/api/v1/admin/products` | merchantId?:String、q?:String、page?:int、size?:int | `List<ProductResponseDTO>` | platform-admin | `CatalogController.java` |
| `GET` | `/api/v1/admin/products/page` | merchantId?:String、q?:String、page?:int、size?:int | `PageResponseDTO<ProductResponseDTO>` | platform-admin | `CatalogController.java` |
| `POST` | `/api/v1/admin/products/{productId}/unpublish` | productId:String | `Void` | platform-admin | `CatalogController.java` |
| `GET` | `/api/v1/admin/statistics` | — | `StatisticsResponseDTO` | platform-admin | `OrderController.java` |
| `POST` | `/api/v1/ai/chat` | body:ChatRequestDTO | `ChatResponseDTO` | authenticated + domain ACL | `ShoppingAiController.java` |
| `GET` | `/api/v1/ai/conversations` | — | `List<ConversationResponseDTO>` | authenticated + domain ACL | `ShoppingAiController.java` |
| `GET` | `/api/v1/ai/conversations/{conversationId}/messages` | conversationId:String | `List<MessageResponseDTO>` | authenticated + domain ACL | `ShoppingAiController.java` |
| `GET` | `/api/v1/ai/conversations/{conversationId}/proposals` | conversationId:String | `List<ProposalResponseDTO>` | authenticated + domain ACL | `ShoppingAiController.java` |
| `POST` | `/api/v1/ai/proposals/{proposalId}/confirm` | proposalId:String、body:ConfirmProposalRequestDTO | `ProposalResponseDTO` | authenticated + domain ACL | `ShoppingAiController.java` |
| `POST` | `/api/v1/ai/proposals/{proposalId}/reject` | proposalId:String | `Void` | authenticated + domain ACL | `ShoppingAiController.java` |
| `GET` | `/api/v1/auth/csrf` | — | `CsrfTokenResponseDTO` | anonymous | `AuthController.java` |
| `POST` | `/api/v1/auth/login` | body:LoginRequestDTO | `CurrentUserResponseDTO` | anonymous | `AuthController.java` |
| `POST` | `/api/v1/auth/logout` | — | `Void` | authenticated + domain ACL | `AuthController.java` |
| `GET` | `/api/v1/auth/me` | — | `CurrentUserResponseDTO` | authenticated + domain ACL | `AuthController.java` |
| `POST` | `/api/v1/auth/register` | body:RegisterRequestDTO | `RegisterResponseDTO` | anonymous | `AuthController.java` |
| `GET` | `/api/v1/cart` | — | `List<CartResponseDTO>` | authenticated + domain ACL | `CartController.java` |
| `PUT` | `/api/v1/cart` | body:CartSetRequestDTO | `Void` | authenticated + domain ACL | `CartController.java` |
| `DELETE` | `/api/v1/cart/{skuId}` | skuId:String | `Void` | authenticated + domain ACL | `CartController.java` |
| `GET` | `/api/v1/categories` | — | `List<CategoryResponseDTO>` | anonymous | `CatalogController.java` |
| `GET` | `/api/v1/invitations` | — | `List<InvitationResponseDTO>` | authenticated + domain ACL | `WorkspaceController.java` |
| `POST` | `/api/v1/invitations/{id}/accept` | id:String | `Void` | authenticated + domain ACL | `WorkspaceController.java` |
| `GET` | `/api/v1/knowledge/bases` | — | `List<KnowledgeBaseResponseDTO>` | authenticated + domain ACL | `KnowledgeController.java` |
| `POST` | `/api/v1/knowledge/bases` | body:KnowledgeBaseRequestDTO | `KnowledgeBaseResponseDTO` | authenticated + domain ACL | `KnowledgeController.java` |
| `GET` | `/api/v1/knowledge/bases/{baseId}/documents` | baseId:String、page?:int、size?:int | `List<KnowledgeDocumentResponseDTO>` | authenticated + domain ACL | `KnowledgeController.java` |
| `POST` | `/api/v1/knowledge/bases/{baseId}/documents` | baseId:String、body:DocumentUploadRequestDTO | `KnowledgeDocumentResponseDTO` | authenticated + domain ACL | `KnowledgeController.java` |
| `GET` | `/api/v1/knowledge/bases/{baseId}/documents/page` | baseId:String、page?:int、size?:int | `PageResponseDTO<KnowledgeDocumentResponseDTO>` | authenticated + domain ACL | `KnowledgeController.java` |
| `GET` | `/api/v1/knowledge/documents/{documentId}` | documentId:String | `KnowledgeDocumentResponseDTO` | authenticated + domain ACL | `KnowledgeController.java` |
| `POST` | `/api/v1/knowledge/documents/{documentId}/index` | documentId:String | `KnowledgeDocumentResponseDTO` | authenticated + domain ACL | `KnowledgeController.java` |
| `POST` | `/api/v1/knowledge/documents/{documentId}/publish` | documentId:String | `Void` | authenticated + domain ACL | `KnowledgeController.java` |
| `POST` | `/api/v1/knowledge/documents/{documentId}/withdraw` | documentId:String | `Void` | authenticated + domain ACL | `KnowledgeController.java` |
| `POST` | `/api/v1/merchant-applications` | body:SubmitMerchantApplicationRequestDTO、Idempotency-Key:String | `SubmitMerchantApplicationResponseDTO` | authenticated + domain ACL | `MerchantApplicationController.java` |
| `GET` | `/api/v1/merchant-applications/mine` | page?:int、size?:int | `List<AdmissionResponseDTO>` | authenticated + domain ACL | `MerchantApplicationController.java` |
| `GET` | `/api/v1/merchant-applications/mine/page` | page?:int、size?:int | `PageResponseDTO<AdmissionResponseDTO>` | authenticated + domain ACL | `MerchantApplicationController.java` |
| `GET` | `/api/v1/merchants/public` | page?:int、size?:int | `List<MerchantResponseDTO>` | anonymous | `MerchantApplicationController.java` |
| `GET` | `/api/v1/merchants/public/page` | page?:int、size?:int | `PageResponseDTO<MerchantResponseDTO>` | anonymous | `MerchantApplicationController.java` |
| `GET` | `/api/v1/merchants/public/{merchantId}` | merchantId:String | `MerchantResponseDTO` | anonymous | `MerchantApplicationController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/aftersales` | merchantId:String、state?:String、page?:int、size?:int | `List<AfterSaleResponseDTO>` | authenticated + domain ACL | `AfterSaleController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/aftersales/page` | merchantId:String、state?:String、page?:int、size?:int | `PageResponseDTO<AfterSaleResponseDTO>` | authenticated + domain ACL | `AfterSaleController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/images` | merchantId:String、body:FileUploadRequestDTO | `ImageResponseDTO` | authenticated + domain ACL | `CatalogController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/invitations` | merchantId:String、body:InvitationRequestDTO | `InvitationResponseDTO` | authenticated + domain ACL | `WorkspaceController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/members` | merchantId:String | `List<MembershipResponseDTO>` | authenticated + domain ACL | `WorkspaceController.java` |
| `DELETE` | `/api/v1/merchants/{merchantId}/members/{userId}` | merchantId:String、userId:String | `Void` | authenticated + domain ACL | `WorkspaceController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/orders` | merchantId:String、state?:String、page?:int、size?:int | `List<OrderResponseDTO>` | authenticated + domain ACL | `OrderController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/orders/page` | merchantId:String、state?:String、page?:int、size?:int、q?:String | `PageResponseDTO<OrderResponseDTO>` | authenticated + domain ACL | `OrderController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/orders/{orderId}/prepare` | merchantId:String、orderId:String | `Void` | authenticated + domain ACL | `FulfillmentController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/orders/{orderId}/ready` | merchantId:String、orderId:String | `Void` | authenticated + domain ACL | `FulfillmentController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/orders/{orderId}/refund-decision` | merchantId:String、orderId:String、body:ReviewRequestDTO | `Void` | authenticated + domain ACL | `AfterSaleController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/orders/{orderId}/verify` | merchantId:String、orderId:String、body:VerifyPickupRequestDTO | `OrderResponseDTO` | authenticated + domain ACL | `FulfillmentController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/products` | merchantId:String、page?:int、size?:int | `List<ProductResponseDTO>` | authenticated + domain ACL | `CatalogController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/products` | merchantId:String、body:ProductRequestDTO | `ProductResponseDTO` | authenticated + domain ACL | `CatalogController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/products/page` | merchantId:String、q?:String、category?:String、status?:String、page?:int、size?:int、sort?:String | `PageResponseDTO<ProductResponseDTO>` | authenticated + domain ACL | `CatalogController.java` |
| `PUT` | `/api/v1/merchants/{merchantId}/products/{productId}` | merchantId:String、productId:String、body:ProductRequestDTO | `Void` | authenticated + domain ACL | `CatalogController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/products/{productId}/publish` | merchantId:String、productId:String、body:PublishRequestDTO | `Void` | authenticated + domain ACL | `CatalogController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/products/{productId}/skus` | merchantId:String、productId:String、body:SkuRequestDTO | `ProductResponseDTO` | authenticated + domain ACL | `CatalogController.java` |
| `PUT` | `/api/v1/merchants/{merchantId}/products/{productId}/skus/{skuId}/price` | merchantId:String、productId:String、skuId:String、body:PriceRequestDTO | `Void` | authenticated + domain ACL | `CatalogController.java` |
| `PUT` | `/api/v1/merchants/{merchantId}/profile` | merchantId:String、body:MerchantProfileRequestDTO | `MerchantResponseDTO` | authenticated + domain ACL | `MerchantApplicationController.java` |
| `PUT` | `/api/v1/merchants/{merchantId}/rbac/members/{userId}/role` | merchantId:String、userId:String、body:RoleAssignmentRequestDTO | `Void` | authenticated + domain ACL | `RoleController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/rbac/permissions` | merchantId:String | `List<PermissionResponseDTO>` | authenticated + domain ACL | `RoleController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/rbac/roles` | merchantId:String | `List<RoleResponseDTO>` | authenticated + domain ACL | `RoleController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/rbac/roles` | merchantId:String、body:RoleRequestDTO | `RoleResponseDTO` | authenticated + domain ACL | `RoleController.java` |
| `DELETE` | `/api/v1/merchants/{merchantId}/rbac/roles/{code}` | merchantId:String、code:String | `Void` | authenticated + domain ACL | `RoleController.java` |
| `PUT` | `/api/v1/merchants/{merchantId}/rbac/roles/{code}` | merchantId:String、code:String、body:RoleRequestDTO | `RoleResponseDTO` | authenticated + domain ACL | `RoleController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/statistics` | merchantId:String | `StatisticsResponseDTO` | authenticated + domain ACL | `OrderController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/stock-movements` | merchantId:String、page?:int、size?:int | `List<StockMovementResponseDTO>` | authenticated + domain ACL | `InventoryController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/stock-movements/page` | merchantId:String、page?:int、size?:int | `PageResponseDTO<StockMovementResponseDTO>` | authenticated + domain ACL | `InventoryController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/stocks` | merchantId:String、page?:int、size?:int | `List<StockResponseDTO>` | authenticated + domain ACL | `InventoryController.java` |
| `GET` | `/api/v1/merchants/{merchantId}/stocks/page` | merchantId:String、page?:int、size?:int、q?:String | `PageResponseDTO<StockResponseDTO>` | authenticated + domain ACL | `InventoryController.java` |
| `POST` | `/api/v1/merchants/{merchantId}/stocks/{skuId}/replenish` | merchantId:String、skuId:String、body:ReplenishRequestDTO、Idempotency-Key:String | `Void` | authenticated + domain ACL | `InventoryController.java` |
| `GET` | `/api/v1/orders` | state?:String、page?:int、size?:int | `List<OrderResponseDTO>` | authenticated + domain ACL | `OrderController.java` |
| `POST` | `/api/v1/orders` | body:CheckoutRequestDTO、Idempotency-Key:String | `OrderResponseDTO` | authenticated + domain ACL | `OrderController.java` |
| `GET` | `/api/v1/orders/page` | state?:String、page?:int、size?:int | `PageResponseDTO<OrderResponseDTO>` | authenticated + domain ACL | `OrderController.java` |
| `GET` | `/api/v1/orders/{orderId}` | orderId:String | `OrderResponseDTO` | authenticated + domain ACL | `OrderController.java` |
| `POST` | `/api/v1/orders/{orderId}/appeal` | orderId:String | `Void` | authenticated + domain ACL | `AfterSaleController.java` |
| `POST` | `/api/v1/orders/{orderId}/cancel` | orderId:String | `OrderResponseDTO` | authenticated + domain ACL | `OrderController.java` |
| `POST` | `/api/v1/orders/{orderId}/pay` | orderId:String | `OrderResponseDTO` | authenticated + domain ACL | `OrderController.java` |
| `POST` | `/api/v1/orders/{orderId}/pickup-token` | orderId:String | `TokenResponseDTO` | authenticated + domain ACL | `FulfillmentController.java` |
| `POST` | `/api/v1/orders/{orderId}/refunds` | orderId:String、body:RefundRequestDTO | `AfterSaleResponseDTO` | authenticated + domain ACL | `AfterSaleController.java` |
| `GET` | `/api/v1/products` | merchantId?:String、q?:String、category?:String、page?:int、size?:int | `List<ProductResponseDTO>` | anonymous | `CatalogController.java` |
| `GET` | `/api/v1/products/page` | merchantId?:String、q?:String、category?:String、page?:int、size?:int、sort?:String | `PageResponseDTO<ProductResponseDTO>` | anonymous | `CatalogController.java` |
| `GET` | `/api/v1/products/{productId}` | productId:String | `ProductResponseDTO` | anonymous | `CatalogController.java` |
| `GET` | `/api/v1/workspace` | — | `WorkspaceResponseDTO` | authenticated + domain ACL | `WorkspaceController.java` |

## DTO 字段索引

以下字段由 API DTO 自动提取，约束、权限和枚举含义以 `behavior-v1.1.md` 与领域校验为准。

### `AdmissionResponseDTO`

`applicationId`、`merchantName`、`category`、`contactName`、`contactPhone`、`storeName`、`location`、`status`、`rejectionReason`、`merchantId`

### `AfterSaleResponseDTO`

`id`、`orderId`、`merchantId`、`status`、`reason`、`decisionReason`、`createdAt`

### `CartResponseDTO`

`merchantId`、`merchantName`、`skuId`、`title`、`specKey`、`imageUrl`、`priceCent`、`quoteVersion`、`quantity`、`available`、`sellable`

### `CartSetRequestDTO`

`skuId`、`quantity`

### `CategoryRequestDTO`

`code`、`name`、`active`

### `CategoryResponseDTO`

`code`、`name`、`active`

### `ChatRequestDTO`

`conversationId`、`question`

### `ChatResponseDTO`

`conversationId`、`answer`、`mode`、`retrievalMode`、`warning`、`citations`、`proposal`、`latencyMs`

### `CheckoutItemDTO`

`skuId`、`quantity`、`expectedPriceCent`、`expectedVersion`

### `CheckoutRequestDTO`

`merchantId`、`items`

### `CitationResponseDTO`

`documentId`、`title`、`snippet`

### `ConfirmProposalRequestDTO`

`selectedSkuIds`

### `ConversationResponseDTO`

`id`、`title`、`createdAt`

### `CsrfTokenResponseDTO`

`headerName`、`token`

### `CurrentUserResponseDTO`

`userId`、`username`、`displayName`、`status`

### `DocumentUploadRequestDTO`

`rootId`、`title`、`filename`、`contentType`、`base64`

### `FileUploadRequestDTO`

`filename`、`contentType`、`base64`

### `ImageResponseDTO`

`url`

### `InvitationRequestDTO`

`username`

### `InvitationResponseDTO`

`id`、`merchantId`、`targetUserId`、`status`、`expiresAt`

### `KnowledgeBaseRequestDTO`

`merchantId`、`name`、`visibility`

### `KnowledgeBaseResponseDTO`

`id`、`name`、`merchantId`、`visibility`

### `KnowledgeDocumentResponseDTO`

`id`、`rootId`、`baseId`、`title`、`version`、`status`、`indexStatus`、`error`、`content`、`createdAt`

### `LoginRequestDTO`

`username`、`password`

### `MembershipResponseDTO`

`merchantId`、`userId`、`role`、`status`

### `MerchantProfileRequestDTO`

`name`、`storeName`、`location`

### `MerchantResponseDTO`

`merchantId`、`name`、`category`、`status`、`storeId`、`storeName`、`location`

### `MessageResponseDTO`

`id`、`role`、`content`、`createdAt`

### `OrderItemResponseDTO`

`skuId`、`title`、`specKey`、`imageUrl`、`unitPriceCent`、`quantity`

### `OrderResponseDTO`

`orderId`、`buyerId`、`merchantId`、`merchantName`、`storeId`、`status`、`totalCent`、`deadline`、`createdAt`、`items`、`pickup`、`afterSale`

### `PageResponseDTO`

`items`、`page`、`size`、`total`、`hasNext`

### `PermissionResponseDTO`

`code`、`label`、`grantable`

### `PickupResponseDTO`

`status`、`expiresAt`

### `PriceRequestDTO`

`priceCent`、`expectedVersion`

### `ProductRequestDTO`

`title`、`description`、`categoryCode`、`imageUrl`、`skus`、`expectedVersion`

### `ProductResponseDTO`

`productId`、`merchantId`、`merchantName`、`storeId`、`title`、`description`、`categoryCode`、`imageUrl`、`status`、`version`、`skus`

### `ProposalItemResponseDTO`

`skuId`、`merchantId`、`title`、`specKey`、`imageUrl`、`priceCent`、`quoteVersion`、`quantity`

### `ProposalResponseDTO`

`id`、`status`、`items`、`expiresAt`

### `PublishRequestDTO`

`published`

### `RefundRequestDTO`

`reason`

### `RegisterRequestDTO`

`username`、`password`、`displayName`

### `RegisterResponseDTO`

`userId`

### `ReplenishRequestDTO`

`quantity`

### `ReviewRequestDTO`

`approved`、`reason`

### `RoleAssignmentRequestDTO`

`roleCode`

### `RoleRequestDTO`

`name`、`permissions`

### `RoleResponseDTO`

`code`、`name`、`permissions`、`builtin`

### `SkuRequestDTO`

`specKey`、`priceCent`

### `SkuResponseDTO`

`skuId`、`specKey`、`priceCent`、`status`、`quoteVersion`、`available`

### `StateRequestDTO`

`active`、`reason`

### `StatisticsResponseDTO`

`totalOrders`、`pendingCount`、`paidCount`、`completedCount`、`refundedCount`、`completedAmountCent`

### `StockMovementResponseDTO`

`id`、`skuId`、`type`、`quantity`、`bizKey`、`createdAt`

### `StockResponseDTO`

`skuId`、`productId`、`productTitle`、`specKey`、`imageUrl`、`storeId`、`onHand`、`reserved`、`available`、`version`

### `SubmitMerchantApplicationRequestDTO`

`merchantName`、`category`、`contactName`、`contactPhone`、`storeName`、`location`

### `SubmitMerchantApplicationResponseDTO`

`applicationId`、`status`

### `TokenResponseDTO`

`token`、`expiresAt`

### `VerifyPickupRequestDTO`

`token`

### `WorkspaceResponseDTO`

`platformAdmin`、`merchantPermissions`、`memberships`、`merchants`

## 执行与持续一致性验证

```bash
python scripts/generate-api-contract.py --check
python scripts/verify-api-contract.py
```

前端当前请求层是 `frontend/src/services/api.js`，旧版 `static/assets/app.js` 仅供 legacy 参考。
完整真实浏览器与后端联调命令见 `frontend/tests/live_ui.py` 和 `scripts/smoke-full.py`。
