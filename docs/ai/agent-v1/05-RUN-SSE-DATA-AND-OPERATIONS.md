# 05 · Run、SSE、数据持久化与运行治理

## 1. 为什么不做 Task 仍必须保存 Run 和 Action

Run 回答“这条用户请求运行到哪里”；Action 回答“哪项业务修改是否真的提交”。两者不能合并：加购已成功但模型生成总结超时，应显示真实加购结果，而不是把业务失败回报给用户。

消费者与商户的自然切换依靠每轮范围解析，不建立常驻 Task；实际执行记录仍应持久化，以处理重试、并发、取消、实例崩溃和用户刷新页面。

## 2. 推荐的首期生命周期

为避免等待用户时持有 SDK 调用栈或占用 worker，首期采用“单条输入一轮执行，等待由结果与动作表示”的方式：

| Run 状态 | 语义 |
|---|---|
| ACCEPTED | 已持久化受理，尚未开始执行 |
| RUNNING | 有效租约持有者正在处理 |
| COMPLETED | 这一轮结束，可包含回答、澄清、待确认卡或部分结果 |
| FAILED | 本轮发生无法继续的错误；仍可能已有成功动作 |
| CANCELLED | 已接纳取消，禁止后续新动作；已提交效果不撤回 |
| TIMED_OUT | 达到执行截止时间，停止接纳新步骤 |

`outcome` 与 status 分开：ANSWER、NEEDS_INPUT、NEEDS_CONFIRMATION、PARTIAL。NEEDS_INPUT 对应结构化澄清记录；NEEDS_CONFIRMATION 对应持久化预览。用户回复或点击选项建立新的有界 Run/确认请求，关联原来源；**不是恢复一个一直运行着的 Task**。

之前讨论的 WAITING_INPUT/WAITING_APPROVAL 是产品逻辑，可以展示，但首期不要求保活一个服务器执行实例。未来真正引入工作流暂停恢复时再决定是否需要持久化 RunState。

Action 状态单独定义：PREPARED（仅需预览的动作）、SUCCEEDED、REJECTED/EXPIRED、FAILED；对执行中或结果未知的状态必须记录明确的核验策略，不能擅自重试。对于同库短事务，业务效果与 SUCCEEDED 回执同事务提交，事务未提交则不应出现“效果已发生但账本不存在”的窗口。

## 3. 同一会话的并发与防旧请求回写

推荐复用并完善已有会话轮次租约：同一 Conversation 一次只接纳一个活跃执行 Run。客户端重复提交同一 clientMessageId 返回原 Run，不算并发新消息。另一个独立新消息在有活跃 Run 时返回可理解的忙碌/取消提示，首期不做无限排队。

多个标签页不共享一个全局当前商户，UI 回复引用与 Conversation 所有权独立校验。前端用 runId/seq 丢弃旧 UI 回调；服务端用版本/租约代次阻止旧 Run 覆盖新状态。

**仅有租约超时不够。** worker 停顿后，旧 Run 可能恢复并调用工具。Tool Gateway 必须验证 Run 状态、期限、lease generation/fencing 信息及 scope；实际写动作接纳与取消/代次变更需要形成明确原子顺序。不能只在入口查一次有效，后面无条件执行。

所有外部模型和 HTTP 请求均在数据库事务之外；短事务只围绕动作接纳、业务修改与回执。不得为防并发在整段 LLM 推理期间占用行锁。

## 4. 最小持久化设计（逻辑结构，未执行 DDL）

