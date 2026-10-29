# SDD-05：商户自定义 RBAC、服务端全局排序与多主体验收

> 2026-10-28；基于现有 R1 + SDD-04 增量设计。**源码实现和受控浏览器验证不表示真实 Spring/MySQL 端到端验收通过。**

## 1. 目标与非目标

- 允许一个商户 Owner 在本商户创建、修改、删除**自定义角色**，指定可授予的业务权限，并把已接受邀请的成员分配给角色。
- 角色权限控制必须由 Java 在每次相关请求中以 `(当前 Session 用户, merchantId, permission)` 重新计算；浏览器返回的 `merchantPermissions` 仅用于界面显隐，不是可信授权凭据。
- 保留既有 `OWNER`、`CLERK`、平台 `PLATFORM_ADMIN` 和消费者身份；升级后无需修改原有账号或成员记录。不同商户的同名角色互不共享。
- 补全排序能力：商品支持 `NEWEST`、`PRICE_ASC`、`STOCK_DESC`。排序必须发生在 SQL 的 `LIMIT/OFFSET` **之前**，`total` 按相同筛选独立计数。
- 首版**不开放**商户自行授予 Owner/平台管理员身份、不创建通用资源表达式脚本、无角色继承/角色级资源行过滤。商户 ID 和文档/订单所有权由现有业务领域独立强校验。

## 2. 角色定义与最小授权原则

| 内置角色/身份 | 授权来源 | 权限及规则 | 能否在前端修改 |
|---|---|---|---|
| 消费者 | 当前登录账号 | 自己的订单、AI 会话、购物车；不属于商户 RBAC | 否 |
| `PLATFORM_ADMIN` | 仅受控初始化写入 `iam_platform_role` | 平台审核、监管及争议处理；不因商户角色获得 | 否 |
| `OWNER` | 商户审核开通授予，`iam_merchant_membership` | 15 项商户权限，含 `team.manage`、`store.manage`、`role.manage` | 内置只读；不能被自定义角色授予 |
| `CLERK` | 邀请默认角色 | `product.read`、`stock.read`、`stock.replenish`、`order.read`、`order.prepare`、`pickup.verify` | 内置只读 |
| 自定义角色 | 当前商户 Owner | 从其余 12 项权限中选择非空集合；可在商户内分配 | 可，按商户独立维护 |

**强制不开放自授权**：`team.manage`、`store.manage`、`role.manage` 不允许放入自定义角色。它们属于 Owner 专属的权限治理与成员授予边界。Owner 也不能通过成员改派接口新建另一个 Owner。

### 2.1 权限码与前端入口映射

| 权限码 | 管控操作/页面 | 说明 |
|---|---|---|
| `dashboard.read` | 经营统计 API | 同时需要 `order.read`，普通 `CLERK` 不含统计权限 |
| `product.read` | 商户商品列表、详情 | 区别于公开商品浏览 |
| `product.write` | 新建、编辑、上下架、改价、新增 SKU、上传商品图 | 同时需 `product.read` |
| `stock.read` | 库存列表、变动流水 | 不等于补货 |
| `stock.replenish` | 库存补货 | 同时需 `stock.read`，保留库存幂等与 SKU 所属商户校验 |
| `order.read` | 商户订单列表 | 不包含修改订单 |
| `order.prepare` | 开始备货、完成备货 | 同时需 `order.read`，保留订单归属与状态校验 |
| `pickup.verify` | 自提核销 | 同时需 `order.read`，保留令牌校验与库存事务 |
| `aftersale.read` | 售后列表 | 独立只读 |
| `aftersale.review` | 批准/驳回售后 | 同时需 `aftersale.read`，审核理由必填 |
| `knowledge.read` | 商户知识库列表、文档读取和本商户内部 RAG 资料可见性 | 文档权限还需按知识库商户/可见范围核验 |
| `knowledge.manage` | 知识库创建、上传、索引、发布与撤回 | 同时需 `knowledge.read` |
| `team.manage` | 邀请、撤销成员及成员列表（Owner 专属） | 自定义角色不可授予 |
| `store.manage` | 商户和门店资料修改（Owner 专属） | 自定义角色不可授予 |
| `role.manage` | 角色 CRUD、权限清单及成员角色改派（Owner 专属） | 自定义角色不可授予 |

### 2.2 权限检查位置

- `AccessServiceImpl.requirePermission()` 是统一服务端鉴权入口，依赖当前账号有效状态、当前商户成员 `ACTIVE` 状态、角色码及该商户的角色权限。未识别权限直接拒绝。
- `CatalogCaseImpl` 控制商品/库存；`OrderLifecycleCaseImpl` 控制订单备货/自提/售后；`AfterSaleController` 控制商户售后列表；`MerchantAdmissionCaseImpl` 控制商户资料；`KnowledgeCaseImpl` 控制内外部知识与引用。
- 角色 CRUD、授予/撤销、审计均在领域服务事务中；Repository 只做数据库 CRUD。角色 `merchant_id` 始终来自当前 URL 并经过用户成员校验，不能跨商户访问。
- 客户端的菜单、入口、表单按钮使用 `WorkspaceResponseDTO.merchantPermissions` 中的同名权限码；**隐藏按钮不能替代服务端鉴权**。仅有 `stock.read` 的角色可看库存流水、不能补货；平台知识库直达地址必须经过 `workspace.platformAdmin`，不能以 `/admin` 路径前缀作为权限事实。
- 成员撤销或角色权限修改影响下一次 HTTP 请求；正在运行的远程 AI 回复在返回前重新检查知识可见范围指纹。前端账号登出/切换清理私有视图。

