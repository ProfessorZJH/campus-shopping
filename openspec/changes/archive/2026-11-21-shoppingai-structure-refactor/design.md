# Design

## Context

动机见 [proposal.md](proposal.md)。当前 `ShoppingAiCaseImpl` 约 670 行，既编排会话和 AI 调用，又直接完成候选融合、SKU/库存过滤、历史提案约束、引用复核和安全展示。已有 `RecommendationPolicy`、`SkuConstraintPolicy`、`ShoppingAnswerPolicy`、`ProposalViewAssembler` 等领域能力应继续作为唯一规则来源；本批次只调整应用层内部组织。

## Goals / Non-Goals

**Goals:**

- 让候选解析和证据校验成为可独立测试的窄职责组件，降低 `ShoppingAiCaseImpl` 的认知和回归负担。
- 保持调用顺序、读事实来源、异常码、引用脱敏、实时价格/库存复验和提案选择结果不变。
- 让每个抽取步骤可以单独回退，不引入新的 Spring 事务边界或外部运行时依赖。

**Non-Goals:**

- 不建设通用工作流、规则树、Agent、`AnswerFlowFactory` 或全量 Catalog 查询层。
- 不修改 Controller、DTO、OpenAPI、SSE 事件、数据库/Redis 结构、Python 协议、权限模型或交易语义。
- 不把模型、向量索引或缓存提升为价格、库存、权限或成交事实来源。

## Decisions

1. **在 `campus-shopping-case` 内提取窄职责组件。** 候选组件只接收已有的召回结果、目录/库存 Port 和历史提案约束，返回候选与当前报价/库存快照；证据组件只接收知识 Port、授权范围和模型引用，返回经过授权与版本复核的安全引用。组件不写数据库、不持有事务、不直接发送 SSE。
   - 选择原因：职责与现有 Case 边界一致，便于单测和回退。
   - 备选方案：先拆成通用工作流/工厂；放弃，因为当前没有足够稳定的多流程差异，容易把编排边界一起搬走。

2. **继续复用现有领域策略和异常码。** 候选解析复用 `RecommendationPolicy` 与 `SkuConstraintPolicy`，答案文本复用 `ShoppingAnswerPolicy`，证据失败继续抛现有 `ResponseCode.KNOWLEDGE_NOT_READY`。不在新组件中复制规则。
   - 选择原因：避免两份规则树在重构中漂移，并保持当前行为和错误契约。
   - 备选方案：为重构新增独立规则接口；放弃，因为会扩大范围并增加语义迁移风险。

3. **Case 保留长调用前后的生命周期控制。** `ShoppingAiCaseImpl` 继续负责租约、取消检查、知识指纹二次复验、SSE 进度、`turns.complete` 短事务和失败释放。新组件只能在这些边界内执行同步只读计算。
   - 选择原因：满足 SDD-13 的长调用与短事务约束，避免抽取后出现锁或租约泄漏。
   - 备选方案：把完整 `answer()` 搬到新服务；放弃，因为会模糊应用编排和事务边界。

4. **优先使用内部构造与窄数据载体，不新增外部 Bean/依赖。** 组件通过构造参数获得现有 Port/策略所需数据，返回不可变列表或记录；如需 Spring 装配，保持同模块单一实现且不改变事务代理。
   - 选择原因：减少启动配置和运行时行为变化，便于逐段回退。
   - 备选方案：引入新的共享模块或第三方库；放弃，因为本批次没有跨模块复用需求。

## Risks / Trade-offs

- [候选顺序或去重发生变化] → 以现有 32 项 Java 回归和新增候选顺序/库存边界测试锁定 lexical/semantic 合并、SKU 采样和提案选择结果。
- [引用脱敏或版本校验被弱化] → 保留现有 `KNOWLEDGE_NOT_READY` 失败边界，补错版本、错 chunk/hash、内部文档和授权变化场景。
- [抽取后意外引入事务/锁] → 组件不声明事务、不访问写端；检查长调用前后仅由 Case 完成租约与提交。
- [失败释放或取消竞态被移动] → 不移动 `ensureTurnActive`、`releaseTurn` 和 `turns.complete`；运行会话边界、SSE 和取消回归。

## Migration Plan

1. 在分支中先记录基线和 OpenSpec 任务，再新增窄职责组件与单测。
2. 逐段替换 `ShoppingAiCaseImpl` 内的等价逻辑，保持方法输入输出和调用顺序；每完成一组即运行对应回归。
3. 运行 Java、Python、前端指导脚本及仓库静态/API/DDD 检查；Docker 真实验收继续由另一会话提供证据。
4. 若任一回归显示行为变化，回退最后一次 wiring 提交即可；不需要数据迁移、Redis 清理或服务替换。

## Open Questions

无。组件接口、保留边界和验收范围已经足够支撑首批实现；后续是否引入回答 Flow 节点另开变更讨论。
