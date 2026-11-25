# Design

## Context

M2 Gateway 已在 Java domain/case 中提供不可变 `AgentRunVO`、`AgentScopeVO`、租约复核和 `search_products` 只读执行；`IAgentRuntimePort` 目前仍无基础设施实现。Java 已有固定地址的 `AiGatewayService`，使用 `X-Service-Key`、`X-Request-ID`、JDK HTTP Client、响应体上限和安全日志，但它只覆盖旧 `/v1/query` 等兼容接口。Python 的 `AgentRuntime` 当前把模型决策和本地 ToolRegistry 执行放在同一进程内，现有测试明确不暴露公开 Agent 路由。

本变更把 Runtime 变成服务间的决策端：Java 仍是 Run、Scope、权限、商品事实和工具执行的唯一裁决者；Python 只负责模型调用、原生 Function Calling 解析和回答生成。AI HTTP 调用不得持有 MySQL 事务或行锁，旧导购接口继续使用原协议。

## Goals / Non-Goals

**Goals:**

- 冻结一个仅供 Java 调用的版本化 Runtime turn 协议，支持首轮问题、工具结果续接和结构化最终结果。
- 用窄的 domain Port + infrastructure adapter 接入 Python；不把 HTTP、JSON 或服务凭据泄漏到 domain。
- 让每一轮在 Java 侧重新复核 Run capability、Scope、租约、工具白名单和幂等键。
- 复用已有安全 HTTP 传输约束，覆盖超时、429、5xx、非法响应和脱敏日志。
- 用单测和真实 loopback harness 证明原生 Tool Calling、Java Tool Gateway、无业务写入及故障边界。

**Non-Goals:**

- 不开放公开 Agent Trigger、用户入口、OpenAPI 文档或浏览器可调用路由。
- 不改变 `/ai/chat`、SSE、Proposal、购物车、订单、库存和支付协议。
- 不让 Python、模型或 Milvus 直接访问 Java 业务库，也不在本变更加入写工具、Action 账本或交易事务。
- 不把本地 stub、旧 RAG、CI 通过或协议 harness 结果当作 M1 4.3/4.4 的真实 NVIDIA、讯飞、Embedding 或 Milvus 验收。

## Decisions

### 1. 使用独立的内部 Runtime turn 路径和双重认证

Python 增加固定的 `POST /internal/v1/agent/runtime/turn`，应用文档与 OpenAPI 关闭该路径；旧 `/v1/query` 继续由现有兼容处理器提供服务。请求必须带 `X-Service-Key`、`X-Agent-Capability`、`X-Agent-Capability-Signature` 和 `X-Request-ID`。

Java 在发送前使用 `IAgentRunRepository`/Run Case 校验 capability 的哈希、Run 状态、Scope 和租约。为使 Python 也能拒绝跨 Run 重放，签名使用现有服务密钥对 canonical `runId|requestId|turnExpiresAt` 做 HMAC-SHA256；Python 只保存配置中的服务密钥并校验签名、请求 ID 格式和时间窗口，不保存 Run capability。原始 capability 和 `turn_token` 只在受控进程内存中使用，禁止进入日志、追踪和响应。

选择独立内部路径而不是复用 `/v1/query`，因为旧接口的 payload 和结果语义允许 RAG 兼容降级，不能作为原生 Tool Calling 的可审计契约。选择服务密钥加 Run 签名而不是只依赖网络隔离，避免误暴露内部端口后可跨 Run 调用。

### 2. 以不可变 command/result 扩展 Runtime Port

domain 侧新增不包含 HTTP 类型的不可变 command/result：

- command 包含 Run ID、request ID、阶段 `START|CONTINUE`、问题或有限历史、Scope 快照、允许的只读工具定义、continuation ID，以及 Java 已复核的工具结果。
- capability 明文作为调用上下文传入 Port，但不放入 `AgentRunVO` 快照、持久化 PO 或普通日志字段。
- result 只允许 `TOOL_CALLS`、`FINAL`、`FAILED` 三类，包含 Run ID、continuation ID、call ID、工具名、严格 JSON 参数、回答、evidenceStatus、usage、duration 和稳定 errorCode。

Port 由 Java case 在非事务上下文调用；adapter 负责序列化、HTTP 截止时间、响应上限和错误分类。这样可以替换 HTTP 客户端或 Runtime 实现，而不让 domain 依赖 Spring、Jackson 或 FastAPI。

### 3. Python Runtime 只做模型决策，Java 执行工具

内部 handler 调用一个“决策模式”的 Runtime。它复用现有模型客户端、ToolCallAccumulator、大小限制和 evidence 记录，但只把已注册只读工具的 JSON Schema 提供给模型，解析后返回 Tool Call；不会在 Python 进程执行 `search_products` 或其他业务 handler。

Java 收到 `TOOL_CALLS` 后：

1. 短事务外复核 Run capability、租约、Scope 和工具白名单；
2. 通过已有 `AgentToolInvocationCase` 执行 `search_products`，由 Java/MySQL 重新获取商品、SKU、价格、经营资格和库存；
3. 在短事务中保存幂等调用摘要和只读结果；
4. 以同一 continuation ID 把脱敏后的结果回传 Python，直到得到 FINAL 或达到上限；
5. 在短事务中完成或失败 Run。

