# API 行为契约 v1.1（当前版本）

### 商户订单待办筛选（M4.1）

`GET /api/v1/merchants/{merchantId}/orders/page` 保留订单 `state` 筛选，并支持可选的 `pickupState`：`WAIT_PREP`（待备货）、`PREPARING`（备货中）、`READY`（待自提）或 `COMPLETED`（已核销）。服务端在同一商户权限范围内按 `ful_pickup_task.status` 过滤，并对 `items` 与 `total` 使用相同条件；不把客户端已加载页面的局部筛选当作待办总数。备货、备货完成或核销成功后，调用方应保留原筛选与搜索条件并刷新当前有效页。

> 适用范围：`campus-shopping` R1 及截至 2026-10-30 的 SDD 增量。HTTP 路由、字段名和 DTO 结构以[自动生成路由表](http-api.md)及[OpenAPI](openapi.json)为准；本文件补充静态提取无法准确表达的授权、数据语义与业务不变量。**源码已实现不等于真实联调通过**。

## 1. 优先级与来源

1. 当前源码中的 `Controller`、`Request/Response DTO`、`SessionSecurityConfig` 和领域校验是当前实现事实。
2. `scripts/generate-api-contract.py` 生成 `route-manifest.json`、`openapi.json`、`http-api.md`，不可手工追加路由。`scripts/verify-api-contract.py` 在 CI 复验安全白名单、路由集合、DTO 字段和查询/统计一致性。
3. 本文件定义跨接口业务语义；`docs/domains/` 解释领域模型。旧 P1 草案、旧前端模板和示例脚本不能覆盖 v1.1 的路径/语义。重大改变先修改 SDD，再修改代码并重新生成契约。

## 2. HTTP、身份与 CSRF

| 情况 | HTTP 状态 | `Response.code` | 行为 |
|---|---|---|---|
| 业务正常 | 200 | `0000` | `data` 为接口指定类型；`Void` 可无内容 |
| 领域校验/权限失败（请求已进入 Controller） | 通常 200 | 非 `0000` | 按业务码处理，不能只判断 HTTP 200 |
| 未登录访问私有接口 | 401 | `A0004` | 不允许跳转到 HTML 登录页 |
| CSRF 无效 | 403 | `A0005` | 前端重新获得有效 token 后再提交；不要无限自动重试 |
| 已登录用户缺少 ACL（Controller/Case） | 通常 200 | `A0006` | 账号身份与领域角色分别检查 |
| Spring Security 拒绝其他访问 | 403 | `A0006` | 没有资格访问该接口 |
| JSON 解析/参数类型绑定失败 | 400 | `0002` | 固定安全提示，不回显请求正文或解析器详情 |
| 不存在的 API 路由 | 404 | `G0001` | 私有路径仍先检查登录；已有业务资源不存在仍可为 200/G0001 |
| HTTP 方法不支持 | 405 | `G0005` | `Allow` 返回支持的方法 |
| Accept 不支持 | 406 | `G0007` | 错误响应统一为 JSON |
| 请求体超过 3,000,000 字节 | 413 | `G0004` | 有 Content-Length 与分块传输使用同一边界 |
| 正文媒体类型不支持 | 415 | `G0006` | JSON 请求使用 application/json |
| 登录/注册入口限流 | 429 | `A0007` | `Retry-After` 为当前窗口剩余秒数；登录 30 次/60 秒，注册 10 次/300 秒，按直连 IP 与入口分别统计 |
| 账号状态检查服务不可用 | 503 | `0001` | 失败关闭，不放过未经实时复验的身份 |

MVC 协议错误由 `ApiProtocolExceptionResolver` 明确匹配框架异常；业务 `AppException` 及普通运行异常不在其处理范围。保留 Controller 内业务捕获和 Case 事务回滚方式，没有全局业务异常处理器。代理/网关或容器在请求进入应用过滤器之前产生的错误不由这个契约保证 JSON 格式。

