# R1 需求 → 代码 → 验证追踪矩阵

> 25项需求均已关联实际源码。**“已写代码”不等于“全需求已验收”**。Java/MySQL与真实模型门禁尚未运行，不填写虚构完成率。
> 详细证据：[验证报告](testing/R1-verification.md)。原始需求：[PRD](requirements/PRD.md)。

| 需求 | 功能 | 主要实现 | 对应验证入口 | 实际状态 |
|---|---|---|---|---|
| FR-001 | 账号注册、登录、退出 | `AuthController / UserAccountServiceImpl` | `SessionAuthenticationIntegrationTest` | Java集成未运行 |
| FR-002 | 受控初始化平台管理员 | `AdminBootstrap / AccessRepository` | `CommerceMySqlIntegrationTest` | Java集成未运行 |
| FR-003 | 多商户成员范围与角色 | `AccessServiceImpl / WorkspaceController` | `CommerceMySqlIntegrationTest` | Java集成未运行 |
| FR-004 | 完整入驻申请与本人查询 | `MerchantApplicationController / MerchantApplicationServiceImpl` | `CommerceMySqlIntegrationTest` | Java集成未运行 |
| FR-005 | 平台通过或驳回申请 | `MerchantAdmissionCaseImpl` | `CommerceMySqlIntegrationTest` | Java集成未运行 |
| FR-006 | Merchant/Store/Owner原子开通 | `MerchantAdmissionCaseImpl` | `CommerceMySqlIntegrationTest` | Java事务未运行 |
| FR-007 | 商户停用与历史业务保留 | `MerchantServiceImpl / OrderLifecycleCaseImpl` | `CommerceMySqlIntegrationTest` | Java集成未运行 |
| FR-008 | 店员邀请、接受、撤销 | `AccessServiceImpl / AccessController` | `CommerceMySqlIntegrationTest` | 前端契约已检查；数据库未运行 |
| FR-009 | 商品、多规格、价格、上架 | `CatalogCaseImpl / ProductAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest / frontend/tests/ui_product_images.py` | 图片上传/编辑前端契约通过；MySQL未运行 |
| FR-010 | 公开商品分类检索 | `CatalogController / CatalogRepository` | `frontend/tests/contract_ui.py / frontend/tests/ui_product_images.py` | 公开端图片展示契约通过；真实API未运行 |
| FR-011 | 库存补货与数量视图 | `InventoryServiceImpl / CatalogCaseImpl` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 纯领域通过；MySQL未运行 |
| FR-012 | 预占、释放、出库并发幂等 | `InventoryServiceImpl / OrderLifecycleCaseImpl` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 56规则含库存检查通过；真实竞争未运行 |
| FR-013 | 跨商户购物车、单商户结算 | `CartCaseImpl / CheckoutCaseImpl` | `CommerceMySqlIntegrationTest / frontend/tests/contract_ui.py` | 前端契约通过；真实数据库未运行 |
| FR-014 | 可信报价、快照与建单 | `CheckoutCaseImpl / OrderAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 纯领域通过；MySQL未运行 |
| FR-015 | 模拟支付、主动取消、超时关单 | `OrderLifecycleCaseImpl / OrderExpiryJob` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 纯领域通过；支付/关单竞争未运行 |
| FR-016 | 备货与一次性自提 | `OrderLifecycleCaseImpl / PickupAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 纯领域通过；MySQL未运行 |
| FR-017 | 未提货整单退款 | `OrderLifecycleCaseImpl / TradingServiceImpl` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 纯领域通过；退款/核销竞争未运行 |
| FR-018 | 商户审核与平台争议裁决 | `AfterSaleController / OrderLifecycleCaseImpl` | `scripts/smoke-full.py` | 真实API未运行 |
| FR-019 | 自然语言需求理解与会话 | `ShoppingAiCaseImpl / ai-service/app/engine.py` | `ai-service/tests/test_service.py` | 本地/替身测试通过；真实模型未运行 |
| FR-020 | 候选检索、约束过滤、证据排序 | `ai-service/app/retrieval.py / engine.py` | `ai-service/evaluate.py` | 8样本本地检索实测；外部向量/模型未测 |
| FR-021 | 提案归属、过期、显式确认加购 | `ShoppingAiCaseImpl / ProposalAggregate` | `DomainRulesCheck / CommerceMySqlIntegrationTest` | 纯领域/前端契约通过；Java链路未测 |
| FR-022 | 知识上传、版本、权限、索引 | `KnowledgeCaseImpl / ai-service/app/main.py` | `ai-service/tests/test_service.py / scripts/smoke-ai-local.py` | Python服务实测；Java全链路未测 |
| FR-023 | 可复现实验与结果记录 | `ai-service/evaluate.py` | `docs/testing/evidence/ai-retrieval-evaluation.json` | 仅8条演示样本；论文级评测未完成 |
| FR-024 | 平台/商户必要统计 | `OrderController / TradingRepository` | `scripts/smoke-full.py` | 前端契约通过；数据库统计未测 |
| FR-025 | 三角色产品入口与交互 | `frontend/src/main.js / pages/` | `frontend/tests/contract_ui.py / live_ui.py` | 20项真实Chromium+替身通过；真实后台未测 |

本轮不得将Java脚本静态检查、Python替身测试和前端替身检查累计成整体系统通过率。FR-023的实验规模、FR-025的真实后台测试及生产门禁仍须补齐。


## SDD-02 补充可追踪性（不覆盖 R1 原始测试状态）

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

## SDD-03 HTTP 契约闭环（补充，不改变 R1 的运行声明）

| 变更 | FR 关联 | Java/前端与文档 | 实际测试入口 | 真实服务状态 |
|---|---|---|---|---|
| C01/C02/C03/C04 | FR-001～025 | `generate-api-contract.py`、`docs/api/`、`domains/` | `verify-api-contract.py` | `NOT_RUN` |
| C05/C09 | FR-001/004/011/014/025 | `behavior-v1.1.md`、安全配置 | `verify-api-contract.py`、`smoke-full.py` | `NOT_RUN` |
| C06 | FR-010/025 | `SessionSecurityConfig`、`SessionAuthenticationIntegrationTest` | MockMvc + 真实浏览器匿名路径 | `NOT_RUN` |
| C07 | FR-004/009/010/011/013/024/025 | `IMerchantDao`、`ITradingDao`、`IInventoryDao`、Controller/前端 q | SQL/Mapper 静态 + `smoke-full.py` | `NOT_RUN` |
| C08 | FR-013/025 | `CartResponseDTO`、`CartController`、`Cart.js` | DTO 静态 + 真实 `/cart` 请求 | `NOT_RUN` |
| C10 | FR-025 | `frontend/tests/live_ui.py`、CI | 浏览器真实 Session/ACL/截图 | `NOT_RUN` |

静态门禁运行记录见 `docs/testing/SDD-API-CONTRACT-03-VERIFICATION.md`。全栈环境未运行时不得写成 PASS。