工具回执仅传递不可变候选和事实校验状态。模型要求加购、下单、改库存或支付时直接拒绝，不触发 Proposal 之外的写入。单个 Run 限制工具调用总数和往返次数；不对可能重复工具执行的 HTTP 请求做透明自动重试。

### 4. Scope 与租约以 Java 为权威，Python 做边界校验

请求体中的 Scope 只由 Java 从当前 Run 生成，包含 userId、identityKind、identityId、authorizedMerchantIds、permissions、conversationId 和 turnExpiresAt；turn token 作为不可记录的租约引用传递，Python 仅检查存在性和时间，不据此授予额外权限。Java 在每个模型轮次和每个工具调用前重新读取当前租约，确保 600 秒租约仍有效。

Python 不接受模型自报角色、merchantId、权限或 URL 来覆盖 Scope。Scope 指纹、allowed tools 和 Run ID 参与 request fingerprint；不一致的续接请求返回协议冲突。这样既保持现有唯一 `turn_token/turn_expires_at` 规则，也避免在 Python 侧另建一套租约。

### 5. 复用传输边界但隔离旧接口错误语义

新 adapter 可复用 `AiGatewayService` 已验证的 JDK HTTP 约束：固定配置地址、HTTP/1.1、连接和总时限、1 MB 响应上限、禁止重定向、服务密钥头、MDC request ID 和只记录错误类别。Runtime adapter 不直接复用旧 `query` 的 DTO 或 422 降级逻辑，以免把错误语义混入旧导购。

错误分类固定如下：

- Java 在 Run/Scope/capability 复核失败：使用现有 `AUTH_FORBIDDEN`、`STATE_CONFLICT` 或 `REQUEST_CONFLICT`；
- Python 401/403、协议 422、非法 JSON、Run/continuation 不匹配：对外统一 `AI_UNAVAILABLE`，内部日志仅保留类别和状态码；
- Python 429、5xx、连接失败和总时限超出：返回 `AI_UNAVAILABLE`，不自动重放已可能产生 Tool Call 的请求；
- 响应被截断、状态与字段不一致或含未声明字段：立即失败并丢弃正文。

Java 取消 HTTP 等待后，Python 必须让 ExecutionGate/模型许可保持到实际工作线程结束，再释放资源。日志不写入 capability、turn token、问题正文、工具参数和下游异常正文。

### 6. 兼容地配置、灰度和回退

新增 `campus.ai.agent-runtime.enabled=false`、固定内部路径和独立超时/往返上限配置；默认关闭。启用时只允许已有受控 Case/测试 harness 调用，公开 Trigger 不读取该开关。运行时适配失败时，调用方可以明确标记 DEGRADED 并回到既有 RAG/导购链路，但不得用提示词伪造 Tool Calling。

回滚只需关闭开关或移除 adapter bean；不删除既有 `ai_run`/调用记录，不改旧接口，不回滚已发布迁移。若协议版本不兼容，Java 直接失败并保留 Run 失败摘要，等待兼容版本部署。

### 7. 测试和真实 HTTP harness 分层

- Python 单测使用 TestClient/受控模型 stub 验证路由认证、协议 schema、native tool call、continuation、非法响应、429、5xx、超时和脱敏。
- Java 单测使用 loopback HTTP server 或等价受控 transport 验证 command 序列化、签名、响应映射、取消、幂等和不把正文写入日志。
- 集成 harness 启动隔离 Uvicorn，并连接真实 Java loopback Run/Tool Gateway；商品事实来自隔离 MySQL 或现有安全测试 fixture，不复用生产库，不使用 `FLUSHDB/FLUSHALL`。输出 `docs/testing/evidence/` JSON，记录 REAL/STUB/DEGRADED/NOT_RUN、endpoint、Run/工具调用数量、耗时和清理证据。
- Java 未启动、隔离依赖缺失或真实外部模型/Milvus 未配置时，harness 必须返回 NOT_RUN/DEGRADED；该结果不覆盖 M1 4.3/4.4。

## Risks / Trade-offs

- [Runtime 与 Java 之间增加一轮或多轮 HTTP 往返] → 限制工具次数、往返次数和整体截止时间；不持有数据库事务，超时安全失败。
- [capability/turn token 在进程内存中短暂传递] → 只通过受控 header/body 传递，使用 HMAC 请求绑定，禁止日志和持久化明文，复用现有 Run 过期校验。
- [Python 当前 Runtime 同时负责本地工具执行] → 新增明确的决策模式并保留原有本地单测；内部路径不调用 Python 业务 handler。
- [Runtime 重启会丢失未完成 continuation] → Java 持久化已完成工具回执；发现 continuation 无法恢复时安全失败并允许用户重新创建 Run，不重放已完成工具。
- [与旧 `AiGatewayService` 的配置和错误语义混用] → adapter 独立 DTO/错误映射，只复用底层 HTTP 安全约束；旧 `/v1/query` 代码和契约不变。
- [本地 stub 误被解释为外部真实验收] → harness 和报告强制记录 REAL/STUB/DEGRADED/NOT_RUN，并把 M1 外部模型、Embedding、Milvus 证据单独留在原验收范围。

