# 校园商城产品化完成与系统重构路线（沉淀版 v1.1）

> 日期：2026-11-08
> 主线基线：`main` / `origin/main` `f1ba856`
> 来源：2026-11-08《校园商城系统重构总体方案（讨论汇总版 v1.0）》及仓库现有 OpenSpec、SDD、ADR 与验收记录。

## 文档定位

本文件把讨论汇总版方案整理为可长期引用的工程基线，记录已经完成的产品化与结构重构、当前验收边界和完成后的独立演进方向。它不新增业务规则，也不替换现有 PRD、R1/SDD、ADR、HTTP 契约或 OpenSpec；发生冲突时，以已接受的业务规格、当前 API/DDL 和对应版本的验收证据为准。

产品化 M0～M6 已完成，约定的结构重构范围也已完成，整体进度为 100%。本文后半部分用于说明已完成的重构边界及其后续独立演进方向，不把尚未进行的产品扩展或运行环境验收混写成重构未完成。

## 一、当前结论

校园商城继续采用 Java 模块化单体、MySQL 交易事实库、Redis/Redisson 共享状态与限流、独立 Python AI 服务的架构。当前没有拆分微服务、重建工程或全面规则引擎化的必要。

截至 2026 年 11 月 8 日，`productize-campus-shopping-experience` 的 46 项任务已在 `main` 版本全部完成。M0～M6 已覆盖消费者、AI 导购、商户、店员、平台和知识库的产品化链路；后续工作应从“补齐产品功能”转为“在不改变交易不变量的前提下收敛内部职责”。

PR #63 对应的远端 `Campus Shopping - Real Acceptance` workflow #324 已通过，覆盖隔离镜像、MySQL、Redis、FastAPI、真实 Maven、HTTP 和浏览器链路；真实外部供应商 smoke 仍按配置跳过，生产部署和性能目标继续单独验收。

结构重构已经在独立分支 `codex/shoppingai-structure-refactor` 上完成，最终代码提交为 `afe7ce4`，并通过 PR #63 合入 `main`，合并提交为 `89e2981`。实现范围、定向测试和完成后的独立演进边界见[结构重构分支实施与验证记录](../testing/STRUCTURAL-REFACTOR-20261108.md)。

## 二、已完成的产品化基线

| 阶段 | 已完成范围 | 当前证据与边界 |
| --- | --- | --- |
| M0 | 实施基线、设计规范、字段/接口来源和兼容方式冻结 | `docs/testing/PRODUCTIZATION-M0-BASELINE-20261107.md`；方案与任务见 `openspec/changes/productize-campus-shopping-experience/` |
| M1 | 退款失败恢复、公共状态面板、`.vue` 试点、TypeScript API 类型、新会话入口、引用展示 | `docs/testing/PRODUCTIZATION-M1-20261105.md`；保留旧 JS 页面兼容，未进行全仓前端重写 |
| M2 | 商品筛选和详情、店铺资料、结算确认、订单自提快照、履约事件、售后历史 | `docs/testing/PRODUCTIZATION-M2-20261106.md`；价格、库存、权限、幂等和同库事务不变量保持有效 |
| M3 | 提案商品身份、会话活动与稳定分页、历史引用、提案确认恢复、AI 轮次状态、SSE 流式和断线恢复 | `docs/testing/PRODUCTIZATION-M3-*.md` 及最终整合证据；实际供应商语义效果仍单独验收 |
| M4 | 商户订单待办、库存筛选与流水定位、商品/SKU/多图编辑、身份与工作区、统计、审核/争议操作 | `docs/testing/PRODUCTIZATION-M4-*.md`；统计与审核历史按实际事实和权限范围提供 |
| M5 | 知识版本与索引诊断、授权检索调试、命中片段和回答预览 | `docs/testing/PRODUCTIZATION-M5-*.md`；调试链路复用正式权限与检索约束 |
| M6 | 最终静态门禁、跨角色浏览器矩阵、隔离 MySQL/Redis/HTTP/CI 结果和交付报告 | `docs/testing/PRODUCTIZATION-FINAL-STATUS-20261107.md`、`docs/testing/evidence/frontend-live-final/results.json` |

最终状态报告记录：OpenSpec 46/46 完成，隔离浏览器矩阵 26/26 通过，覆盖消费者、商户、店员、平台的桌面/手机路由、图片归属、会话切换、重复下单幂等、变价/缺货拒绝和受控 AI SSE 断线恢复。报告同时明确，真实 NVIDIA/XFYUN/Milvus 供应商效果、生产域名、生产数据、生产部署和性能结论不由这批结果推断。

## 三、必须保持的架构边界

- Java/MySQL 是价格、库存、经营资格、权限、订单、售后和成交的唯一可信来源。Python 模型、向量索引和检索结果只能提供建议或投影，不能直接写交易数据。
- Case 负责跨域用例编排，Domain 负责状态和业务规则，Infrastructure 负责持久化、对象存储和远程适配；查询能力使用受控的只读投影，不能把可变聚合暴露给展示或 AI 调用方。
- AI 长调用不能持有数据库事务或行锁。会话租约、消息、提案和轮次运行状态继续遵守 600 秒租约、短事务原子提交、取消与完成竞争处理以及实际执行期间的 Python 许可约束。
- 价格、库存、权限、版本、状态和资源归属在最终写入前必须由 Java 重新复验。前端、模型和缓存不能绕过 CSRF、角色成员关系、锁顺序或幂等键。
- 保持现有 HTTP/DTO、`AppException`/`ResponseCode`、SSE 生命周期和必要的数据库兼容行为。新增能力必须同步生成契约、响应规则、迁移校验和对应验收记录。

## 四、已完成的结构重构范围与后续演进边界

### 1. ShoppingAI：已完成职责拆分，按需演进决策节点（P0）

