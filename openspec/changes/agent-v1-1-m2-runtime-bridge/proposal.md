# Proposal

## Why

M2 Gateway 已在 Java 侧建立受控 Run、Scope 和只读工具执行边界，但 `IAgentRuntimePort` 尚未连接真实 Python Runtime；当前 Python Runtime 仍是本地实验入口，Java 不能通过可审计协议获得原生 Tool Calling 决策。现在补齐内部受控桥接，可以验证 Java 负责权限与业务事实、Python 负责模型理解与输出的边界，同时保持旧导购兼容契约稳定。

## What Changes

- 新增仅供 Java 服务间调用的 Agent Runtime HTTP 协议，冻结请求、工具调用/工具结果续接、最终响应、版本和请求关联字段。
- 实现 `IAgentRuntimePort` 的 Java 基础设施适配器；通过既有 AI 服务地址与服务密钥访问私有 Runtime 路径，不把该路径注册为公开用户 Agent 路由。
- 将 Java 生成的 Run capability credential、Run ID、用户身份摘要、Scope、允许工具定义和当前 `turn_token` 租约引用传给 Python；Python 仅校验协议完整性并回传决策，不获得交易写权限。
- 采用有界的模型决策循环：Python 只能返回原生结构化工具调用或最终回答；Java 重新校验 Run/Scope、调用 `AgentToolInvocationCase`，再将只读工具结果回传 Python。
- 统一超时、连接失败、429、5xx、401/403、422 和非法响应的安全映射；日志只记录 request ID、Run ID、状态类别和耗时，不记录凭据、完整提示词或下游正文。
- 增加 Java 单测、Python 协议单测和真实 loopback HTTP harness，覆盖原生 tool call、续接、未知工具/缺失参数、租约过期、重复调用、超时、429、5xx、脱敏与无业务写入。
- 保持 `/ai/chat`、SSE、Proposal、购物车、订单、库存和支付 API 不变；不开放公开 Agent 入口，不实施 M3 直接加购或 Action 账本。
- 验收报告明确区分代码完成、自动测试通过、真实 HTTP harness 结果和外部模型/Milvus 结果；不把本变更宣称为 M1 4.3/4.4 通过。

## Capabilities

### New Capabilities

- `agent-runtime-bridge`: Java 与 Python Agent Runtime 之间的内部认证、Scope/租约传递、原生工具调用续接、结果映射、错误降级和可验证 HTTP 联调边界。

### Modified Capabilities

- 无。

## Impact

- Java `campus-shopping-domain` 的 `IAgentRuntimePort` 及不可变 Runtime command/result 模型；`campus-shopping-infrastructure` 的 HTTP 适配器、配置和脱敏错误映射；`campus-shopping-case` 的 Run 编排与工具结果续接。
- Python `ai-service` 的内部 Runtime route/协议模型、模型决策循环和测试 harness；保留现有 `/v1/query` 兼容路径。
- 新增内部协议契约测试、Java/Python loopback harness 和 `docs/testing/` 证据记录；不新增公开 OpenAPI 用户接口，不新增交易表或写入迁移。

