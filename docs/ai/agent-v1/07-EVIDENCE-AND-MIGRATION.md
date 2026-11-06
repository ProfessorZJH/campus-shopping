# 07 · 证据、旧稿差异与未验证事项

## 1. 本轮读取的项目基线

读取时间：2026-11-06。PR #55 读取时：open、Draft、未合并；HEAD `c95cf0db755e34ccde21e08bea3b17d1db26c2da`，base `45ccbd14432d60a9ab20e5a75c91a7d3641dfc42`。该 PR 当时变更一个 Agent SDD 文件。[R1][R2]

这部分记录的是整合初稿生成时的历史快照；随后本版本作为 PR #55 的 Draft 文档更新提交。原 PR 设计被精简索引替代，未修改业务代码、未合并或部署。

核对到的项目事实：

| 事实 | 证据及边界 |
|---|---|
| 现行目标为多商户校园交易、模拟支付、到店自提 | PRD 仍排除真实资金、物流、优惠券等；本包不擅自扩展 [R3] |
| 同一用户可兼有消费者和多个商户成员身份 | PRD 的身份关系与 RBAC；不是互斥的账号枚举 [R3][R5] |
| 浏览器认证是 Session + Cookie + CSRF | `SessionSecurityConfig` 使用 HttpSessionSecurityContextRepository、SessionCreationPolicy.IF_REQUIRED、CSRF；不是 JWT [R6] |
| 当前存在具体权限检查能力 | `AccessServiceImpl.requirePermission` 查询账号/成员当前有效性并按权限码判断 [R4] |
| 改价权限不是随意命名的 product.manage | 当前 SDD 为 product.write 同时需要 product.read；售后和库存有独立权限 [R5] |
| 所读 Python 依赖清单尚未包含 Agents SDK/LangChain/LangGraph | requirements.txt；此证据只说明该依赖清单，不证明外部部署环境实际安装情况 [R7] |
| 原 PRD 仍要求 AI 加购用户确认 | 这是新设计直接加购上线前必须修改的行为契约，不因本包交付而自动生效 [R3] |

本轮不是全仓安全审计，也没有核验新分支之外的所有代码、数据库部署和生产配置。

## 2. 对 PR #55 的具体收敛建议

| 旧稿/前面讨论 | 本包处理 | 原因 |
|---|---|---|
| 用 Task/Task Context 解决身份切换 | 首期改为每轮 Scoped Run + 证据关系；Task 是后续流程演进选项 | 身份切换不要求常驻任务生命周期 |
| 逐轮动态路由可能被理解为无状态 | 明确保留来源消息、实体、约束、展示集合和动作回执 | 无状态会丢失条件和恢复能力 |
| 依赖 conversation.agentType 隔离 | Conversation 不固定角色；内容块/实体按来源范围，Run 按本轮范围 | 一个窗口可跨多个业务视角 |
| 一个实体只有一个 scope | 同一实体允许多视角，字段投影独立鉴权 | 本人也可能购买自己经营店铺的商品 |
| 所有含糊只读自动查询所有店铺 | 默认必要澄清，明确汇总才分店查；少量低敏概览有条件允许 | 有权限不等于此次有必要访问全部数据 |
| 系统保证“无损结构化事实” | ID/数字精确保留；语义条件提取仍需原文与评测 | 结构化格式不消除模型理解错误 |
| SDK Guardrails/动态工具是安全核心 | Java 真实执行链是最终边界，工具过滤是前置约束 | 模型或路由误选不能绕过业务权限 |
| runId 绑定 actor 即足够 | 内部服务身份 + 短效受限 capability + actor/scope/租约绑定 | runId 只是标识，不是执行凭证 |
| WAITING 状态必须一直保活 Run | 首期完成本轮并返回 NEEDS_INPUT/CONFIRMATION，新输入再开 Run | 不持有 SDK 栈或线程等待用户 |
| 加购成功后生成回答 | 单独记录实际 action 结果，回答失败不改变业务事实 | 用户重试不能造成重复增量 |
| SDK 默认 Trace 可直接使用 | 生产显式管控默认导出，脱敏、字段白名单及自定义 processor 检查 | 不将内部订单信息无意发往外部平台 |

建议修改原 SDD 时整体替换相关段落或改成索引，不在文末继续追加一层与前文冲突的“补充说明”。

## 3. 仍然存在的残余风险

- 自然语言否定、条件和指代可能被误读；来源与 Java 业务验证能限制危害，但不能数学上证明意图永远正确。
- 同一用户对多个商户有合法权限，不意味着需要把所有私有数据拼给一个模型；聚合仍要最小化和外发授权。
- 模型看到不该看的数据后，仅在最终答案过滤无法撤销外发；必须先过滤和检查供应商外发政策。
- 动态工具裁剪过窄可能让正常任务失败；需要评测和有限重新解析，而非无限扩工具。
- 权限撤销、取消、租约失效与数据库提交存在竞态，必须用真实事务和并发测试验证提交顺序。
- 持久化字段、上下文 Schema 与事件版本必须兼容历史；文档中的 JSON 只是目标语义，不是已执行的迁移。

## 4. 实施前必须有结论的门槛

