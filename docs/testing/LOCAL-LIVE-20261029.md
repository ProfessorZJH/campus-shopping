# 本地真实导购、交易与浏览器验收（2026-10-29）

**本地 Spring/MySQL、NVIDIA/Milvus/讯飞导购以及真实 Chromium 购物闭环已通过本报告列明的验收。** 业务数据通过 Java API 或页面操作产生；没有使用接口、模型或向量库替身，没有开启 `demo=1`。资金行为仍为系统自带的模拟支付、模拟退款。

[脱敏汇总](evidence/local-live/summary.json) · [凭据与产物检查](evidence/local-live/hygiene.json)。本轮检查的 13 个私有长凭据/标记在非忽略文件中精确匹配数为 0；26 个前端源码/静态文件与运行 JAR 一致。短密码不适合全仓字面匹配，未将其扫描结果作为安全证明。

## 环境与数据库处理

| 项目 | 实际使用 |
| --- | --- |
| 页面与 Java API | `http://127.0.0.1:8091/#/`，同源 Spring Boot 3.4.3 |
| MySQL | 本机 `127.0.0.1:3306/campus_shopping`，8.0.31；使用用户指定的现有库 |
| Java / Python | JDK 17.0.12 / Python 3.11.9 |
| 浏览器 | Playwright 驱动真实 Chromium 136.0.7103.25，无 API 路由替身 |
| Embedding / LLM | NVIDIA `nvidia/nemotron-3.5-embed-1b` / 讯飞 `spark-x2.6` |
| 商品语义索引 | 用户现有 Milvus；Java 定时任务同步真实 MySQL 商品，随后直接查到目标商品 ID 与模型标识 |
| 知识检索 | 真实 NVIDIA 向量 + 本地持久化 SQLite；本轮未启用 Qdrant |

按用户“可以清除表并重跑 SQL”的明确授权，先备份，再仅清除 `campus_shopping` 的 34 张原有表，执行应用的 `schema.sql` 与 `data.sql`。未修改其他数据库。备份保存在 Git 忽略的 `var/local-live/`，见[重建摘要](evidence/local-live/database-reset-summary.json)。

重建期间工作区又更新了数据库脚本；停服核对后，备份当时的验收数据，执行 `V20261029_01__contract_integrity_and_indexes.sql`。三项历史脏数据检查均为 0，补齐 7 个索引、3 个 CHECK 约束，没有修改业务行。见[迁移记录](evidence/local-live/latest-migration.json)、[迁移前元数据](evidence/local-live/schema-before-latest-migration.json)与[迁移后元数据](evidence/local-live/schema-readback.json)。没有为本轮配置隔离测试库。

Milvus 继续使用用户指定的现有 HTTP 连接，`encrypted=false`。本地验收启动器通过显式参数、主机名匹配和回环绑定启用传输例外；正常 `app.main` 的公网 HTTP 拒绝策略不变。本轮 Java 同步任务已经向商品集合写入明确标记的真实验收商品，数据保留供本地预览；此前 AI 子系统报告中的“未写正式商品集合”仅描述此前那次运行。

## 实际结果

以下数量分别表示各脚本自己的请求检查、业务断言或页面检查，不能相加解释为接口覆盖率。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 最新源码 Maven `verify` | 63 通过、29 跳过，0 失败/错误；生成新的可执行 JAR | [Maven 与产物摘要](evidence/local-live/maven-latest.json) |
| Python 回归（超时修正后） | 40 通过 | [JUnit XML](evidence/local-live/ai-after-timeout.xml) |
| 真实 Java/MySQL 完整 HTTP | 173 项通过；最新 JAR 启动后复跑 | [完整 HTTP](evidence/local-live/full-http.json) |
| 严格真实 AI 与事务检查 | 19 项通过，三次提问均要求 `mode=LLM` | [导购事务](evidence/local-live/shopping-api.json) |
| Chromium 基础登录与访问边界 | 8 项通过；最新 JAR 复跑 | [基础浏览器](evidence/frontend-live/results.json) |
| 商户页面上传、双 SKU、补货、上架 | 5 项通过 | [商品页面](evidence/local-live/browser/product.json) |
| 页面导购、确认、交易、自提、退款 | 12 项通过；最新 JAR | [页面闭环](evidence/local-live/browser/flow.json) |
| 28 条路由、角色操作、移动端与错误检查 | 40 项通过；最新 JAR | [路由与权限](evidence/local-live/browser/pages.json) |
| 页面操作后的只读 MySQL 核对 | 8 项通过 | [数据库结果](evidence/local-live/database-readback.json) |

严格 AI 事务检查先于最新 Java 重打包完成；其后导购 Case 源码没有修改。最新包重新执行了完整 HTTP、基础浏览器、真实模型页面闭环及角色权限检查。完整 HTTP 脚本允许模型显式降级，**单凭该脚本不能证明 LLM 成功**；本次真实模型证据来自要求 `LLM` 的严格检查和页面闭环。

最终核对了前端源码、静态资源与 JAR 内文件；部署内容一致。各阶段真实浏览器均没有未捕获 JS 异常或 HTTP 5xx。页面路由通过表示对应身份可加载页面；未声称每一页的所有操作组合都穷尽测试。

## 真实闭环与落库结果

商户通过页面上传主图、创建“真实联调无糖乌龙茶”，设置 500ml 为 6 元/瓶、库存 50；另一个 4 元规格只有 1 瓶，用于检查“两瓶”需求不能误选库存不足的便宜规格。公开自提规则和商户内部资料经 Java 知识接口真实索引、发布。