JSON 中金额、数量、版本必须为整数，禁止把 `1.5` 静默变成 `1`；额外的尾随 JSON 值也返回 400。继续兼容忽略未知属性，附加 `applicantUserId`、`role` 等字段不会改变可信身份或权限。调用方应使用 JSON 数字；当前 Jackson 仍兼容可转换的整数字符串。上传文件使用标准 Base64，解码后限 1–2,000,000 字节；请求正文（包括编码及 JSON 外壳）限 3,000,000 字节。

HTTP 200 的机器响应契约区分 `code=0000` 的成功和非零业务失败；失败的 `data` 为 null，不能强制套成功 DTO。成功 DTO 的必填字段及 null 规则由 `scripts/api_response_rules.py` 显式维护；仅契约声明的可选快照允许 null，禁止把全部引用字段改为可缺失或可空。Java→Python 的内部请求固定使用 HTTP/1.1，避免 Uvicorn 不支持的 h2c 升级；文件提取服务明确返回 400/413/415/422 时转为 `AI0004`，依赖故障仍为 `AI0001`。

前端同源发送 `JSESSIONID` Cookie，使用 `GET /api/v1/auth/csrf` 的 `data.headerName` + `data.token` 发起 `POST/PUT/PATCH/DELETE`。注册与登录同样需要 CSRF；登录和退出会刷新 Session/令牌状态。登录后重新调用 CSRF 接口，不复用匿名会话的旧令牌。生产环境需要 HTTPS、合适的 Secure Cookie 配置，不可把浏览器端指定的用户 ID 当成可信身份。

**匿名可访问**：`GET /auth/csrf`、`GET /categories`、`GET /products`、`GET /products/page`、`GET /products/{productId}`、`GET /merchants/public`、`GET /merchants/public/page`、`GET /merchants/public/{merchantId}`，以及匿名状态的 `POST /auth/login`、`POST /auth/register`（含 CSRF）。其他 `/api/v1/**` 要求 Session；平台管理端还要服务端平台管理员身份，商户写操作还要当前商户成员角色。商户公开详情只返回营业中商户。

`/media/**` 静态图片允许 GET，但上传图片必须验证商户写权限。所有 `/admin/**` 与 `/merchants/{merchantId}/**` 私有操作禁止只凭客户端选择的 merchantId 授权。

## 3. 分页与服务端搜索

分页请求参数 `page` 从 1 开始，`size` 范围 1–100（默认以生成路由表为准）。新版 `/page` 响应：

```json
{"code":"0000","info":"成功","data":{"items":[],"page":1,"size":20,"total":0,"hasNext":false}}
```

会话 `GET /ai/conversations` 与邀请 `GET /invitations` 保留 `List<T>` 响应，支持 `page=1`、`size=100` 默认值，范围同上；会话按最近一次成功保存消息的 `lastActiveAt DESC,id ASC` 稳定排序，邀请按既有创建时间规则排序。会话没有消息时 `lastActiveAt` 使用创建时间，`summary` 只展示用户自己的问题摘要并遵守长度限制。前端每次取 20 条并提供继续加载/翻页；返回少于 size 条表示末页，满页后允许下一页为空。这两个接口不提供 total。页码最大 10000，越界返回 `0002`。

`total` 必须是与当前 `state`、`status`、`category`、`merchantId`、`q` **同一过滤条件**下的数据库 `COUNT`，不能使用当前页 `items.length`。`hasNext` 基于 `page*size<total`。查询过滤在 SQL 分页之前生效，列表与 COUNT 保持等价条件。旧 `List<T>` 路由保留兼容；已提供 `/page` 的列表由新前端优先使用 `/page`。

库存查询的 `availableBelow` 表示 `onHand-reserved <= availableBelow`，边界包含等号；`onHand`、`reserved` 和 `available` 仍由服务端库存事实计算，筛选只读不改库存。库存流水分页的 `q` 仅定位当前商户的 `skuId` 或 `bizKey`，列表与 COUNT 使用相同条件并按 `created_at DESC,id ASC` 稳定排序。

