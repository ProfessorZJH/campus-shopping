# 结构重构分支实施与验证记录

> 日期：2026-11-08  
> 分支：`codex/shoppingai-structure-refactor`  
> 基线：`main` / `origin/main` `f1ba856`  
> 代码提交：`ce56d09`

## 记录范围

本记录只描述结构重构分支已经完成的代码切片和本地定向验证。它不表示分支已经合并、Docker 真实验收已经通过、真实外部模型效果已经通过或生产环境已经通过。

另一个会话正在执行 Docker 真实验收；其命令、镜像、容器、数据库和 Redis 证据回传后，仍需单独写入对应验收报告。

## 已实施切片

| 范围 | 提交 | 实施内容 |
| --- | --- | --- |
| ShoppingAI | `29bbc4f` | 从 Case 提取候选处理和知识证据装配，保留租约、SSE、取消、短事务和 Java 最终复验。 |
| Catalog | `5e06634`、`a7fa817` | 建立商品展示快照、窄读能力和候选查询能力；AI 读取不可变候选快照，不直接依赖商品聚合内部结构。 |
| 后台前端 | `011f02f`、`ce56d09` | 统一后台导航、权限、路由元数据；`Merchant` 复用共享 Shell；按源代码重新生成静态 UI 副本。 |
| 导购前端 | `4ed572f`、`ce56d09` | 抽取历史会话、SSE、取消、快照校验和断线恢复 transport，保留页面身份代次和旧响应隔离。 |
| Python Provider | `fb3db9b` | 拆分 `ChatProvider`、`EmbeddingProvider` 和兼容 `Provider` facade，保持供应商请求、审计、降级和 SSE 语义。 |
| Python 检索融合 | `4ed572f` | 抽取无 I/O 的 RRF 与稳定 Top-K；保留知识 sparse/dense 排名和 Java semantic SKU 原始 rank gap。 |

以上改动没有新增 API、数据库迁移、权限模型、交易写权限、远程凭据 Port 或外部依赖。前端生成副本来自 `frontend/src`，没有手改静态 bundle。

## 已执行验证

- Java 定向回归：`AiConversationBoundaryTest`、`ProposalProductIdentityTest`、`ProductCandidateSnapshotTest`、`PurchaseConstraintTest`、`SkuConstraintPolicyTest` 通过。
- Java 编译：`mvnw -q -pl campus-shopping-app -am -DskipTests -Dfrontend.skip=true compile` 通过。
- Python 检索/服务定向回归：最终复跑 24 项通过；Provider/检索批次此前完成 174 项定向回归。仅出现既有 Starlette `PendingDeprecationWarning`。
- Python：`python -m compileall -q app` 通过。
- 前端 Node：transport、API timeout、identity race 共 9 项通过。
- 前端浏览器契约替身：Guide 8 项、修复回归 11 项、RBAC 14 项、Shell bundle 2 项通过。
- 前端格式与副本：`npm run format:check --prefix frontend`、`python scripts/build-ui-bundle.py --check` 通过。
- 结构门禁：7 个本次相关 OpenSpec change 均通过 `openspec validate --strict --no-interactive`；最终差异通过 `git diff --check`。

本轮没有执行全量 Maven `clean verify`，也没有把隔离替身测试扩大解释为 Docker、真实 MySQL/Redis、真实供应商或生产验收。

## 当前延期项

- `AnswerFlowFactory`、回答规则树和节点：当前只有一条稳定回答主路径，先保留已拆出的候选和证据能力，待出现真实第二回答分支再引入，避免为了增加模式而改变混合问答语义。
- Agent v1.1：Tool Gateway、Handler、Run/Action 确认与幂等仍作为独立阶段，等待已有 Agent 产品决策和范围冻结；本分支不预建通用执行基础设施。
- Trading / Repository P2：现有订单、售后、事件、履约和查询接口已经按读写用途收窄；售后事务锁序为订单锁→售后锁→履约/库存→退款记账→事件审计，当前没有足够的 SQL、并发或审计收益支持继续拆分。
- 前端全量 SFC、Pinia、Vue Router 重写：继续按业务边界渐进整理，不因结构重构改动 URL、权限或请求竞态语义。
- Python Query 理解、结果生成和真实 Milvus/Qdrant/供应商效果：保留为后续独立切片和真实环境验收。
