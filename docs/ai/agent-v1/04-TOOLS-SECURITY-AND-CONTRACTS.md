# 04 · 工具、身份委托、安全与执行契约

本文定义目标行为，不声称接口已经存在。工具名和新增路由为本轮建议，实施时纳入仓库的 DTO、路由清单和 OpenAPI 生成流程；不得手工改生成产物冒充接口实现。

## 1. 权限链不能只检查“属于商户”

执行许可 = 当前可信 actor + 有效 Run 委托 + 本轮允许能力 + 具体 RBAC/本人数据权限 + 资源归属 + 业务状态 + 写入策略。

浏览器继续用 Session/CSRF；不把用户名、userId、role、merchantId 放进模型 Schema 充当授权字段。业务目标 ID 可来自用户/模型候选，但必须在授权范围内解析、查询与验证，不能把“不能信任 ID”误解成“接口完全不能接收资源 ID”。

复用 `AccessServiceImpl.requirePermission(actor, merchantId, permission)`，后续继续检查订单/SKU 属于谁、现在能否操作。商户状态校验按操作类型：禁止新交易不必等于禁止读取历史/处理已有售后；复用领域规则，不新增一刀切拦截。

已有权限例子：改价需要 `product.write` 且同时 `product.read`；售后审核需要 `aftersale.review` 且同时 `aftersale.read`；库存补货需要 `stock.replenish` 且同时 `stock.read`。不是仅判断 Owner/Clerk 名称。[R4][R5]

## 2. Java → Python → Java 的身份链

### 2.1 建立 Run

Java 从 Session 得到 actor，验证 Conversation 所有权和账号状态，去重入站 Turn，创建 Run 与短效、服务端绑定的执行能力。凭据绑定至少包含 runId、execution segment、actor、conversation、允许的工具/资源上限、服务受众、有效期和撤销状态。

推荐使用不可猜测的 opaque capability，由 Java 保存验证摘要或可靠映射；也可复用已有经过审查的内部凭据基础设施。不要自制复杂签名协议。**runId 只是标识，单独持有 runId 不足以执行工具。**

### 2.2 内部回调

Python 通过受保护的内部连接提供服务身份与该片段的短效 capability，Java 验证两者后恢复 actor。凭据放在服务端 transport/local context，不进入 LLM messages、tool schema、tool result、普通日志或前端。

局域部署仍须限制内部接口可达性；跨主机用 TLS 和服务认证。工具回调不能依赖浏览器 Cookie 在 Python 自然传播，也不能把 Python 自报 userId 写入 Spring SecurityContext。

能力凭据只限制可尝试的动作，不能保证已授权到数据库提交；每次调用/确认都复权。失效、取消或越界的 Run 必须拒绝新变更。若未来有多个互不信任执行 worker，需要按 worker 绑定凭据、隔离密钥和上下文；不能宣称一个共享服务密钥可隔离已被攻陷的整个 Python 服务。

### 2.3 Scope 变化

当模型发现需要新域/新商户工具，提交范围解析候选；Java 根据本轮真实请求重新验证并开启新的受限片段。不能由 Python 修改 allowedMerchantIds 后继续沿用旧 capability。当前片段范围不可被任意扩权。

## 3. 工具清单与风险

| 能力 | 工具候选 | 允许范围 | 风险/处理 |
|---|---|---|---|
| 商品检索 | `search_products` | 公开在售商品；商户筛选只是购买范围 | READ；复用现有混合召回 |
| 商品详情 | `get_product_details` | 可公开 SKU 字段 | READ；字段白名单 |
| 当前报价 | `get_current_offer` | 用户有权购买/查看的报价 | READ；含可售信息和观测时间，不输出内部成本 |
| 知识问答 | `search_knowledge` | Java 核验的文档版本与外发范围 | READ；文档是数据而非指令 |
| 本人订单 | `list_my_orders` / `get_my_order` | buyerId 必须来自 actor | READ；不接受模型指定买家 |
| 本人售后 | `get_my_aftersale` | 本人订单/申请 | READ；咨询资格不触发申请 |
| 增量加购 | `add_to_cart` | 本人购物车，唯一 SKU 与明确数量 | LOW_WRITE；稳定 actionId，事务执行 |
| 商户订单 | `list_merchant_orders` / `get_merchant_order` | 经验证 merchant + `order.read` | READ；本轮片段绑定商户 |
| 商户库存 | `get_inventory_summary` | merchant + `stock.read` | READ；批量范围/页数有界 |
| 商户知识 | `search_merchant_knowledge` | merchant + `knowledge.read` + 文档权限 | READ；按外发许可处理 |
| 商户经营变更 | `prepare_price_change` 等 | 具体写权限和资源归属 | 后续阶段 PREPARE；仅返回预览 |
| 真正高风险执行 | 前端确认 Java API | 原提案所绑定对象、差异和版本 | 不向普通模型注册 execute 工具 |