当前支持 `q` 的长列表：平台商户、平台入驻申请、商户/平台订单、商户商品、商户库存、平台/公共商品。其余没有声明 `q` 的接口不能在 UI 中声称“跨所有页全文搜索”。`q` 为可选关键字，采用字面子串搜索，而不是让用户传入 SQL 通配符。建议在前端搜索时防抖，旧请求返回不得覆盖新一轮查询。

**SDD-04 商品搜索语义**：公共商品 `/products/page` 和平台商品 `/admin/products/page` 的 `q` 搜索商品标题、描述、商户名称、SKU ID、规格；商户自身 `/merchants/{mid}/products/page` 搜索商品标题、描述、SKU ID、规格。公开搜索仅从有效 SKU 参与匹配，匹配多规格仍只返回一条商品记录。`%` 和 `_` 在这些商品接口中均按普通字符字面查找。商品列表/COUNT 的动态筛选必须保持一致。

**商品价格筛选**：`GET /products` 与 `GET /products/page` 支持可选 `minPriceCent`/`maxPriceCent`（整数分，闭区间）。条件在 LIMIT/OFFSET 前与 `q`、`category`、`merchantId`、`sort` 一起作用于完整公开结果；商品至少有一个当前 `ACTIVE` SKU 的价格命中才返回。负数、非整数或下限大于上限返回参数错误，不静默截断或退回无条件结果。卡片展示命中区间的最低有效 SKU 价格。

**门店公开资料**：`GET /merchants/public/{merchantId}` 仅返回营业中商户，包含门店介绍、营业时段和门店图片。未填写字段为空字符串，页面显示“未填写”。营业时段是商户维护的展示文本，固定按北京时间（Asia/Shanghai）解释，不因浏览者设备时区改变，也不替代服务端经营资格判断。门店图片只能引用本商户通过 `POST /merchants/{merchantId}/store/images`（需要 `store.manage`）按 `STORE` 用途上传的对象；保存资料时再次核验对象归属，跨商户、商品用途或未登记 URL 返回 `A0006`。旧客户端未提交新字段时保留原值，显式空串才清空。

**订单自提快照**：新订单在下单事务内从锁定门店保存 `pickupStoreName`/`pickupLocation`；响应字段为空表示历史订单未记录，客户端不得用当前门店资料回填。商户后续修改门店资料不影响历史订单快照。

**履约与售后事件**：订单创建、付款、备货、备货完成、核销、取消/过期及售后阶段在对应成功事务内追加到 `trd_order_event`，按订单和业务去重键保证幂等重放不产生重复记录；事务回滚不留下成功事件。订单详情只投影已记录事件，未发生阶段不显示为完成。平台驳回后买家可再次介入，`REFUND_DISPUTED`/`PLATFORM_REJECTED` 按售后轮次生成去重键，后续真实决定不会被忽略。商户售后历程通过 `GET /merchants/{merchantId}/orders/{orderId}/after-sale-history` 读取，只要求 `aftersale.read`，不扩大到订单详情；已处理售后仍可按该授权读取历史，裁决按钮只在实际可处理状态显示。

**SDD-05 全局排序**：`GET /products/page` 与 `GET /merchants/{mid}/products/page` 支持 `sort=NEWEST|PRICE_ASC|STOCK_DESC`（默认 `NEWEST`），由 MySQL 在 LIMIT/OFFSET 前统一排序；`PRICE_ASC` 使用商品有效 SKU 最低价，`STOCK_DESC` 使用所有有效 SKU 的可售库存总和。前端“全局价格/库存”发送相同枚举，不再只对本页本地排序；COUNT 的过滤条件不变。无效 sort 返回参数错误。见 [SDD-05](../specs/SDD-RBAC-05.md)。

### 3.1 SDD-05 商户 RBAC 权限与角色管理

默认 `OWNER`（15 项商户权限）和 `CLERK`（商品只读、库存读/补货、订单读/备货、自提核销）保持不变。商户 Owner 可创建非空权限集合的自定义角色、编辑权限、删除无 ACTIVE 成员的角色，并为已加入商户的非 Owner 成员改派角色。`team.manage`、`store.manage`、`role.manage` 为 Owner 专属，禁止授予自定义角色；不能通过角色改派创建 Owner 或 PLATFORM_ADMIN。详情见 [SDD-05 权限矩阵](../specs/SDD-RBAC-05.md)。