| 门槛 | 本轮状态 | 进入开发/上线前怎么解决 |
|---|---|---|
| SDK 精确版本及真实模型协议 | NOT_RUN | 使用 M1 矩阵实测，并锁定依赖与 provider 配置 |
| 关键工具 JSON Schema 与错误映射 | 已给目标，未实现 | DTO/Schema 与现有路由生成方式一起提交回归 |
| 动作账本与数据库事务方案 | 已给不变量，未验证 DDL | 实际迁移、唯一键、锁序、崩溃恢复和并发测试 |
| Scope/Memory 字段及历史可见性 | 已给目标，未迁移 | 按旧数据来源保守迁移，测试撤权/多视角/删除 |
| 模型外发与 Trace 导出 | 策略建议，未配置 | 产品明确允许字段、供应商与保留范围，跑泄漏测试 |
| 性能/容量/Token/并发预算 | 未测 | 以真实环境压测与成本结果调整，不承诺假数据 |
| 用户界面与真实业务闭环 | 未实现 | 真实浏览器 + Java/MySQL + 实际模型分层验收 |

## 5. 官方资料核验说明

查阅官方文档只是证明接口和能力可选，不证明与当前项目第三方服务已联通。

[S1] OpenAI Agents SDK Tools API：FunctionTool 有 `is_enabled` 与工具输入/输出校验配置，可在运行上下文控制可见性。

[S2] OpenAI Agents SDK Models：支持非 OpenAI 提供商的客户端/模型适配；Chat Completions 与 Responses 能力有差异；tool_calls、流式与结构化输出需单独验证。

[S3] OpenAI Agents SDK Running agents：支持应用管理历史、SDK Session 和服务端会话等方式，应选择清晰的持久化策略，避免重复上下文。SDK Session 不是本项目权限过滤的替代。

[S4] OpenAI Agents SDK Tracing：提供模型/工具运行追踪，默认行为、敏感数据配置和自定义导出需显式核验。

[S5] LangChain 官方 OSS 概览：LangChain 标准 Agent 循环基于 LangGraph，不能声称 LangChain 没有可观测性或不支持 Agent。

[S6] LangGraph 官方文档：适用于显式图、持久化与复杂编排；其存在不意味着本项目首期必须采用。

[S7] OpenAI Agents SDK Context management：区分本地运行上下文和发送给模型的上下文；本地 context 中的凭据也需要注意工具/日志不要主动泄露。

## 6. 来源链接与定位

- [R1：PR #55 元数据与讨论](https://github.com/ProfessorZJH/campus-shopping/pull/55)
- [R2：读取时的 Agent SDD](https://github.com/ProfessorZJH/campus-shopping/blob/c95cf0db755e34ccde21e08bea3b17d1db26c2da/docs/specs/SDD-AGENT-V1-20261106.md)
- [R3：主干 PRD，重点第 1—3 节](https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/docs/requirements/PRD.md)
- [R4：AccessServiceImpl，重点 123—159 行](https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/impl/AccessServiceImpl.java)
- [R5：SDD-RBAC-05，重点 25—51 行](https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/docs/specs/SDD-RBAC-05.md)
- [R6：SessionSecurityConfig](https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/campus-shopping-app/src/main/java/cn/bugstack/ai/config/SessionSecurityConfig.java)
- [R7：AI requirements.txt](https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/ai-service/requirements.txt)
- [S1：Tools API](https://openai.github.io/openai-agents-python/ref/tool/)
- [S2：Models](https://openai.github.io/openai-agents-python/models/)
- [S3：Running agents](https://openai.github.io/openai-agents-python/running_agents/)
- [S4：Tracing](https://openai.github.io/openai-agents-python/tracing/)
- [S5：LangChain OSS 概览](https://www.langchain.com/oss-overview)
- [S6：LangGraph 官方概览源文档](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/overview.mdx)
- [S7：Context management](https://openai.github.io/openai-agents-python/context/)

以上外部资料会继续更新；实施需记录实际采用版本和验证日期。不要把网页当前示例的默认配置直接覆盖项目的隐私、鉴权或事务要求。

[R1]: https://github.com/ProfessorZJH/campus-shopping/pull/55
[R2]: https://github.com/ProfessorZJH/campus-shopping/blob/c95cf0db755e34ccde21e08bea3b17d1db26c2da/docs/specs/SDD-AGENT-V1-20261106.md
[R3]: https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/docs/requirements/PRD.md
[R4]: https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/impl/AccessServiceImpl.java
[R5]: https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/docs/specs/SDD-RBAC-05.md
[R6]: https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/campus-shopping-app/src/main/java/cn/bugstack/ai/config/SessionSecurityConfig.java
[R7]: https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/ai-service/requirements.txt
[S1]: https://openai.github.io/openai-agents-python/ref/tool/
[S2]: https://openai.github.io/openai-agents-python/models/
[S3]: https://openai.github.io/openai-agents-python/running_agents/
[S4]: https://openai.github.io/openai-agents-python/tracing/
[S5]: https://www.langchain.com/oss-overview
[S6]: https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/overview.mdx
[S7]: https://openai.github.io/openai-agents-python/context/