消费型工具可包含商户商品筛选，不代表需要 MerchantAgent。没有商户权限的人仍可检索某家店公开商品；这一区分必须写进工具说明及测试。

## 4. 工具注册与错误语义

每个已上线工具声明版本、输入 Schema、可见条件、权限要求、风险、输出字段、超时、幂等/重试属性。首期可用清晰的代码注册表，不建动态脚本工具平台。

本轮可见集合取当前权限、业务范围、功能开关和风险阶段的交集；模型再选择相关工具。SDK 的 `is_enabled` 可做可见性控制，但最终执行端仍要校验工具名、参数和权限。[S1]

只读工具失败可在总预算内有限重试；不可重试错误（无权、参数歧义、业务冲突）直接反馈。权限拒绝不允许换另一工具绕过。模型调用未注册名称必须拒绝，不做反射调用、任意 URL 或 SQL 执行。

示例工具结果：

```json
{
  "ok": true,
  "toolVersion": "v1",
  "data": {"skuRef": "sku_ref_2", "quantityAdded": 2, "cartQuantity": 4},
  "action": {"actionId": "action_7", "state": "SUCCEEDED"},
  "observedAt": "2026-11-06T02:00:00Z"
}
```

安全错误只含必要稳定代码、用户可理解提示、可重试与否、受控 traceId。不回显 SQL、栈、其他商户名称/ID、密钥。对于未授权对象，不用“存在但属于 B 店”帮助枚举；按现有资源隐匿规则统一无权/不存在。内部 HTTP/现有业务错误信封的映射需固定，不要求所有拒绝一律变成 HTTP 403。

## 5. 风险分级与自然语言授权

| 情况 | 行为 |
|---|---|
| 只读且范围明确 | 直接查，仍做权限与最小化返回 |
| 明确加购，SKU/数量唯一 | 直接执行低风险写，不再弹确认 |
| “推荐”“看看能否退款”“先别加” | 不执行写入 |
| 加购对象/数量不明确 | 澄清缺失信息，不把默认值伪装成用户要求 |
| 改价、上下架、补货或退款审核 | 后续开放时先生成预览，再由明确 UI 确认 |
| 支付、授予权限、跨域批量敏感操作 | v1 Agent 不开放自主执行 |

“Java 裁决”不代表 Java 能用正则完美理解所有中文授权。低风险动作准入应绑定当前消息或明确前端交互、唯一业务对象、来源约束与撤销/否定信息；LLM 的 `authorizedWrite=true` 不是凭据。Prompt Injection、复杂条件误读仍是残余风险，需要专项评测；不明确时澄清，不因降低确认次数而掩盖不确定性。

### 5.1 低风险直接加购

Java 在入站消息下保存操作候选和来源，核对唯一 SKU、数量及明确加购表达。必要的执行身份和 actionId 由应用生成，非模型参数。复用原购物车累计数量、可售状态、价格约束和锁序校验。

同一动作事务内保存购物车变化与动作结果。不能先调用 addCart 成功，再异步写“已执行”，否则崩溃窗口会造成重试重复加购。模型服务超时不包裹在数据库事务内。

### 5.2 高风险预览/确认

`prepare_*`：Java 查当前实体，验证权限，生成不可被客户端改写的 change set、对象版本、actor、merchant、有效期、actionId/previewId、影响范围。准备阶段不执行业务变更。

前端确认：用户看见具体差异，提交 previewId 和确认请求；保持 Session/CSRF。Java 重新校验权限、提案归属/期限、对象版本及条件，事务内一次性消费提案并提交变更与回执。价格/状态变更导致预览不再适用时拒绝旧预览，重新生成后让用户确认；不静默改写执行内容。

一个签名 token 不能代替上述状态检查，也不能防止全部重放。服务端持久化 opaque previewId 足够时不新增签名层。不同 idempotencyKey 也不能重复消费同一 previewId。