同一商户自定义角色重名（以数据库排序规则为准）返回 200/`M0006`；创建或改名失败整笔回滚，既有权限和审计记录不变。不同商户允许同名。只翻译 `uk_merchant_role_name` 冲突，其他 SQL 错误不冒充重名。

`GET /workspace` 添加 `merchantPermissions: {merchantId: [permissionCode]}` 供当前前端菜单与操作按钮显示；浏览器权限只是展示快照，后端每次从当前 Session 身份、商户成员状态及数据库角色权限复权。新增 6 条 `/merchants/{merchantId}/rbac/` 路由，统一要求 Owner、CSRF 写保护及商户范围约束。`knowledge.read`、`knowledge.manage` 分离，AI 的商户内部知识可见性不能由前端宣称权限。

## 4. 业务写操作与请求键

| 业务 | 当前接口 | 校验重点 |
|---|---|---|
| 入驻申请 | `POST /merchant-applications` | 申请者由 Session 决定；`Idempotency-Key` 业务必填，最长 64 字符，同主体同键同请求返回原申请 |
| 库存补货 | `POST /merchants/{mid}/stocks/{skuId}/replenish` | 商户成员授权；数量有效；`Idempotency-Key` 必填，最长 64 字符；重放不重复增库存 |
| 订单创建 | `POST /orders` | 只允许单一商户；每行 `skuId,quantity,expectedPriceCent,expectedVersion` 由 Java 复查；`Idempotency-Key` 必填，最长 64 字符，重放不重复预占 |
| 商品编辑与规格 | `/merchants/{mid}/products` 及 `/skus` 子路由 | 多 SKU 唯一、报价版本与当前用户权限由 Java 决定；有序图片地址由 Java 复验 |
| 模拟支付/备货/自提 | `/orders/{id}/pay`、商户 `/orders/{id}/prepare|ready|verify` | 根据状态机校验、重复操作幂等，核销凭证有时效与单次消费约束 |
| AI 推荐提案确认 | `POST /ai/proposals/{proposalId}/confirm` | AI 输出不是业务执行凭据；Java 在确认时复查所有权、失效时间、SKU、价格、库存 |

Controller 的 `@RequestHeader(required=false)` 是为了在领域层返回统一业务码，**不表示业务键可省略**。请求键不可复用在不同 payload 上。所有金额以整数分 `priceCent/totalCent` 传输，不依赖浏览器浮点数计算为准。

### 4.1 SDD-09 字段契约

OpenAPI 的字段类型从 DTO 提取，`required`、长度、范围和枚举由 `scripts/api_contract_rules.py` 显式维护并标明领域来源；新增请求 DTO 或字段缺少规则时生成失败。约束针对规范化后的有效输入，运行时以 Java Domain/Case 为准；Java 长度按 UTF-16 单元计算，注册密码另限 UTF-8 72 字节。账户名先 trim/转小写，4–32 位；昵称 1–50，入驻联系人 1–50，类目编码 1–32、名称 1–50。当前导购 UI 主动限制 500 字，API 允许 2000 字。

共享 DTO 的约束按具体操作补充：商品创建必填 1–20 个 SKU，编辑必填 `expectedVersion`；入驻审核仅驳回时必填原因，退款同意与驳回均必填；知识库可见性须与平台/商户范围匹配。请求中的 null SKU、null 权限或缺失可见性属于业务参数错误，不能降成 `0001` 系统错误。

## 5. 图片、引用与 AI 模式

