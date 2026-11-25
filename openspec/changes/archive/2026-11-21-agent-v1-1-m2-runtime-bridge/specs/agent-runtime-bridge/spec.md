# Spec Delta

## Purpose

为校园商城提供可审计的 Java/Python Agent Runtime 内部桥接，使模型只产生受控的原生工具调用或回答，由 Java 复核 Scope、权限和业务事实，并在故障、重试和联调验收时保持安全且可重现的行为。

## ADDED Requirements

### Requirement: Runtime 入口必须是内部双向认证协议

Python Runtime SHALL 只接受固定的内部 POST 协议，并同时校验服务密钥、Run capability credential、请求 ID 和协议版本；该入口 MUST 不注册为公开用户 Agent API、浏览器路由或 OpenAPI 契约。

#### Scenario: 合法的 Java Runtime 调用

- **WHEN** Java 使用配置的服务密钥、有效 Run capability、唯一 request ID 和受支持的协议版本调用内部 Runtime
- **THEN** Runtime 接受请求并返回符合协议的结构化结果，同时保留 request ID 与 Run ID 的关联

#### Scenario: 缺少或错误的内部凭据

- **WHEN** 请求缺少服务密钥、capability credential、request ID，或任一凭据不匹配
- **THEN** Runtime 拒绝请求，不执行模型或工具，并返回不包含凭据或下游正文的稳定错误类别

#### Scenario: 用户直接访问 Agent Runtime

- **WHEN** 浏览器或公开 API 客户端访问该内部路径，或尝试使用旧用户会话代替服务凭据
- **THEN** 请求被拒绝，现有 `/ai/chat`、SSE 和 Proposal 契约保持不变

### Requirement: Run capability 与 Scope 必须按服务端快照传递

每次 Runtime 请求 MUST 携带 Java 创建的 Run ID、不可变 Scope 快照、允许的只读工具定义和当前 `turn_token/turn_expires_at` 租约引用；Python MUST 不得依据模型文本扩大用户、商户、权限或工具范围。

#### Scenario: 消费者 Scope 传递

- **WHEN** Java 发送消费者 Scope、公开商品搜索权限和有效租约
- **THEN** Runtime 只使用请求中声明的 Scope 与工具集合，并把 Run ID、身份类型和租约状态带入结果

#### Scenario: 商户范围被篡改

- **WHEN** 请求中的 merchant ID、权限集合或 allowed tools 与 Java 创建 Run 的快照不一致
- **THEN** Runtime 拒绝该轮，不读取或推断其他商户私有数据

#### Scenario: 租约过期

- **WHEN** 请求到达时 `turn_expires_at` 已过期，或 Java 在本轮开始前复核租约失败
- **THEN** Runtime 拒绝模型和工具执行，Java 将 Run 标记为可重试的失败状态且不产生业务写入

### Requirement: 模型结果必须区分原生 Tool Calling 与最终回答

Runtime SHALL 返回版本化 JSON 结果，状态只能表示待执行的原生工具调用、最终回答或安全失败；工具调用 MUST 包含唯一 call ID、白名单工具名和结构化 JSON 参数，不得把看似工具调用的普通文本当作可执行命令。

#### Scenario: 模型请求只读工具

- **WHEN** 模型产生原生 `search_products` Function Calling，参数符合已声明 JSON Schema
- **THEN** Runtime 返回 TOOL_CALLS 结果及 call ID、工具名和参数，Java 可以在下一轮提交经过复核的工具结果

#### Scenario: 模型直接回答

- **WHEN** 模型没有工具需求并产生完整回答
- **THEN** Runtime 返回 FINAL 结果、回答文本、证据状态和用量摘要，不伪造工具调用

#### Scenario: 伪造的文本工具调用

- **WHEN** 模型只输出包含工具名称或 JSON 片段的普通文本，未产生原生结构化调用
- **THEN** Runtime 将其作为回答或安全失败处理，Java 不执行任何工具

#### Scenario: 非法 Runtime 响应

- **WHEN** 响应缺少状态、Run ID、call ID、工具参数，或包含未声明字段/超出大小上限的正文
- **THEN** Java 拒绝该响应并映射为安全的 AI 不可用错误，不把部分内容交给用户或工具层

### Requirement: 工具权限与业务事实必须由 Java 裁决

Java SHALL 在每个工具调用前重新校验 Run capability、Scope、工具白名单、参数契约和资源归属，并从 Java/MySQL 查询当前商品、SKU、价格、经营资格和库存；Python、模型和向量索引不得授予写权限或决定交易事实。

#### Scenario: 合法的商品只读搜索

