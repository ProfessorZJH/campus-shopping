# R1 开发与验收状态

## 2026-11-08 产品化完成与后续重构路线

截至 2026 年 11 月 8 日，`main` / `origin/main` `f1ba856` 已包含 `productize-campus-shopping-experience` 的 M0～M6 实现，OpenSpec 46 项任务全部完成。全链路产品化的实现与证据见[沉淀版架构路线](architecture/PRODUCTIZATION-REFACTOR-BASELINE-20261108.md)和[最终状态报告](testing/PRODUCTIZATION-FINAL-STATUS-20261107.md)。

本阶段已覆盖消费者、AI 导购、商户、店员、平台和知识库的主要产品链路。后续重点是 ShoppingAI 职责拆分、Catalog 窄查询能力、Python AI/RAG 边界和独立 Agent v1.1；这些属于下一阶段结构性重构，不由产品化完成状态自动推出。

当前结构重构工作在独立分支 `codex/shoppingai-structure-refactor` 上推进，分支基于 `f1ba856`，实施与验证见[结构重构分支记录](testing/STRUCTURAL-REFACTOR-20261108.md)。该分支已经完成 ShoppingAI 候选/证据职责、Catalog 快照与候选查询、后台 Shell 元数据、Guide transport、Python Provider 和检索融合的第一批切片；这些提交尚未合入 `main`。

AnswerFlow 规则树、Agent v1.1 和 Trading/Repository P2 仍保持延期边界：前者等待稳定的第二回答分支，Agent 等待独立产品决策，Trading/Repository 等待可量化的 SQL、并发或审计收益。

另一个会话正在 Docker 环境执行真实验收。本文件暂不记录其通过结论；待命令、版本、环境和结果证据回传后，单独写入 `docs/testing/` 并更新引用。真实供应商语义效果、生产部署、生产数据和性能压测仍保持独立验收范围。

原始规划资料仍保留在以下 OpenSpec 文件中：

- [整体方案、范围和交付阶段](../openspec/changes/productize-campus-shopping-experience/proposal.md)
- [技术设计、审查条目追踪、数据兼容与依赖](../openspec/changes/productize-campus-shopping-experience/design.md)
- [可执行任务与逐项验收条件](../openspec/changes/productize-campus-shopping-experience/tasks.md)

## R1 历史交付记录（2026-10-31）

本节记录截至 2026-10-31 的范围。Redis 交付与主线整合见[SDD-12验收](testing/REDIS-MAIN-INTEGRATION-20261031.md)及[运行手册](operations/REDIS-12-runbook.md)；前序领域整改见[2026-10-30报告](testing/DDD-DOC-CLOSURE-20261030.md)，历史真实模型及浏览器交易见[本机验收](testing/LOCAL-LIVE-20261029.md)。各日期报告仅代表当时版本与环境。

| 范围 | 当前实现 | 验证状态 |
| --- | --- | --- |
| 工程基线 | Maven Wrapper、UI 源码构建、迁移校验、自动清单 | 已有隔离 clean verify；源快照与结果见本轮报告 |
| 身份商户 | 会话、CSRF、实时权限、入驻、角色、邀请 | Java/MySQL、HTTP 与列明浏览器用例已覆盖；邀请支持翻页 |
| Redis 基础设施 | 共享Session、共享限流、公开展示缓存、AI准入与索引锁 | 真实Redis与双Java/MySQL HTTP回归已通过；支持多Java连接同一MySQL/Redis和单Python，生产HA未验收 |
| 商品库存 | 富商品模型、多 SKU、全局搜索排序、并发库存 | Java/MySQL 锁竞争和真实 HTTP 已覆盖 |
| 交易履约售后 | 单商户事务、模拟支付、核销、退款 | 真实库事务测试和 HTTP 已覆盖；响应读模型在写事务内组装 |
| AI 知识 | 版本/ACL/索引、词面和可选商品 Milvus、会话/提案 | 当前本地检索与模型替身通过；讯飞/NVIDIA/Milvus 有历史联调证据；Qdrant 尚未验收 |
| 三端产品 | Vue 源码、权限导航与列表分页 | 真实后台浏览器及契约替身分别记录，不能互相代替 |
| 部署 | Dockerfile/Compose/CI 配置 | SDD-12整合提交的[远端CI与实际镜像验收](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41161066987)通过；本机未启动Docker，生产部署未验收。新修改仍须对应提交的CI |

后续专项工作为论文级检索数据集、真实模型回归、生产安全与可信代理拓扑、备份恢复及压力测试。上线时对实际版本和环境重新执行验收。SSE、会话删除、多Python副本、真实支付/分账不属于当前已交付能力。

2026-10-28 的 87 路由与 NOT_RUN 记录已归为历史；现行 93 条 API 以[生成接口](api/http-api.md)、[OpenAPI](api/openapi.json)和[行为契约](api/behavior-v1.1.md)为准。