- 商品创建/编辑支持 0–8 张不重复的服务端稳定引用（旧 `/media/{object}.png` 或 `/media/qiniu/{小写UUID}.png`）；商品响应的 `images` 按顺序返回，兼容字段 `imageUrl` 为首图或空串；上传成功响应必须包含非 null 的 `url`。商品记录与图片引用在同库事务内更新。
- 图片字段兼容：创建时 `imageUrls` 缺失或为 null 沿用旧 `imageUrl`，显式 `[]` 创建空相册；编辑时 `imageUrls` 非 null 优先且 `[]` 清空，`imageUrls` 为 null 时 `imageUrl` 也为 null 表示不改图片，与当前主图相同保留相册，空串或全空白字符串清空，其他有效地址替换首图并保留原副图，已在相册则升首位保留全部（不重复、最多 8 张）。
- 前端逐文件上传：合法文件成功即保留在表单（部分成功不丢），失败项按文件名/原因列出并可单项重试或移除；非法类型、空文件、超 2,000,000 字节不发请求且重试仍校验；同一批 `name+size+type` 重复只上传一次，不是内容哈希去重；未解决失败或重挂载 `invalid` 兜底继续阻断保存，显式放弃保留已成功图片，迟到结果按商户/商品/身份/路由/卸载隔离。
- `CartResponseDTO.merchantName` 从 `mer_merchant` 查出后返回；`imageUrl` 从当前公开商品数据读取。
- `ProposalItemResponseDTO` 的 `imageUrl`、价格、版本和数量是生成提案时可信 Catalog 快照；新提案同时保存可信 `productId`。历史 `items_json` 缺少商品身份时，服务端按 SKU 批量恢复当前公开关联，无法恢复或商品不可访问时返回 `detailAvailable=false` 和安全原因，保留历史快照且不伪造空 ID；过期提案仍拒绝执行。
- `OrderItemResponseDTO.imageUrl` 是**下单时**写入 `trd_order_item.image_url` 的快照；旧订单缺图使用占位图片，不能反查当前商品图代替历史图。升级数据库前执行 `docs/database/migrations/V20261028_01__order_item_image_snapshot.sql`。
- `POST /ai/chat` 首版返回完整 JSON，**不支持 SSE 流式 token**。未配置真实模型时，响应 `mode` 必须正确标识本地检索/降级；禁止用演示结果宣称真实模型评测通过。知识库有发布状态与权限范围，外部引用只显示可授权的信息。
- `GET /ai/conversations/{conversationId}/messages` 的助手消息包含 `citations` 与 `citationStatus`。新消息只保存文档根/版本、证据定位和允许公开的片段，读取时按当前授权、发布/索引状态、版本和正文一致性复验；`AVAILABLE` 表示仍可展示，`HIDDEN` 表示回答或来源已被当前规则遮蔽，`MISSING` 表示旧消息没有保存引用记录，`NONE` 表示该消息没有引用。旧消息不会重新检索或拼接内部文档地址。

知识库列表返回完整的授权元数据，授权判断不再先截取 1000 个知识库。单次知识检索白名单最多 1000 份当前 PUBLISHED + READY + 根活动版本文档；Java 查询额外检测超限，超过上限返回 `AI0005`，不调用模型、不保存本轮回答/提案。Python 对超过 1000 个 ID 的内部请求返回 422，直接检索调用也拒绝超限，不静默切片；1000 个 ID 的 SQLite 查询分批执行。历史消息接口是最近 100 条的上下文窗口，提案列表是最近 20 条；二者不承诺完整导出。

中文与阿拉伯数字的明确预算/数量由 Python 规则校验总价与库存；含糊金额或数量、数量超出 1–99 时要求澄清并返回空建议。明确的继续/替换追问沿用最近用户需求的预算和数量，当前消息中的明确约束优先；检索改写和模型不能覆盖该约束。Java 仍在提案生成/确认时独立复核当前商品、库存、权限和报价。

### 5.1 QINIU 稳定引用与媒体解析（2026-11-05）