本次已完成从 `ShoppingAiCaseImpl` 提取候选处理和知识证据装配；它继续保留会话入口、租约、SSE、取消和最终提交的应用编排职责，也没有被改成新的通用工作流引擎。

优先提取两个可复用能力：

- `CandidateResolver`：读取受控的 Catalog 只读候选，应用已有的商品、SKU、预算、数量和可售约束。
- `EvidenceAssembler`：装配知识引用、版本、片段和授权信息，拒绝错版本、错片段或内部内容外发。

在上述职责稳定后，再针对确实存在分支价值的回答路径引入 `AnswerFlowFactory`、`AnswerFlowContext` 和少量回答节点。节点可以组合知识回答、商品推荐和澄清，不能把每个请求强制压成互斥的三选一。

这一阶段的验收重点是：推荐、引用、权限、SSE、取消、租约、提案确认和失败恢复行为不变；新增分支只改变内部组织，不改变 Java 对交易事实的裁决。

### 2. Catalog：已完成展示快照与可变聚合分离（P1）

本次已完成商品、SKU、报价和库存展示快照，以及 Catalog 窄的只读能力。写入端继续使用 `ProductAggregate` 执行状态变更；ShoppingAI 和前端不读取聚合内部可变结构。

这不是重新建设一套 CQRS 框架，也不要求为每条 SQL 机械新增 Repository 或领域服务。只有在能改善边界、并发或查询成本时，才收窄接口和调整投影。

### 3. Python AI/RAG：已完成 Provider 与检索融合边界（P1）

本次已完成 Provider 边界拆分和检索融合/重排边界收敛。Query 理解、商品召回、知识检索、结构化结果生成和评测仍按真实职责分别演进；商品语义索引与知识检索不能因为都使用向量能力就强行合并。

Python 只负责理解、检索和生成；预算、数量、SKU、价格、库存、权限和交易状态由 Java 最终裁决。跨语言契约测试用于防止语义漂移，不能通过复制两份交易规则来解决。

### 4. Agent v1.1：完成后的独立产品阶段

Agent v1.1 作为完成后的独立产品阶段，未来采用受控 Tool Gateway、已注册 Handler、策略选择和必要的责任链。每次 Run/Action 绑定明确的用户、商户和资源范围；高风险写操作需要预览、确认、事务内复验和幂等回执。

模型不能提供任意类名、URL 或执行参数来动态调用能力，也不能通过全局 `active_role` 代替每次工具调用的授权验证。Agent 阶段独立于一般性重构，不能顺手改变现有购物车、提案确认或交易规则。

### 5. Trading / Repository：完成后的指标驱动演进（P2）

本次已完成售后裁决编排、订单查询和 Repository/Port 的现有边界审查与收敛。后续只有在职责、并发、SQL 成本或审计上有明确收益时才继续调整；订单金额、库存预占/释放/消耗、支付、核销、退款、锁顺序和幂等机制继续由现有领域模型与 Case 保持。

### 6. 前端：已完成的渐进式结构整理

本次已完成后台 Shell 元数据统一、Guide transport 抽取、`.vue` 试点、公共状态反馈、TypeScript API 类型、导购/订单/后台关键交互和生成副本校验。后续按业务边界继续拆页面、收敛状态归属和请求生命周期，不进行一次性全仓重写，也不因组件化改变接口或权限语义。

## 五、完成后的验收与演进顺序

1. **合入准备**：以 `codex/shoppingai-structure-refactor` 的完成记录、OpenSpec 状态和定向验证结果为依据，在获得授权后合入 `main`。
2. **运行环境验收**：接收 Docker 真实验收的命令、镜像/容器版本、数据库与 Redis 范围及结果证据，作为完成后的独立运行验证。
3. **真实组件与性能验收**：分别验证真实供应商、Milvus/Qdrant、生产部署和性能目标，不把这些运行证据倒推为结构重构完成条件。
4. **独立产品演进**：若出现第二回答分支或 Agent 产品决策，再分别推进 AnswerFlow、Agent v1.1；Trading/Repository 仅在出现可量化收益时继续优化。
5. **持续维护**：后续每个独立变更继续同步 OpenSpec、API/Schema、测试和 `docs/testing/` 证据。

每个批次都要有独立目标、影响范围、不变量和可观察验收条件。Docker 真实验收完成后，将具体命令、镜像/容器版本、数据库与 Redis 范围、失败与修复结果写入 `docs/testing/`，并在本文件或最终状态报告中补充链接。

## 六、已完成范围的边界约束

以下是本次已完成范围必须保持的架构边界，不是未完成任务清单。

- 不全面重写工程、不更换 DDD 脚手架、不把七个限界上下文拆成微服务。
- 不把所有业务改成规则树、责任链、策略工厂或通用 DAG。
- 不借重构改变售后状态机、AI 加购确认、权限、订单金额、库存锁序或交易事务语义。
- 不为尚未验证的未来需求预建 MQ、独立规则引擎、多 Python 拓扑或复杂事件总线。
- 不用本地替身、跳过的真实供应商调用或文档校验代替生产、性能和真实模型验收。

## 七、相关资料

- [产品化 OpenSpec 提案](../../openspec/changes/productize-campus-shopping-experience/proposal.md)
- [产品化技术设计](../../openspec/changes/productize-campus-shopping-experience/design.md)
- [产品化任务与验收条件](../../openspec/changes/productize-campus-shopping-experience/tasks.md)
- [全链路产品化最终状态（2026-11-07）](../testing/PRODUCTIZATION-FINAL-STATUS-20261107.md)
- [R1 状态路线](../ROADMAP.md)
- [架构决策记录](decisions.md)
- [AI 开发流程](../development/AI-WORKFLOW.md)