## 6. 幂等必须覆盖三层

**消息层：** `clientMessageId` 绑定 actor + conversation + 请求摘要。同一消息重发返回同一 Run；同一个 key 携带不同文本/回复引用则冲突，不当作新消息。

**动作层：** actionId 由服务端绑定 origin message/UI evidence + operation + 目标 scope + canonical args + 明确动作序号；唯一约束保证 SDK retry、网络重试或模型重新生成 toolCallId 不产生第二份动作。执行前比较 argsHash，同 id 不同参数拒绝。

**业务层：** 当前数据库事务、稳定锁序、条件更新/提案状态负责真实效果和回执原子性。查到成功动作只返回此前结果，不再执行。

不能仅以参数哈希去重：下一条用户新消息“再加两瓶”参数相同，但确实是第二次授权；也不能只以模型 toolCallId 去重，因为同一轮重试可能产生新 ID。首期同一消息中同 SKU 的加购先规范化成一个数量动作，模型重复要求同等增量默认视为同动作；确有多个独立增量时要求源文本支持并分配不同序号。

超时结果未知：先查询账本/事务结果，不盲目新增 actionId。账本未确认时返回“结果核验中”，不能宣称失败后让用户随意重试。

## 7. 建议接口（新增，未实现）

| 路由/内部能力 | 目标行为 |
|---|---|
| `POST /api/v1/ai/runs` | 带 Session/CSRF 和 clientMessageId 创建或取回 Run |
| `GET /api/v1/ai/runs/{runId}` | 授权查询 Run、部分结果、动作状态 |
| `GET /api/v1/ai/runs/{runId}/events` | 授权 SSE，支持最后事件游标 |
| `POST /api/v1/ai/runs/{runId}/cancel` | 请求取消；不回滚已提交业务动作 |
| `POST /api/v1/ai/runs/{runId}/clarifications/{id}/resolve` | 处理有限选项/文本补充，验证版本与有效期 |
| `POST /api/v1/ai/actions/{actionId}/confirm` | 高风险预览确认，严格绑定差异 |
| `GET /api/v1/ai/actions/{actionId}` | 查询已执行结果/待确认状态 |
| Java→Python `run` 能力 | 输入有界上下文、scope、模型配置和内部凭据 |
| Python→Java `tools.invoke` 能力 | 使用短效能力调用已注册工具；不是开放 RPC 执行器 |

保留现有 `/api/v1/ai/chat` JSON 和 Proposal 接口，不在第一批破坏旧客户端。内部路径需在安全过滤器明确允许所需服务身份，不能简单对整个 `/internal/**` 设为公开。

Run 请求示例：

```json
{
  "conversationId": "conv_1",
  "clientMessageId": "client_msg_8",
  "question": "把刚才第二款加两瓶",
  "replyToMessageId": "msg_7",
  "cardRef": "display_3:item_2",
  "sourceSurface": "PRODUCT_DETAIL"
}
```

这些 UI 引用仍须服务器验证归属和可见性；它们提升消歧准确性，不授予权限。

## 8. 审计、注入与外发

RAG、历史、用户文本和工具文本皆不可信指令。注入内容不能添加工具、改变 Run 范围、指定执行身份或取得确认凭据。输出校验不能追回已经外发的数据，因此范围过滤和模型供应商外发许可必须在模型调用前完成。

工具响应采用最小字段投影，避免将手机号、精确地址、核销秘密、内部成本或全量订单明细当作回答上下文。外部模型不可接收的内部知识走已有受控处理/本地结果卡，不能仅通过“隐藏引用链接”解决正文泄露。

权限撤销与执行并发需明确提交语义：执行事务在校验并锁定必要授权/对象后与撤权操作形成一致顺序；撤权先完成则新执行拒绝，合法操作先提交则保留其真实结果。不能声称任意时刻撤权可撤销已经完成的数据库操作。实现若需扩大锁范围，应遵循已有统一锁序并做并发回归，而不是在外部 LLM 调用期间锁住成员行。

[R4]: https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/impl/AccessServiceImpl.java
[R5]: https://github.com/ProfessorZJH/campus-shopping/blob/45ccbd14432d60a9ab20e5a75c91a7d3641dfc42/docs/specs/SDD-RBAC-05.md
[S1]: https://openai.github.io/openai-agents-python/ref/tool/