- 图片字段接受旧 `/media/{object}.png` 与服务端生成的 `/media/qiniu/{小写UUID}.png`；可选 `imageUrl` 允许全空白表示清空（与 IMG 编辑兼容一致，合法地址不做 trim），`imageUrls` 数组元素不得为空白，绝对外链、大写 UUID、带 query 或编码绕路返回 `0002`。
- 上传成功时 `data.url` 为稳定相对引用；图像内容非法（字节超限、像素超限、无法识别的图片）返回 `UPLOAD_INVALID`（`AI0004`）；引用格式非法返回 `0002`；对象存储、回执不匹配或登记失败返回 `UN_ERROR`（`0001`）；引用未登记、已属其他商品或越权返回 `A0006`；未登录、CSRF 或商户写权限不足仍沿第 2 节原契约。失败不返回可认领 URL、不 fallback 到 LOCAL；商品保存事务只在本库认领对象与写引用，不访问云端。
- `GET /media/qiniu/{uuid}.png` 是 `/api/v1` JSON 业务 API 之外的页面资产入口（不进 OpenAPI 业务路由表）：合法引用返回 **302** + `Location` + `Cache-Control: no-store`；非法引用 **404**；七牛读取能力未配置或运行故障 **503**（与上传 provider 选择无关）。三者都不返回 JSON `Response` 体。
- `Location` 只由服务端配置构建：HTTPS + 纯 DNS 下载 host；私有桶默认签名 300 秒（30–3600），公开桶不带签名。302 必然把签名交给浏览器，但签名不作为业务 DTO 稳定引用持久化，也不写入日志。
- 上传配置要求：七牛字段全空且 `provider=LOCAL` 时离线；`provider=QINIU` 时 access-key/secret-key/bucket/download-domain 与 **region** 均必填，region 只接受 `z0`/`z1`/`z2`/`na0`/`as0`/`cn-east-2`，`auto` 或留空启动失败（不猜 bucket 区）；access-key 只允许 `[A-Za-z0-9_-]`。
- 旧 `/media/{object}.png` 继续由静态资源路由提供，状态与缓存语义不变，历史地址不会被改写为云地址。

## 6. 前端、CI 与验收证据

- 前端当前 Vue 源码在 `frontend/src/`，同源预编译产物在 `campus-shopping-app/src/main/resources/static/`。旧 `static/assets/app.js` 只作为 legacy 兼容入口。
- 浏览器视觉测试（`?demo=1` 或测试替身）只能证明 UI 和请求构造，不证明 Java/MySQL 实际响应正确。
- **SDD-04 前端上下文**：消费者登录/退出会使旧请求失效并重新加载公开商品；商户切换和从商户端返回购物端时，旧商户请求不得写回新视图；商户知识库页面在后端主体授权的基础上仅展示当前选中商户的知识库；非 Owner 仅展示有权访问的管理菜单。
- **退款审批**：商户和平台的同意/驳回都必须提交非空审核说明，前端禁用空白理由的提交控件；服务端始终独立校验。
- 真实验收链路：`mvn -B -ntp clean verify` → Spring Boot + MySQL 服务 → `python scripts/smoke-full.py` → `python frontend/tests/live_ui.py`，输出只在这些命令真正执行后记为 `PASS`；缺少依赖/环境时标为 `NOT_RUN`。
- 契约门禁：`python scripts/verify-api-contract.py`。CI 因旧选择器报错不能视为后端功能失败；本项目必须使用新版 Vue 的选择器。
- Schema 门禁：`python scripts/verify-api-schemas.py`（测试依赖见 `ai-service/requirements-dev.txt`）；真实 HTTP 可用 `python scripts/smoke-full.py --check-contract` 逐条核对实际响应与 OpenAPI，证据记录核对数量和规格 SHA-256。

## 7. 常见业务码

`0002` 参数非法，`A0004` 未登录，`A0005` CSRF 无效，`A0006` 权限不足，`G0003` 幂等键冲突，`C0002` 商品报价变化，`I0001` 库存不足，`T0001` 订单状态冲突，`AI0002` AI 提案已过期。完整码表见 [错误码](error-codes.md) 和 Java `ResponseCode`。

## 退款审核与商户状态重试（2026-10-31）

