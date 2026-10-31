# R1 需求 → 代码 → 验证追踪矩阵

> 当前追踪状态：2026-10-30。25 项需求均关联当前源码和实际验证入口；用例覆盖不等于需求已穷尽验收。Java/MySQL、真实 HTTP、浏览器已有隔离证据，最新源码结果见[本轮报告](testing/DDD-DOC-CLOSURE-20261030.md)，历史真实模型结果见[本机验收](testing/LOCAL-LIVE-20261029.md)。
> 前轮隔离证据：[181 项 Java 与 HTTP/浏览器验收](testing/PROJECT-REVIEW-FIXES-20261030.md)。原始需求：[PRD](requirements/PRD.md)。

| 需求 | 功能 | 主要实现 | 对应验证入口 | 实际状态 |
|---|---|---|---|---|
| FR-001 | 账号注册、登录、退出 | `AuthController / UserAccountServiceImpl` | `SessionAuthenticationIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-002 | 受控初始化平台管理员 | `AdminBootstrap / AccessRepository` | `CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-003 | 多商户成员范围与角色 | `AccessServiceImpl / WorkspaceController` | `CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-004 | 完整入驻申请与本人查询 | `MerchantApplicationController / MerchantApplicationServiceImpl` | `CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-005 | 平台通过或驳回申请 | `MerchantAdmissionCaseImpl` | `CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-006 | Merchant/Store/Owner原子开通 | `MerchantAdmissionCaseImpl` | `CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-007 | 商户停用与历史业务保留 | `MerchantServiceImpl / OrderLifecycleCaseImpl` | `CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-008 | 店员邀请、接受、撤销 | `AccessServiceImpl / WorkspaceController` | `CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-009 | 商品、多规格、价格、上架 | `CatalogCaseImpl / ProductAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest / frontend/tests/ui_product_images.py` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-010 | 公开商品分类检索 | `CatalogController / CatalogRepository` | `frontend/tests/contract_ui.py / frontend/tests/ui_product_images.py` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-011 | 库存补货与数量视图 | `InventoryServiceImpl / CatalogCaseImpl` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-012 | 预占、释放、出库并发幂等 | `InventoryServiceImpl / OrderLifecycleCaseImpl` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-013 | 跨商户购物车、单商户结算 | `CartCaseImpl / CheckoutCaseImpl` | `CommerceMySqlIntegrationTest / frontend/tests/contract_ui.py` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-014 | 可信报价、快照与建单 | `CheckoutCaseImpl / OrderAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-015 | 模拟支付、主动取消、超时关单 | `OrderLifecycleCaseImpl / OrderExpiryJob` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-016 | 备货与一次性自提 | `OrderLifecycleCaseImpl / PickupAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-017 | 未提货整单退款 | `OrderLifecycleCaseImpl / AfterSaleServiceImpl` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-018 | 商户审核与平台争议裁决 | `AfterSaleController / OrderLifecycleCaseImpl` | `scripts/smoke-full.py` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-019 | 自然语言需求理解与会话 | `ShoppingAiCaseImpl / ai-service/app/engine.py` | `ai-service/tests/test_service.py` | 当前 Python 规则/模型替身已测；真实讯飞为 2026-10-29 历史验收 |
| FR-020 | 候选检索、约束过滤、证据排序 | `ai-service/app/retrieval.py / engine.py` | `ai-service/evaluate.py` | 当前词面/语义 ID 复验与约束已测；真实 Milvus 为历史验收，Qdrant 未验收 |
| FR-021 | 提案归属、过期、显式确认加购 | `ShoppingAiCaseImpl / ProposalAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-022 | 知识上传、版本、权限、索引 | `KnowledgeCaseImpl / ai-service/app/main.py` | `ai-service/tests/test_service.py / scripts/smoke-ai-local.py` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-023 | 可复现实验与结果记录 | [执行器/数据/口径](../ai-service/evaluation/README.md)、[评测规格](../openspec/changes/evaluate-shopping-retrieval-recommendations/specs/shopping-ai-evaluation/spec.md) | [本轮验证](testing/AI-EVALUATION-20261031.md)、`var/evaluation/runs/` | 120例DRAFT；本地/受控与Java真实MySQL分层；人工gold、真实Embedding/LLM/Milvus对比、泛化及生产性能尚未验收 |
| FR-024 | 平台/商户必要统计 | `OrderQueryCaseImpl / OrderRepository` | `scripts/smoke-full.py` | 2026-10-30 隔离 Java/MySQL 与真实 HTTP 已覆盖；见本轮报告 |
| FR-025 | 三角色产品入口与交互 | `frontend/src/main.js / pages/` | `frontend/tests/contract_ui.py / live_ui.py` | 真实后台浏览器及接口替身用例均有证据；范围见本轮与历史报告 |

静态检查、模型替身、真实数据库和浏览器证据按层级记录，不累计整体系统通过率。FR-023 的实验规模、生产安全、性能和实际部署环境门禁仍待专项验收；真实资金支付不在 R1 范围。


## SDD-12 Redis主线整合（2026-10-31）

R12-01～09 的实现与实际证据见 [整合报告](testing/REDIS-MAIN-INTEGRATION-20261031.md)及[规格矩阵](specs/SDD-REDIS-12.md)。临时MySQL/本机Redis的Maven189项、Python49项、真实HTTP173项、双Java实例9项、真实浏览器8项通过。旧Redis V31缺失主线V30的升级路径单独复验通过。R12-10中远程模型、生产HA和性能本轮NOT_RUN，CI/镜像以对应PR Actions实际结果为准。

## 历史：SDD-02（2026-10-28 当时测试状态）

下表保留当时 NOT_RUN，当前状态以上方矩阵及最新报告为准。

| 修复项 | 对应 FR | 实施源码 | 本次测试与状态 |
|---|---|---|---|
| A01/B05 | FR-010/025 | `Shop.js`、`MerchantApplicationController` | Chromium 契约替身；真实数据库 NOT_RUN |
| A02 | FR-009 | `Merchant.js`、Catalog Case | 多 SKU 浏览器测试；MySQL NOT_RUN |
| A03 | FR-022 | `Knowledge.js` | 新版本 UI/请求检查；Java/Python 联调 NOT_RUN |
| A04 | FR-010/025 | Product/Order DTO、Platform.js | DTO/静态契约；真实库 NOT_RUN |
| A05/B04 | FR-010/024/025 | `PageResponseDTO`、Java Count Mapper、Vue 页列表 | 130+ 数据浏览器翻页通过；MySQL COUNT NOT_RUN |
| B01/B02 | FR-013/021 | Cart/Proposal DTO、Controller/Case | 静态契约 + Chromium；真实接口 NOT_RUN |
| B03 | FR-014/015 | Checkout/Trading/OrderItem、迁移 SQL | 独立 Java17 读模型和 Chromium 旧订单图片回归通过；增量迁移 NOT_RUN |

详细测试命令与局限见 [SDD-02 验证](testing/SDD-INTEGRATION-02-VERIFICATION.md)。

## 历史：SDD-03（2026-10-28 当时测试状态）

| 变更 | FR 关联 | Java/前端与文档 | 实际测试入口 | 真实服务状态 |
|---|---|---|---|---|
| C01/C02/C03/C04 | FR-001～025 | `generate-api-contract.py`、`docs/api/`、`domains/` | `verify-api-contract.py` | `NOT_RUN` |
| C05/C09 | FR-001/004/011/014/025 | `behavior-v1.1.md`、安全配置 | `verify-api-contract.py`、`smoke-full.py` | `NOT_RUN` |
| C06 | FR-010/025 | `SessionSecurityConfig`、`SessionAuthenticationIntegrationTest` | MockMvc + 真实浏览器匿名路径 | `NOT_RUN` |
| C07 | FR-004/009/010/011/013/024/025 | `IMerchantDao`、`ITradingDao`、`IInventoryDao`、Controller/前端 q | SQL/Mapper 静态 + `smoke-full.py` | `NOT_RUN` |
| C08 | FR-013/025 | `CartResponseDTO`、`CartController`、`Cart.js` | DTO 静态 + 真实 `/cart` 请求 | `NOT_RUN` |
| C10 | FR-025 | `frontend/tests/live_ui.py`、CI | 浏览器真实 Session/ACL/截图 | `NOT_RUN` |

静态门禁运行记录见 `docs/testing/SDD-API-CONTRACT-03-VERIFICATION.md`。全栈环境未运行时不得写成 PASS。
