# 校园智能导购及商品交易平台 · 文档索引

> 当前维护日期：2026-11-27。本页只索引当前事实源。历史阶段报告继续保留在 `docs/testing/` 供审计与复现，但不作为新任务自动授权或当前验收证明。

## 开始开发前

| 内容 | 当前入口 |
|---|---|
| 仓库约束与禁止破坏事项 | [AGENTS.md](../AGENTS.md) |
| AI 协作、测试范围与交付流程 | [AI 开发流程](development/AI-WORKFLOW.md) |
| OpenSpec 使用与资料归属 | [OpenSpec 试点](development/OPENSPEC.md) |
| Java/DDD 命名与职责 | [Java 规范](development/JAVA-STYLE.md) |
| 前端源码、构建与交互约定 | [前端开发](development/FRONTEND.md) · [前端设计](development/FRONTEND-DESIGN.md) |
| 当前完成度与剩余工作 | [状态路线](ROADMAP.md) · [R1 交付范围](DELIVERY-R1.md) |

## 当前业务与架构建模

| 内容 | 当前入口 |
|---|---|
| 原始需求与产品收束 | [PRD](requirements/PRD.md) · [产品收束](requirements/PRODUCT-CONVERGENCE-20261118.md) |
| 已冻结业务决定 | [R1 实施规格](specs/RELEASE-01.md) · [业务决定与剩余边界](requirements/open-questions.md) |
| 架构取舍 | [ADR](architecture/decisions.md) |
| 业务边界与上下文 | [业务架构](architecture/business-architecture.md) · [上下文映射](architecture/context-map.md) |
| 系统与事务设计 | [系统架构](architecture/system-architecture.md) · [事务与事件](architecture/transactions-and-events.md) · [锁顺序](architecture/lock-ordering.md) |
| 业务参数 | [业务参数清单](architecture/business-parameters.md) |
| 七个领域设计 | [领域设计目录](domains/) |

## 当前契约与运行

| 内容 | 当前入口 |
|---|---|
| JSON HTTP 契约 | [102 条路由](api/http-api.md) · [OpenAPI](api/openapi.json) · [行为约定](api/behavior-v1.1.md) · [SDD-03 契约修复](specs/SDD-API-CONTRACT-03.md) |
| AI 流式协议 | [独立 SSE 协议](api/streaming.md) |
| 错误码 | [错误码表](api/error-codes.md) |
| 数据模型与迁移 | [逻辑数据模型](database/logical-data-model.md) · [迁移手册](database/migrations/README.md) |
| 本地开发 | [本地开发入口](operations/local-development.md) · [R1 运行手册](operations/R1-runbook.md) |
| Redis 与图片存储 | [Redis 运行手册](operations/REDIS-12-runbook.md) · [七牛图片](operations/QINIU-IMAGES.md) |
| 供应链与发布 | [发布治理](operations/R1-release-governance.md) · [部署检查单](operations/deployment-checklist.md) |

## 验证、评测与答辩

| 内容 | 当前入口 |
|---|---|
| 最新综合审查记录 | [答辩前多维审查修复](testing/DEFENSE-REVIEW-FIXES-20261118.md) |
| 最新全链路 UI/UX 验收 | [产品收束与去 AI 味验收](testing/UX-CONVERGENCE-POLISH-20261118.md) |
| 最新隔离真实后端 | [MySQL/Redis/Spring/FastAPI/浏览器全栈](testing/FULL-STACK-ISOLATION-20261121.md) |
| 测试范围与门禁 | [AI 开发流程](development/AI-WORKFLOW.md) · [测试证据副作用隔离](testing/TEST-EVIDENCE-ISOLATION-20261121.md) · [main 保护](development/REPOSITORY-GATES.md) |
| AI 评测工具与数据 | [评测说明](../ai-service/evaluation/README.md) · [Benchmark V2 (360+24 例)](../ai-service/evaluation/datasets/campus-shopping-v2/README.md) · [标注手册](ai/benchmark-v2-annotation-manual.md) · [数据分布](ai/benchmark-v2-data-distribution.md) · [Holdout 盲测方案](ai/benchmark-v2-holdout-protocol.md) · [V2 首轮实验](testing/AI-EVALUATION-V2-20261127.md) · [V2 可信度整改](testing/AI-EVALUATION-V2-CREDIBILITY-20261127.md) · [V1 历史基线](../ai-service/evaluation/datasets/campus-shopping-v1/README.md) |
| 毕设总控台 | [开题、论文、图表、实验与终期答辩](thesis/README.md) |
| 最近完成变更档案 | [产品化主变更](../openspec/changes/archive/2026-11-21-productize-campus-shopping-experience/proposal.md) |

## 历史资料边界

- `docs/testing/` 是对应任务的只追加证据，保留当时的命令、环境、失败和未验证范围；不要用旧报告替代当前提交的验证。
- `docs/tutorial/`、`docs/iterations/` 与带日期的审查/整改文档属于实现过程档案，用于追溯当时依据，不是当前开发清单。
- `openspec/changes/` 只保留仍在进行或受历史证据链接约束的变更；其余已完成变更归档在 `openspec/changes/archive/`。
- 不提交逐轮 AI 内部推理、对话草稿或临时思考过程。只记录最终决策、可复现命令、结果、风险和未验证事项。

接口最终以当前 Controller/DTO 和生成契约为准；业务规则冲突时依次核对已接受 ADR、R1/SDD 增量、当前行为契约与源码。