- 商户首次审核只处理 `REQUESTED`，`DISPUTED` 的商户审核返回 `AUTH_FORBIDDEN`；同一申请重复驳回不改写说明、不重复记审计。
- 平台首次裁决只能处理 `DISPUTED`；直接裁决 `REQUESTED` 或未申诉的 `REJECTED` 返回 `REFUND_STATE_INVALID`（`T0004`）。平台驳回后重试仍返回 `T0004`，不产生额外副作用；买家可以沿既有规则再次申诉。
- 已 `APPROVED` 且订单 `REFUNDED` 的同意请求继续成功重放；订单锁、售后锁和同事务退款/库存/履约/审计保证不重复执行。
- 商户重复停用/恢复在商户行锁内判断目标状态；无状态变化时不更新 version、不新增状态审计，鉴权和原因校验仍执行。

## AI与入驻查询的边界错误（2026-10-31）

内部AI返回HTTP成功但JSON为null、提取文本缺失/空白/超过100000字符、空正文或无法反序列化时，网关返回既有AI_UNAVAILABLE（AI0001），不记录响应正文。提取服务明确以400/413/415/422拒绝用户文件时，继续使用UPLOAD_INVALID（AI0004）。

平台入驻列表/分页的state未指定或空白时不过滤；非空值按MerchantApplicationStatusEnumVO统一校验，列表与count均使用同一规则，非法值返回ILLEGAL_PARAMETER（0002）。有效状态仍为SUBMITTED/APPROVED/REJECTED，首尾空白按既有EnumValues规范去除。


## 购物车库存与 SKU 状态补充（2026-11-01）

- `sellable` 表示商户 ACTIVE、商品 PUBLISHED、SKU ACTIVE 且可用库存大于零，数量是否足够另比较 available。已上架商品允许售罄。
- 普通新增/增加和 AI 确认均检查购物车最终累计数量不超过当前可用库存，否则返回 I0001。加购不预占库存；Checkout 继续在 MySQL 短事务内复验与原子预占。
- 已有行缺货、下架或商户停用时仍展示，可减少、保持原数量或删除，增加必须重新校验。购物车当前数量使用 FOR UPDATE 当前读。
- `PUT /api/v1/merchants/{merchantId}/products/{productId}/skus/{skuId}/status` 请求必填 active、expectedVersion（商品版本，非 SKU 版本）。实时校验本商户 product.write 与商品归属；启用还需商户 ACTIVE，停业允许停用。
- 相同 SKU 目标状态重放不增加商品/SKU 版本，即使原请求版本已过期；不同目标需匹配商品版本，否则 G0002。已上架商品不能停用最后一个 ACTIVE SKU（C0001），需先整体下架。未知 SKU 返回 G0001。状态改变增加商品和该 SKU 版本，沿用既有报价失效和缓存失效机制；历史订单快照不改变。


## PR #45 审查补充：报价锁序与原子增量加购（2026-11-01）

- 所有锁定报价共用仓储适配器路径：非锁定投影仅解析不可变的 SKU→Product 归属；先按 Product ID 锁完全部商品，再按 SKU ID 逐一当前读加锁，最后由用例按稳定 SKU 顺序锁库存。交易价格、状态、版本取锁内事实，不能取早期 REPEATABLE READ 快照。联表展示查询不再提供 FOR UPDATE 选项。
- `POST /api/v1/cart` 请求必填 skuId、quantity（1～99），quantity 表示本次增加数量。服务端先锁购物车，在锁内累计并校验最终数量不超过 99 和当前可用库存；库存不足 I0001，超过数量上限 T0005，整次写入回滚，不预占库存。普通首页和详情页均使用该增量操作。
- `PUT /api/v1/cart` 继续设置绝对目标数量；并发设置按服务端锁内执行顺序生效，不能解释为累加。POST 并发请求各累计一次；POST 不提供请求幂等重放，网络结果不明时先刷新购物车，不自动重试增量。
- 可控 MySQL 用例将写操作暂停于已锁 Product、尚未锁 SKU 时，让结算/加购进入真实锁等待，再用第三个事务 NOWAIT 探测 SKU，断言等待 Product 的消费者没有抢先占用 SKU。测试覆盖平台下架、SKU 停用与结算/普通增量加购组合；随机竞争仅作补充。