| 结构 | 保留/新增 | 核心字段与索引要求 |
|---|---|---|
| ai_conversation | 复用 | owner、标题、轮次租约/版本；不固定唯一 agentType |
| ai_message | 复用并扩展 | conversation、seq、role、原文/结构化内容、runId、内容块来源/范围；同会话按 seq 查询 |
| ai_context_state | 推荐新增或等价扩展 | conversation、version、有界实体/约束/展示引用/分范围摘要 JSON、coveredSeq、schemaVersion |
| ai_run | 新增 | id、actor、conversation、clientMessageId、requestHash、status/outcome、deadline、lease/generation、model/prompt/toolSet版本、safeResult、timestamps |
| ai_action_execution | 新增或等价复用统一动作账本 | actionId、actor、originMessage、operation、scope、argsHash、immutableArgs、preview版本/有效期、result/status；稳定唯一约束 |
| ai_run_event | SSE 阶段新增 | runId、seq、type、最小 payload/结果引用、visibility labels、createdAt；UNIQUE(runId,seq) |
| ai_user_memory | 长期偏好阶段新增 | owner、用途/商户范围、key/value、source、revision、status、expiresAt；可删改 |

每张新增结构都对应不可替代职责；若仓库已有等价结构，先复用，不因本文名称另建。原 ai_proposal 仍服务旧推荐确认；新的通用动作账本不能随意更改旧状态语义，应通过兼容适配或明确迁移与其协作。

重要唯一性：入站去重建议 `UNIQUE(actor, conversation, clientMessageId)`；动作的稳定来源键与 actionId 都需唯一；高风险 previewId 只能消费一次；事件序列单调。NULL 商户字段的唯一键语义必须在真实 MySQL 验证，不依赖应用中“看起来没重复”。

业务/动作写入/可重放的关键动作结果事件尽量在同库事务内完成；模型文本生成成功不是这个事务的一部分。临时进度心跳无需每个 token 落库，防止消息和事件无界增长。

## 5. 为什么不能只靠 Redis

Redis 继续承担已有共享 Session、限流、执行准入等能力。可以缓存热实体索引或最近 UI 引用，但缓存丢失/过期不应改变授权结果，也不能丢掉已执行动作的真相。

Run、Action、历史及关键上下文以 MySQL 为准。Redis 异常时遵循现有安全 Session/限流的失败策略，不能自动退回本地内存凭据允许未经一致验证的请求。对于纯展示缓存可回源，但不能把权限缓存当成永远有效。

不以“600 秒 ActiveScope”定义用户权限有效期。被撤销角色即使 Redis 条目未过期也不能继续执行；历史订单引用过期也不意味着原订单消失，应重新查证。

## 6. SSE 协议和用户体验

推荐 `POST /api/v1/ai/runs` 受理，再通过 `GET /api/v1/ai/runs/{runId}/events` 消费事件；前者使用 Session/CSRF，后者验证会话和 Run 归属。内部模型密钥、Run capability 不传浏览器。

事件信封建议：

```json
{
  "runId": "run_8",
  "conversationId": "conv_1",
  "seq": 4,
  "type": "action.result",
  "data": {"actionId": "action_7", "state": "SUCCEEDED", "message": "已加入两瓶"}
}
```

事件类型建议：run.accepted、run.started、tool.status、result.card、clarification.required、action.preview、action.result、message.delta、message.done、run.completed、run.failed、run.cancelled。type、seq、version 需要统一，不能前后端分别猜测。

### 6.1 真实流式，不伪造成功

工具开始/查询进度可以立即发送；真实结构化商品/订单卡片在工具结果校验后发送；写入成功只在 Java 动作回执成功后发布。

对涉及价格、状态、权限及操作结果的自然语言，按已经验证的结果片段生成/校验，不把模型未经核验的“已完成”“库存还剩…”直接流给用户。可安全生成的公开解释可以真 token/块流式；不适合安全增量校验的答案允许先展示进度和卡片，最后发布完整正文。

**SSE 事件流与模型 token 流分别验收。** 不能先生成完整答案，再拆字发送就宣称模型端真流式；也不能为了真 token 流牺牲事实校验。供应商仅工具流兼容不足时可先缓冲参数，工具执行仍须等待参数完整及校验通过。[S2]

### 6.2 断线、回放与撤权