消费者在页面输入“预算20元买两瓶真实联调无糖乌龙茶，几点自提？”。真实模型返回 6 元/瓶、两瓶共 12 元，说明 09:00–21:00 在图书馆一层自提，并引用该商户的公开自提文档。响应为 `mode=LLM`、`retrievalMode=REMOTE_EMBEDDING`，没有内部资料引用或内部标记泄漏。

随后在页面确认提案，购物车为 2 件；提交订单、模拟支付，商户开始备货、备货完成，消费者领取凭证，商户核销。第二笔订单通过消费者页面申请退款、商户售后页面批准退款。

| MySQL 核对项 | 实际结果 |
| --- | --- |
| 订单 `1b9f0eb7-b6a9-4033-9d6e-f0c4a28d2b05` | `COMPLETED`，1200 分，2 瓶 |
| 订单 `3b15f8cb-c587-4e50-af3a-fd466c536a49` | `REFUNDED`，600 分，1 瓶 |
| 付款/退款 | 两笔模拟付款各有记录；退款订单仅一笔 600 分退款 |
| 订单商品快照 | 两笔订单均保存实际上传图片和 600 分单价 |
| 库存 | `on_hand=48`、`reserved=0`；完成订单消耗 2，未提货退款释放预占 |
| 履约 | 完成订单恰有一次核销；退款订单没有核销 |
| 提案和购物车 | 页面提案 `CONFIRMED`，结算后消费者购物车为空 |

严格 API 检查还验证：其他用户不能确认提案；相同确认不会重复加量；模型回答后发生改价、库存全部被预占或商品下架时，Java 分别返回预期业务拒绝，购物车行和数量不变。

角色页面实际创建自定义角色、授予商品管理、分配店员；店员重新加载后可以新增商品，但仍无法管理角色。移除商品管理权限后按钮禁用；最终恢复为内置店员并删除临时角色。消费者无法进入平台审核页。390×844 下消费者、商户、平台页面均无文档横向溢出，工作台移动导航可见。

截图：[真实导购](evidence/local-live/browser/ai-proposal-desktop.png)、[加购后](evidence/local-live/browser/cart-after-ai.png)、[已完成](evidence/local-live/browser/order-completed.png)、[已退款](evidence/local-live/browser/order-refunded.png)、[角色权限](evidence/local-live/browser/merchant-custom-role.png)、[商户移动端](evidence/local-live/browser/merchant-mobile.png)、[平台移动端](evidence/local-live/browser/admin-mobile.png)。

## 发现的问题与原始记录

- **真实模型读取超时**：原固定 30 秒在连续调用中发生 `ReadTimeout`，响应明确降级为 `LOCAL_FALLBACK`，严格验收拒绝通过。已将读取超时改为 `LLM_TIMEOUT_SECONDS`，允许 5–60 秒、默认 60；其他 HTTP 超时保留原来的 30 秒。真实复测中 33.7、39.2、40.1 秒的模型调用成功返回。临时缩短连接超时的运行还观察到一次 `ConnectTimeout`，最终保留原有连接超时。见[超时失败](evidence/local-live/shopping-api-failed-timeout.json)与[供应商观测](evidence/local-live/provider-observations.json)。这些少量调用不能证明供应商稳定性或 P95。
- **验收断言修正**：购物车 GET 返回实时价格、版本和可售状态，直接比较整个响应会把正常的实时报价变化误判为写入；已改为比较持久化商品行及数量。[原失败](evidence/local-live/shopping-api-failed-cart-assertion.json)保留。
- **浏览器等待修正**：首次脚本在 Vue 尚未完成购物车 GET 时读取到零行，跳过了旧购物车清理，最终数量断言失败。已等待真实 GET 和行数，并使用完整页面加载避免 hash 跳转过早返回。[原失败](evidence/local-live/browser/flow-failed-cart-readiness.json)保留；随后完整闭环通过。
- [最早未完成记录](evidence/local-live/shopping-api-incomplete-first.json)和[尚未记录响应详情的首次 LLM 失败](evidence/local-live/shopping-api-failed-first.json)也保留，均不计入最终通过数；具体原因没有足够证据的记录不作推断。

## 复现与本地预览

服务保持运行，打开 `http://127.0.0.1:8091/#/`，不要添加 `demo=1`。管理员凭据仍在私有 `.env`；本次经营者、消费者和店员凭据在忽略目录 `var/local-live/shopping-accounts.json`。未修改用户提供的密码。

重启前先停止本轮启动器及其子进程，确认 8091、8100 空闲；启动器不会初始化或清空数据库：

```powershell
python scripts/run-local-live.py --allow-plaintext-milvus-for-acceptance
```

严格复测会真实调用供应商并写入明确标记的验收业务数据；顺序如下，不能在仍有一次运行未结束时重复启动：

```powershell
python scripts/smoke-full.py --output var/local-live/full-http-rerun.json
python scripts/accept-local-shopping.py --prepare-only
python frontend/tests/live_shopping.py --stage product
python scripts/accept-local-shopping.py
python frontend/tests/live_shopping.py --stage flow
python frontend/tests/live_shopping.py --stage pages
python scripts/verify-local-shopping-db.py
```

页面闭环每次会新增交易；数据库核对脚本中的库存 48 是**本次首轮完成闭环**的固定期望，重跑交易后应按新增消耗核对，不能把旧期望误认为业务缺陷。不会自动清理已有订单或重置商品库存。

本轮未执行 Docker、Qdrant、生产部署或容量/并发性能验收。Maven 的 29 项 MySQL JUnit 在本轮构建中跳过；未使用用户现有库强行运行要求专用测试库的破坏性套件。其他专项审查报告有其独立环境与证据，本报告不合并计数。Milvus TLS 仍未启用，正常部署入口不会因本地验收例外而放开公网明文配置。