- **WHEN** Java 收到已授权的 `search_products` 调用并复核当前租约、商户范围及参数
- **THEN** Java 返回经过实时事实复验的只读摘要，结果标记为已由 Java 事实验证

#### Scenario: 模型请求写入动作

- **WHEN** 模型请求加购、下单、改库存、支付或其他未注册工具
- **THEN** Java 拒绝调用，不访问相应写入能力，并引导既有 Proposal 确认流程

#### Scenario: 候选与事实不一致

- **WHEN** Python 或 Milvus 返回的候选包含下架商品、停用 SKU、失效商户、价格版本变化或不可售库存
- **THEN** Java 删除或标记该候选，不把它作为交易事实返回，也不产生购物车、订单、库存或支付写入

### Requirement: 工具结果续接必须有界且幂等

同一 Run 的每次 Runtime 往返 MUST 使用唯一 request/invocation key 和 continuation ID；重复提交同一有效载荷 MUST 重放已保存结果，载荷不同或超过工具调用/往返上限 MUST 被拒绝。

#### Scenario: Java 回传工具结果继续生成

- **WHEN** Java 复核并执行工具后，使用原 continuation ID 回传只读结果和 call ID
- **THEN** Runtime 只继续该 Run 的上下文，返回下一组原生调用或最终回答，不重新解释 Scope

#### Scenario: 重复提交已完成调用

- **WHEN** 网络重试以相同 Run、request key、call ID 和参数重复提交已完成的只读工具调用
- **THEN** Java 重放原工具回执，不再次访问商品、库存或其他下游能力

#### Scenario: 幂等键复用不同载荷

- **WHEN** 相同 key 被用于不同问题、Scope、工具参数或 continuation ID
- **THEN** 请求失败并返回冲突类别，不执行模型或业务工具

#### Scenario: 超出循环上限

- **WHEN** 单个 Run 的模型工具往返次数或工具调用数量超过配置上限
- **THEN** Java 终止本轮并返回可重试的安全失败，不继续调用下游

### Requirement: 超时、限流和下游错误必须安全降级

Java Runtime adapter MUST 对连接失败、整体截止时间、429、5xx、401/403、422 和非法响应做有界处理；外部只返回稳定业务错误类别，日志和追踪不得包含凭据、完整提示词、工具参数正文或下游响应正文。

#### Scenario: Runtime 超时

- **WHEN** Python 未在 Java 设定的整体截止时间内完成响应
- **THEN** Java 取消当前 HTTP 等待并返回 AI 不可用结果，Python 释放模型/准入资源后才结束实际执行

#### Scenario: Runtime 返回 429

- **WHEN** Python 或其模型依赖返回 429
- **THEN** Java 不盲目重放可能触发工具的请求，向调用方返回可区分的暂不可用类别，并记录状态码类别和耗时

#### Scenario: Runtime 返回 5xx 或连接断开

- **WHEN** Python 返回 5xx、连接中断或响应超过大小上限
- **THEN** Java 将本轮置为失败或降级，不提交任何业务写入，也不把下游正文透传给用户

#### Scenario: 内部协议认证失败

- **WHEN** Python 返回 401/403，或 Java 发现 capability 与 Run 不匹配
- **THEN** 本轮被拒绝且不重试；日志只记录 request ID、Run ID、错误类别和状态码

### Requirement: 联调证据必须可区分真实状态

真实 HTTP harness MUST 启动隔离的 Java/数据库读取链路与 Uvicorn Runtime，验证原生 Tool Calling、Scope/租约、幂等、故障映射和无业务写入；报告 MUST 明确标记 REAL、STUB、DEGRADED 或 NOT_RUN，外部模型和 Milvus 未运行时不得宣称通过。

#### Scenario: 真实 loopback 联调完成

- **WHEN** harness 通过 Java Run/Tool Gateway 调用 Uvicorn 内部 Runtime，并验证商品事实回执和错误场景
- **THEN** 报告记录协议版本、endpoint、Run/工具调用数量、耗时和清理证据，且凭据、提示词和下游正文已脱敏

#### Scenario: Java 或隔离依赖不可用

- **WHEN** Java 服务、隔离数据库或所需 Runtime 依赖未启动
- **THEN** harness 返回 NOT_RUN 或 DEGRADED，并列出原因；不能用单测、旧 `/v1/query` 结果或语法解析替代真实桥接验收

#### Scenario: M1 外部能力未验证

- **WHEN** 本变更只运行本地模型 stub、旧 RAG 或无 Milvus 的协议测试
- **THEN** 报告不得把结果记为 M1 4.3/4.4 通过，外部模型、Embedding、Milvus 和真实质量基线单独记录