SSE 断开只代表传输断开，不自动创建新 Run，不自动重跑动作。客户端凭 lastEventId/seq 续读；事件过期时用 GET Run 取授权后的快照，而不是重新 POST 一次操作。

连接建立、重连和敏感事件输出均需校验可见性。撤权后不能直接重放已经保存的商户明细 payload；保存最小结果引用和范围标签可在读取时过滤。终态到达立即关闭客户端 EventSource，避免浏览器自动重连形成空转。

## 7. 取消、超时与崩溃：明确定义竞态

用户取消由 POST 明确发起。尚未接纳的工具/动作禁止继续；已经提交的操作显示真实成功结果。取消与写事务的竞争按服务端接纳/提交顺序裁决：取消先成功阻断新动作，动作先合法提交则不能报告“什么都没发生”。

实例崩溃后，过期 Run 由恢复检查标为失效/待核验，查询已存在动作账本与关键事件。首期不自动重新跑整个模型计划，尤其禁止对未知结果的写操作发新 actionId。读取结果无需恢复模型私有推理。

故障后需要补偿时，补偿是独立业务命令并有权限、幂等与审计；不是让模型执行一段“反向 SQL”。购物车添加成功但回答失败，优先补展示回执，不自动删购物车。

## 8. 预算、容量与模型容错

POC 可以从以下保守配置开始测试：每 Run 模型轮次上限 6、工具调用上限 12、总时长 60 秒、只读瞬态错误最多额外重试 1 次。它们是**实验起点，不是已测容量或发布承诺**；模型上下文预算、各阶段超时、单用户/全局并发最终以实测锁定。

所有子调用使用同一剩余 deadline，不能每个步骤都重新获得完整 60 秒。max_turns 不等于最大工具数、Token 或费用预算，需要分别计数。缺少 usage 时标记 UNKNOWN/估算，不当作 0 成本。

只用经过同样工具、隐私、质量验证的备用模型；不能在内部资料请求失败时自动切到未经批准的外部提供商。切换前先确认哪些动作已发生；不重放已成功写入。

在小规模环境使用受限 executor/连接池、模型并发配额和独立回调处理资源，避免 Java 等待 Python 的全部线程耗尽导致 Python 无法回调 Java。队列长度和拒绝策略需可观测；不以无上限异步任务堆积解决拥塞。

## 9. Trace 与业务审计的分工

SDK 提供模型/工具 Trace，官方说明默认启用且可导出到 OpenAI；本项目必须显式控制是否外发、敏感内容开关和 processor 配置。[S4] 首期以受控日志/Trace 元数据为基线：runId、调用工具、耗时、tokens、错误类别、scope 摘要、提示词/工具/模型版本，不包含明文订单详情或凭据。

`trace_include_sensitive_data=False` 只是其中一项控制：自定义 metadata、异常文本、日志和自定义 span 仍需独立脱敏测试。接入替代 processor 时检查是否还保留默认 exporter，避免双重上传。

Java/Python 用 correlationId/traceId 关联；SDK Trace 不是天然覆盖 Java DAO/MySQL 的全链路，后续按需要加 OpenTelemetry。无论 Trace 平台宕机与否，业务动作账本不能丢；Trace 可以有界缓冲/丢弃低价值细节，不能阻塞关键事务。

## 10. 版本与灰度

保存 promptVersion、toolSchemaVersion、routingPolicyVersion、model/provider、SDK lock、contextSchemaVersion。真实回归通过后小流量启用；按消费者只读、消费者低风险写、商户只读、后续高风险写分别开关。

影子模式只能运行只读或验证不写分支，不得影子执行加购。回滚可以关新 Agent 保留旧 JSON 路径，但已有 Action 回执和 pending preview 仍可查询、失效或正确处理，不能回滚数据库后丢失执行真相。

[S2]: https://openai.github.io/openai-agents-python/models/
[S4]: https://openai.github.io/openai-agents-python/tracing/
