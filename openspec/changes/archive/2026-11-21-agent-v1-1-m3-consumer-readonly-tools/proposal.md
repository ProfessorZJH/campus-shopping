# Proposal

## Why

M2 已让 Java 成为 Run、工具权限和商品事实的裁决方，但 Runtime 目前只有 `search_products`。消费者仍无法在同一受控 Run 中读取本人订单或获得经过当前知识授权复核的知识回答；直接复用后台调试链路还会把商户管理权限误当成消费者能力。现在需要先冻结只读边界，再按可验证切片扩展。

## What Changes

- 新增消费者只读 Agent 能力契约：保留 `search_products`，增加 `knowledge_qa` 与 `get_my_orders` 的输入、结果和失败边界。
- Java 以当前登录消费者为唯一订单查询主体，返回窄的订单摘要；不得把商户后台字段、取货详情、售后时间线或可变订单聚合直接交给模型。
- 知识问答只使用 Java 重新计算的 `readableScope`，在模型调用前后复核授权快照和引用；模型与向量索引不能扩大可读范围。
- 保持既有 Proposal 确认加购、购物车、订单写入和支付 API 不变；本变更不开放公开 Agent 入口、不新增交易迁移。
- 先实现 Java Domain/Case 的窄投影和权限单测；Python Runtime 工具白名单、JSON Schema 与真实模型联调作为后续同步切片，未同步前不得把新工具注册为可执行工具。

## Capabilities

### New Capabilities

- `agent-consumer-readonly-tools`: 受控 Run 内的消费者知识问答和本人订单只读工具边界。

### Modified Capabilities

- 无。M2 Runtime bridge 的既有协议行为保持兼容；新工具只有在 Java/Python 协议同步后才可启用。

## Impact

- Java `campus-shopping-domain` 增加不可变的消费者只读结果/工具契约，`campus-shopping-case` 增加只读 Case 组合既有知识授权和订单查询能力。
- `AgentToolInvocationCase`、Runtime Tool Schema 和 Python Runtime 需要后续同版本扩展；首批 Java 切片不改公开 Trigger、OpenAPI、旧 `/ai/chat` 或交易表。
- 测试覆盖消费者越权、知识范围变化、订单摘要字段泄漏、空结果、参数边界和无写入；真实 NVIDIA、讯飞、Embedding、Milvus 质量验收另行记录。
