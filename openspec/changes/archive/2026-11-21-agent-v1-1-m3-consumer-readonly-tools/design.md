# Design

## Context

M2 已有 `AgentRunCase`、`AgentToolInvocationCase`、租约复核和 `search_products`。知识侧已有 `IKnowledgeCase.readableScope` 与回答证据复核，但 `ShoppingAiCaseImpl.debugRetrieval` 只允许后台知识管理身份；订单侧 `IOrderQueryCase.mine` 已把买家限定为当前 actor，却返回包含取货、售后和事件的完整 `OrderReadModel`。Python Runtime 的工具集合目前只有 `search_products`，因此新工具必须先在 Java 侧冻结边界，再与 Python 共同启用。

## Goals / Non-Goals

**Goals:**

- 在 Java Case 层提供可单元测试的消费者知识问答和本人订单窄投影能力。
- 复用现有知识授权、订单查询、Run 租约和幂等能力，不引入第二套权限或租约。
- 让新工具结果不携带可变聚合、商户后台字段或交易写入口，并为后续 Runtime 接线提供稳定 schema。

**Non-Goals:**

- 不开放 Controller、公开 Agent API、OpenAPI 或新的用户入口。
- 不新增购物车、下单、支付、库存、售后写操作或数据库迁移。
- 不在 Java 未与 Python schema 同步前把新工具加入 M2 的可执行白名单。
- 不把本地模型或协议测试当作 NVIDIA、讯飞、Embedding、Milvus 的真实质量验收。

## Decisions

### 1. 先新增窄的 Case 结果，再改 Runtime 注册表

Java 新增内部只读用例及不可变结果模型：知识结果只包含回答/检索状态、有限引用摘要和耗时；订单结果只包含订单 ID、状态、金额、创建时间、商户展示名及商品标题/规格/数量/成交单价。结果不引用 `OrderAggregate`，不携带 `PickupVO`、`AfterSaleVO` 或事件时间线。

先做 Case 与单测，暂不修改 `AgentToolRegistry` 的可执行集合。这样 Python 仍仅支持 `search_products`，不会出现 Java 宣布了工具而 Runtime 不能生成其 schema 的半启用状态。

备选方案是直接把两个名称加入现有 `AgentToolInvocationCaseImpl`；该方案会在 Python 未同步时造成协议不一致，也容易把后台 `debugRetrieval` 的权限误用到消费者，因此不采用。

### 2. 知识问答在 Java 侧重新计算授权快照

新增只读 Case 复用 `IKnowledgeCase.readableScope` 和现有 `IAiEnginePort` 查询链路。调用前要求 active actor，构造 `AiQueryEntity` 时只传 scope 允许的文档；模型返回后再次读取 scope 并用现有证据校验器过滤引用。长模型调用不持有数据库事务。消费者路径不调用 `requireDebugAccess`，因为该检查是后台知识调试权限，而不是消费者公共知识读取权限。

备选方案是调用 `ShoppingAiCaseImpl.debugRetrieval`；它会拒绝普通消费者，不能满足 M3 的身份语义。调用 `chat` 会写入会话和 Proposal，也不符合只读要求。

### 3. 订单读取只允许 actor 作为 buyer

新增只读 Case 调用 `IOrderQueryCase.mine(actor, state, page, size)`，在 Case 内限制页大小和允许状态值，再把 `OrderReadModel` 映射成不可变 Agent 摘要。不得接受 merchant、buyer 或管理后台筛选；如需单订单详情，先复用 `IOrderQueryCase.detail` 的 actor 归属检查，再映射同一窄结果。

订单查询仍由现有 `@Transactional(readOnly = true)` Case 执行；Agent Case 不开启长事务，也不改写订单、库存、售后或支付数据。

### 4. Python 同步是独立启用门槛

后续 Python 切片必须把 `knowledge_qa`、`get_my_orders` 的 JSON Schema、结果字段、错误分类和调用上限加入 Runtime fixtures，并与 Java contract test 共享版本。Java 只在双方版本一致后扩展 `AgentToolRegistry` 和调用映射；schema mismatch 继续安全失败，旧导购保持可用。

## Risks / Trade-offs

- [知识回答复用 AI 引擎仍可能耗时] → 不持有数据库事务，限制问题长度和模型截止时间，作用域变化时丢弃引用并返回可解释降级。
- [订单 Case 当前从聚合组装完整视图] → 首批只在 Case 层做窄映射；若性能成为瓶颈，再为查询 Repository 增加直接投影并以测量结果决定。
- [Java/Python 两阶段上线产生暂时能力差异] → 不提前注册新工具；用版本化 fixtures、contract test 和显式启用开关保证原子切换。
- [模型可能索要私有文档或商户范围] → Java 重新计算 scope、丢弃越权引用并拒绝未声明参数，模型不能授予自身权限。

## Migration Plan

1. 先合入 OpenSpec、Java 窄结果/Case 和单测，保持 Runtime 仅 `search_products`。
2. 在独立切片同步 Python tool schemas、真实/loopback fixtures 和 Java 调用映射；通过权限、幂等、失败和无写入测试后再启用新工具。
3. 发现协议或性能问题时关闭新工具版本/开关；不删除既有 Run、调用摘要、订单数据或修改已发布迁移。