## 3. 数据模型与迁移

新增 `iam_merchant_role (merchant_id,role_code,name,version,created_at)`，`(merchant_id,role_code)` 复合主键、`(merchant_id,name)` 唯一；新增 `iam_merchant_role_permission (merchant_id,role_code,permission)`，复合主键、外键关联角色。内置角色没有数据行，保留旧 `iam_merchant_membership.role VARCHAR(16)`；自定义 code 为 `R` 加 12 个 hex 字符。

- 新库：`campus-shopping-app/src/main/resources/schema.sql` 已包含新增 DDL。
- 已有库：**备份后一次性执行** `docs/database/migrations/V20261028_02__merchant_rbac.sql`，不会修改旧成员角色字段。
- 角色创建/修改需权限白名单，不能设置空角色；有 ACTIVE 成员的角色不能删除；成员改派锁目标成员和角色记录，不能更改 `OWNER`。
- 被撤销成员重新接受邀请时通过 `grantClerk` 强制恢复 `CLERK`，防止复活历史自定义授权。
- 所有权限治理操作写入 `sys_audit`；权限变更不能绕过平台角色、知识可见性或交易事务。

## 4. 新增 HTTP 契约

均位于 `/api/v1/merchants/{merchantId}/rbac`，需要当前有效 Session。HTTP `200 + code != 0000` 表示领域失败，POST/PUT/DELETE 仍要求 CSRF。

| Method | Path | 返回/入参 | 所需权限 |
|---|---|---|---|
| GET | `/permissions` | `[{code,label,grantable}]` | `role.manage` |
| GET | `/roles` | `[{code,name,builtin,permissions}]` | `role.manage` |
| POST | `/roles` | `{name,permissions}` → Role | `role.manage` |
| PUT | `/roles/{code}` | `{name,permissions}` → Role | `role.manage` |
| DELETE | `/roles/{code}` | 空响应；有活跃成员拒绝 | `role.manage` |
| PUT | `/members/{userId}/role` | `{roleCode}`；禁止改 `OWNER` | `role.manage` |

`GET /workspace` 增加 `merchantPermissions`：`{merchantId: [permissionCode, ...]}`。该字段是当前登录用户跨商户各自的授权**快照**，不允许提交给服务端充当身份。成员关系 `role` 字段可包含 `Rxxxxxxxxxxxx`，必须由 `/rbac/roles` 获取展示名称。上述新路由已纳入自动生成的 OpenAPI/路由索引（总计 93）。

## 5. 全局排序契约

`GET /products/page` 与 `GET /merchants/{mid}/products/page` 增加可选 `sort=NEWEST|PRICE_ASC|STOCK_DESC`，缺省 `NEWEST`。其它字符串返回参数错误；条件筛选与 COUNT 不因排序改变。价格按每商品**有效 SKU 的最低单价**排序，库存按**有效 SKU 可售数量之和**降序；并列时以 `productId` 固定次序；无有效 SKU 的商品在价格升序时排最后。前端展示最低有效规格价，与数据库口径一致。

业务量变大时，相关子查询可能成为性能热点；应基于真实 `EXPLAIN ANALYZE` 和数据量评估物化统计/索引，不预先引入聚合冗余表。**不改变库存扣减的事务边界**。

## 6. 验收边界和不变量

- 自定义角色创建/编辑/成员改派；恶意提交 `role.manage`、`OWNER`、跨商户角色码必须被 Java 拒绝。
- m1/m2 自定义角色、权限不能串读；非 Owner 刷新 `/rbac` 入口直接拒绝；已撤销成员再次邀请不能继承旧角色。
- `knowledge.read` 与 `knowledge.manage` 区分；RAG 内部资料严格按当前用户的商户授权过滤，AI 会话按当前用户 ID 匹配；前端注销/切换主体后不能显示历史私有回答。
- 库存、订单、售后状态仍受原领域业务不变量约束；角色授权不是订单归属检查的替代。
- `PRICE_ASC`、`STOCK_DESC` 实现为数据库全局排序再分页，页 2 承接第 21 个商品而非本页重排；MySQL 专用 `catalogGlobalSortOrdersEntireResultBeforePaging` 测试已提交，尚未在本地执行。
- 本地可运行 Chromium 接口替身与静态规则检查；**必须在 JDK17 + Maven + MySQL8 + Spring Boot 环境实际运行新增的 `MerchantRbacMySqlIntegrationTest` 和全套 E2E**，才能标记生产验收通过。
