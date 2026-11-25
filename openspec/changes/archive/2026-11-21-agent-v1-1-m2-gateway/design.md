# Design

## Context

M0/M1 已在 `openspec/changes/agent-v1-1` 冻结 `search_products` 只读工具及 Scope 规则，但 Java 主线只有旧导购 `/ai/chat`、会话租约和商品领域能力，没有 Agent Run 持久化或工具网关。现有 `ICatalogCandidateQuery`、`IInventoryService`、`IAccessService` 和 `IUserAccountService` 已能提供候选、报价、库存与实时授权校验。

## Goals / Non-Goals

**Goals:**

- 按现有小傅哥 DDD 约定建立 domain Port、case 编排和 infrastructure 适配。
- 首期只实现一个 `search_products` 只读 Handler，并把 Run、Scope、租约、调用幂等和回执摘要持久化。
- 让测试能够证明未知工具、越权范围、过期租约、事实变化和重复调用均安全失败或重放。

**Non-Goals:**

- 不修改旧 `/ai/chat`、SSE、Proposal 和交易 API，不把新工具自动接入旧导购。
- 不实现购物车、订单、库存、支付写入和 M3 Action 账本。
- 不在本变更内完成真实供应商、Milvus TLS 或生产性能验收；这些结果单独记录。

## Decisions

### 1. Run 使用 MySQL 最小持久化而非 Redis-only

`ai_run` 保存用户、会话、Scope JSON、工具白名单、现有会话 `turn_token` 引用、状态和版本；`ai_run_invocation` 保存调用幂等键、输入摘要、状态和输出摘要。Run 不创建第二套租约，唯一有效执行租约仍是 `ai_conversation.turn_token/turn_expires_at`。这样断线恢复和重复调用可从 MySQL 重放，Redis 继续承担现有会话/准入能力。创建和状态转换使用短事务，远程调用不在事务内执行。

### 2. Domain Port 与 Case Handler 分离

domain 只定义 `AgentRunVO`、`AgentScopeVO`、状态和 `IAgentRunRepository`/`IAgentRuntimePort` 等窄 Port；case 负责 Run 生命周期、白名单和工具调用编排。`SearchProductsToolHandler` 依赖现有 `ICatalogCandidateQuery`、`IInventoryService`、`IAccessService` 和 `IUserAccountService`，不直接依赖 DAO 或聚合内部结构。

### 3. Scope 由服务端生成并在每次调用前复权

消费者 Scope 默认只能访问公开商品；商户 Scope 必须明确 `merchantId` 并实时检查 `product.read`。Run 保存的 Scope 是最小快照，但执行前仍复核账号状态、商户权限和资源归属；模型发送的 role、merchantId 或 URL 只作为不可信输入。

### 4. 工具回执采用不可变摘要

`search_products` 回执只包含 productId、skuId、商户/门店标识、展示摘要、当前价格、价格版本、可售数量和 `factVerified` 状态；不返回可变聚合、不接受写命令。输入和输出只保留受限字段及脱敏摘要，日志不写凭据、完整提示词或下游异常正文。

### 5. 先落内部 Case，再接公开 Trigger

本切片只提供受控 Case 和测试入口，不新增公开 HTTP 路由，避免在真实 Runtime/权限验收前改变客户端契约。后续 M2 切片在契约测试和真实 Java/Python 联调通过后，再补内部服务认证与 Trigger 适配。

## Risks / Trade-offs

- [查询仍可能恢复完整 ProductAggregate] → 复用现有已验收候选链路，先以正确性和权限边界为准；性能数据证明收益后再单独拆只读投影优化。
- [Run 表引入新的迁移门禁] → 使用单向新迁移、更新 `database-manifest.json`，隔离库先重放并由 schema contract 验证，不修改既有迁移；不新增第二种租约字段。
- [真实 Python Runtime 尚未接入] → `IAgentRuntimePort` 保留窄接口并明确 NOT_RUN；本切片不把 Stub 或 CI 结果宣称为真实端到端通过。

## Migration Plan

1. 在隔离数据库执行新增 `ai_run`/`ai_run_invocation` 迁移并运行 schema contract。
2. 运行 domain/case 契约测试及已有 MySQL 商品、权限、库存回归；失败时只回滚应用代码，保留不可变迁移历史。
3. 真实联调前保持新 Agent 入口关闭；旧 `/ai/chat` 和交易链路继续提供服务。

## Open Questions

无。公开 Trigger、Python Runtime HTTP 协议和 M3 写操作在后续变更中单独冻结。
