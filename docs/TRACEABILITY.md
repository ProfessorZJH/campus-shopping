# 需求追踪矩阵

> 当前维护日期：2026-11-21。矩阵表达需求到实现与主要门禁的归属；实际验收状态必须引用对应提交和环境的测试记录。

| 需求 | 能力 | 主要实现 | 当前状态 |
|---|---|---|---|
| FR-001 | 注册、登录、退出 | `AuthController`、`UserAccountServiceImpl`、Session/CSRF 配置 | 主线已实现，适用范围见最新全栈记录 |
| FR-002 | 受控初始化平台管理员 | `AdminBootstrap`、`AccessRepository` | 主线已实现 |
| FR-003 | 跨商户成员范围与角色 | `AccessServiceImpl`、`WorkspaceController` | 主线已实现 |
| FR-004 | 完整入驻申请与本人查询 | `MerchantApplicationController`、`MerchantApplicationServiceImpl` | 主线已实现 |
| FR-005 | 平台通过或驳回申请 | `MerchantAdmissionCaseImpl` | 主线已实现 |
| FR-006 | Merchant/Store/Owner 原子开通 | `MerchantAdmissionCaseImpl` | 主线已实现 |
| FR-007 | 商户停用与历史业务保留 | `MerchantServiceImpl`、`OrderLifecycleCaseImpl` | 主线已实现 |
| FR-008 | 店员邀请、接受、撤销 | `AccessServiceImpl`、`WorkspaceController` | 主线已实现 |
| FR-009 | 商品、多规格、价格、上下架 | `CatalogCaseImpl`、`ProductAggregate` | 主线已实现 |
| FR-010 | 公开商品分类检索 | `CatalogController`、Catalog 查询仓储 | 主线已实现 |
| FR-011 | 补货与可售量 | `InventoryServiceImpl`、`CatalogCaseImpl` | 主线已实现 |
| FR-012 | 预占、释放、出库并发幂等 | `InventoryServiceImpl`、交易 Case | 主线已实现，真实 MySQL 竞争回归入库 |
| FR-013 | 跨商户购物车、单商户结算 | `CartCaseImpl`、`CheckoutCaseImpl` | 主线已实现 |
| FR-014 | 可信报价、快照与幂等建单 | `CheckoutCaseImpl`、`OrderAggregate` | 主线已实现 |
| FR-015 | 模拟支付、主动取消、超时关单 | `OrderLifecycleCaseImpl`、`OrderExpiryJob` | 主线已实现 |
| FR-016 | 备货与一次性自提 | `OrderLifecycleCaseImpl`、履约领域 | 主线已实现 |
| FR-017 | 未提货整单模拟退款 | 售后与订单生命周期 Case | 主线已实现 |
| FR-018 | 商户审核与平台争议裁决 | `AfterSaleController`、交易 Case | 主线已实现 |
| FR-019 | 自然语言需求理解与会话 | `ShoppingAiCaseImpl`、`ai-service/app` | 主线已实现；真实供应商质量单独验收 |
| FR-020 | 候选检索、约束过滤与证据排序 | Catalog 候选查询、Python retrieval/ranking、Java 事实复验 | 主线已实现；真实 Milvus/Qdrant 按环境验收 |
| FR-021 | 提案归属、过期、确认加购 | `ShoppingAiCaseImpl`、`ProposalConfirmationCaseImpl` | 主线已实现 |
| FR-022 | 知识上传、版本、权限、索引 | `KnowledgeCaseImpl`、FastAPI 知识服务 | 主线已实现 |
| FR-023 | 可复现实验与结果记录 | [评测执行器](../ai-service/evaluation/README.md)、120 例数据集 | 框架与自动测试完成；人工冻结和正式质量结论未完成 |
| FR-024 | 平台/商户经营统计 | `OrderQueryCaseImpl`、查询仓储 | 主线已实现 |
| FR-025 | 三端产品入口与交互 | `frontend/src`、浏览器回归 | 主线已实现，范围见最新全栈验收 |

## 状态说明

- “主线已实现”表示源码链路与对应自动测试存在，不表示生产部署或所有真实外部依赖已验收。
- Java 事实、MySQL 事务、Redis 共享状态、HTTP、浏览器和外部 AI 证据必须分层记录。
- FR-023 的人工 gold、回答语义评审和正式评测报告以[当前路线](ROADMAP.md)为准。
- 历史测试数量、接口数量和实现细节不作为本矩阵的永久当前值；生成契约和最新证据是核验入口。
