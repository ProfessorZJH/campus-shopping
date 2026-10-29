# SDD-02：前后端契约与图片快照修复规格

> 来源：PRD v1.0、2026-10-28 A01-A05/B01-B05 审查。目标：保留 R1 DDD 模块，优先重用原接口，以新增只读契约与单列迁移补齐集成缺口。本文件是**实施规格**，不是运行验收报告。

## 1. 范围、规则、实现

| ID | 需求/验收行为 | 实施文件关键点 | DB 迁移 | 测试门禁 |
|---|---|---|---|---|
| A01 | 商品详情可进入营业商户公开详情，按商户分页浏览在售商品 | `pages/Shop.js`、`main.js` + B05 | 无 | 商户详情页面/分页路由 |
| A02 | 创建商品一次可提交 1~20 个不重复规格；已有商品可新增规格，拒绝无效价格 | `Merchant.js`、现有 Catalog Case | 无 | 多规格前端交互 + API body |
| A03 | 上传文档新版本时传原 `rootId`，普通上传为 null | `Knowledge.js` + 原知识库 POST | 无 | 文档版本根不变，版本递增 |
| A04 | 监管列表展示商户名；缺名时明确降级为 ID | `ProductResponseDTO.merchantName`、`OrderResponseDTO.merchantName`，Platform.js | 无 | 后端读模型/页面校验 |
| A05 | 所有主要长列表按页查询，筛选条件送到后端，支持上一页/下一页及记录总数 | `PageResponseDTO`、Controller/DAO COUNT、Home/Merchant/Orders/Platform/MerchantOps/Knowledge/Account | 无 | 130 件商品跨页搜索及换页 |
| B01 | 购物车显示当前 Catalog 商品主图，缺图占位 | `CartResponseDTO.imageUrl` + `CartController` | 无 | 返回 DTO 含 imageUrl |
| B02 | AI 推荐 Proposal 带原商品图片，旧 JSON 提案兼容空值 | `ProposalItemVO/DTO.imageUrl`、ShoppingAiCase/Controller | 无 | 老提案可反序列化 |
| B03 | 新订单行写下单时 `image_url`，后续商品换图不影响订单快照 | `OrderItemEntity/PO/DTO`、CheckoutCase、TradingRepository、Mapper | **新增 1 列** | 新旧订单快照兼容；SQL 迁移 |
| B04 | 主要分页请求返回 `items/page/size/total/hasNext`，且 total 基于相同筛选条件的 COUNT | 新分页 GET、Repository/DAO/XML | 无 | 浏览器 HTTP 契约及分页对照 |
| B05 | 匿名可按 ID 查询 ACTIVE 商户；停用不可公开展示 | `GET /merchants/public/{merchantId}` + Shop | 无 | 正常/停用商户访问 |

## 2. 原则

- 保留旧 `List<T>` 路由，避免破坏上一版调用方；新前端改用路径后缀 `/page`。列表从真实后端获得 total，不用伪造数据或从当前页推算。
- 商户商品新 `/page` 接收 `q`,`category`,`status`；`status` 取空值、`DRAFT`、`PUBLISHED` 或 `UNPUBLISHED`。**低库存**属于库存域的业务概念，前端当前标为**本页低库存**，不把它伪装成跨页服务端查询。
- 只有消费者可见商户、商品可以匿名查；平台和商户数据仍在每个 Controller / Case 检查权限，前端不会把输入用户 ID 当身份。
- `StockResponseDTO` 在 `/stocks/page` 附带商品名、规格和主图，避免库存列表依赖商品列表首 100 条。库存数据和报价分别由 Inventory / Catalog 服务取得，由 CatalogCase 编排后组成只读 DTO。
- 历史订单主图是下单瞬间快照，不允许修改历史行；旧订单 `image_url=''` 时前端显示占位图，**订单列表与订单详情均禁止使用 `coverSku` 反查当前商品图**。
- 图片上传和保存仍是商户受控写接口；纯读模型不创建任何新 Repository/Port 或对外第三方依赖。
- 商户商品列表的“全部/在售”页签数字只在选中相应状态时使用服务端 `total`；不得把本页 9 条当全库商品量。其他基于当前页执行的自由文本筛选应明确保持当前页语义，不能宣称跨页全文搜索。
- 设计预览 `?demo=1` 明确使用演示数据且写操作禁用，不能作为 Java/MySQL 端到端验收。

## 3. HTTP 契约

旧 API URL 不改变。新增通用成功数据结构：

```json
{"code":"0000","info":"成功","data":{"items":[],"page":1,"size":20,"total":0,"hasNext":false}}
```

`page` 从 1 开始、`1<=size<=100`、`total>=0`；`hasNext = page*size < total`。GET 的 `state` 参数用于订单、售后和审核申请；`q/category/status` 用于商户商品；首页及平台商品使用原有 `q` 查询。鉴权、CSRF、`Response.code` 错误判断和单商户订单规则保持 R1 不变。接口列表见 [HTTP 契约](../api/http-api.md)。

图片字段：购物车项 `imageUrl` 实时取自 Catalog；AI 提案项 `imageUrl` 保存提案时从可信 Catalog 报价快照传递；订单项 `imageUrl` 下单时保存到订单行，永不回查覆盖。

## 4. DDL 与执行顺序

1. 已有数据库执行只读备份并核对 `SHOW CREATE TABLE trd_order_item`。
2. 运行 `docs/database/migrations/V20261028_01__order_item_image_snapshot.sql`，确认列出现，历史行为空串。
3. 迁移成功后部署当前 Java 和前端；**不能先发带字段的 Mapper 再迁移**。
4. 全新 MySQL 8 库使用 `docs/dev-ops/mysql/sql/00_r1_schema.sql` 和 `data.sql`，已经包含 `image_url`；两处 DDL 必须同步。
5. 业务建单测试上传图片、下单、换图、查看旧订单，确保快照不变；再执行并发库存/幂等核验。

## 5. 真正的验收门禁

- 浏览器真实交互与 HTTP 契约替身：`python scripts/build-ui-bundle.py && python frontend/tests/ui_sdd_integration.py`；纯 Java 读模型校验 `python scripts/verify-sdd-model.py`；这是本地 UI 证明，不是数据库验收。
- 静态源码：`python scripts/verify-source.py`。
- 正式环境：`mvn -B -ntp clean verify`，MySQL 专用测试库、`python scripts/smoke-full.py`，再补 API 实测截图和证据。
- 任何测试未运行必须标 `NOT_RUN`。无法验证真实 Spring/MySQL 时不得称“全栈修复已验收”。
