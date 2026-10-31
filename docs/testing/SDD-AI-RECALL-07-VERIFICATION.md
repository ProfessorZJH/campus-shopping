# SDD-07 验证记录（2026-10-29）

> **后续真实执行**：讯飞 `spark-x2.6`、NVIDIA/Milvus 子链路见[前序 AI 报告](AI-LIVE-20261029.md)；现已补充真实 Java/MySQL 与 Chromium 导购、交易、自提/退款闭环，见[本地真实验收](LOCAL-LIVE-20261029.md)。以下 NOT_RUN 为此前交付环境的历史记录；本轮 Maven 的专用 MySQL JUnit 仍跳过，不与真实 HTTP 验收混为同一种检查。

- 实际修改：Java ShoppingAiCase / Catalog Domain / Catalog Repository & DAO / MyBatis 召回 SQL / Python 内部召回 API / 讯飞兼容调用 / 测试与文档。
- 执行的检查与结果见同批根目录外的 `campus-shopping-ai-recall-verification-20261029.md`，此记录作为工程内验收计划。
- MySQL 特定 JUnit：`CommerceMySqlIntegrationTest.aiRecallSearchesWholePublishedCatalogInsteadOfNewestHundred`；必须仅在隔离的 `campus_shopping_it` 数据库执行。
- 推荐效果验收：准备 200+ 个商品、覆盖预算、规格、否定要求、多轮指代的中文问题集，分别统计商品候选 Recall@20/50、约束满足率、响应延迟与降级率。**未执行时不填写指标。**
- 实际讯飞模型与端到端 HTTP：NOT_RUN（执行环境无法解析远程 MaaS DNS、无 Maven/MySQL）。
