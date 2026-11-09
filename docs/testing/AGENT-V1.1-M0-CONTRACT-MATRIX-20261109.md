# Agent v1.1 M0 契约与边界矩阵

> 日期：2026-11-09  
> 变更：`agent-v1-1`  
> 基线：`main` `7408926`  
> 状态：M0 契约已落盘；本文件不代表真实模型、Milvus 或生产验收通过。

## 目的

本矩阵把 Agent v1.1 PRD/工程基线映射到当前已接受的导购、会话、Proposal、权限和交易契约。M0 只冻结边界和可观察行为，不新增公开 Agent 入口、不修改旧接口、不新增数据库迁移。

## 兼容面

| 现有入口/事实 | M0 处理 | 不变量 | 验证依据 |
| --- | --- | --- | --- |
| `/ai/chat` | 保持输入、JSON 响应、Proposal 生成和错误语义 | 模型不能直接写购物车或订单 | `docs/api/http-api.md`、`docs/api/behavior-v1.1.md`、现有 Java/Python 回归 |
| `/ai/chat/stream` / SSE | 保持事件生命周期、取消、断线恢复和会话隔离 | 长调用不持有数据库事务/行锁 | `docs/specs/SDD-REDIS-12.md`、现有流式测试 |
| Proposal 确认 | 继续作为现有加购授权入口 | Java 重新校验价格、SKU、库存、权限和幂等 | `docs/specs/RELEASE-01.md`、ProposalConfirmationCase |
| `turn_token` / `turn_expires_at` | 继续作为唯一轮次租约 | 600 秒租约过期或代次不匹配时拒绝提交结果 | `IConversationRepository`、会话边界测试 |
| MySQL/Java | 继续裁决交易事实 | Python、模型、Milvus 只能提供建议/候选 ID | `docs/specs/SDD-AI-HYBRID-08.md`、DDD 规则 |
| Milvus 商品集合 | M1 只允许随机测试集合 | 不修改 `campus_products_v1` | `agent_evidence.assert_isolated_collection`、隔离脚本 |

## M0 工具与 Scope 矩阵

| 场景 | 输入 | 预期结果 | 当前测试 |
| --- | --- | --- | --- |
| 消费者查询公开商品 | `search_products(query, limit)`，Scope 含 `catalog.product.search` | 只返回结构化只读候选 | `ai-service/tests/test_agent_runtime.py` |
| 已选商户身份查询 | `merchantId` 属于服务端 `authorizedMerchantIds` | 允许进入查询，模型自报角色不参与授权 | `ai-service/tests/test_agent_runtime.py` |
| 多商户未选范围 | 商户身份且授权商户超过一个，未传 `merchantId` | 返回 `MERCHANT_SCOPE_AMBIGUOUS`，要求澄清 | `ai-service/tests/test_agent_runtime.py` |
| 外部商户资源 | `merchantId` 不在授权集合 | 返回 `MERCHANT_RESOURCE_DENIED`，不泄露候选 | `ai-service/tests/test_agent_runtime.py` |
| 权限撤销/租约过期 | Scope 无读取权限或 `turn_expires_at` 已过期 | 返回结构化失败，不执行查询 | `ai-service/tests/test_agent_runtime.py` |
| 未知工具 | `delete_order`、`add_to_cart` 或任意未登记名称 | `UNKNOWN_TOOL`，无业务写入 | `ai-service/tests/test_agent_runtime.py` |
| 非法参数 | 缺少 `query`、错误类型、未声明字段 | `INVALID_TOOL_ARGUMENTS`，无查询/写入 | `ai-service/tests/test_agent_runtime.py` |
| 伪造工具文本 | 普通文本声称“调用 search_products” | `PLAIN_TEXT_TOOL_CALL_REJECTED`，不执行工具 | `ai-service/tests/test_agent_runtime.py` |

## 设计落位

- 实验工具由 `ai-service/app/agent_contract.py` 代码显式登记；模型只能选择登记名称，不能提供类名、URL、HTTP 方法或执行参数。
- `AgentScope` 是服务端生成的本轮快照，包含用户、身份、授权商户集合、读取权限和租约；没有全局 `active_role` 旁路。
- `agent_runtime.py` 只依赖注入的模型客户端和只读 `ToolRegistry`，不访问业务数据库、Redis、购物车、订单或支付 Port。
- `search_products` 的候选快照不声明价格、库存或成交状态；真实候选在未来 M2 仍须经 Java/MySQL 事实复验。

## 当前结论

M0 契约测试可以在本地无真实供应商环境中重复运行。它证明工具白名单、参数拒绝、Scope 拒绝、租约拒绝和无写边界；不证明真实模型会产生原生 Tool Calling，也不证明真实 Milvus/Java/MySQL 链路已经执行。
