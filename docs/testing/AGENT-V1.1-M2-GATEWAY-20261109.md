# Agent v1.1 M2 Gateway 实施记录（2026-11-09）

## 范围

本阶段在 `origin/main` 基线上实现 Java 侧最小受控 Agent Gateway：Run 生命周期、现有会话租约复用、工具白名单、`search_products` 只读执行、调用幂等和结果持久化。

本阶段没有修改旧 `/ai/chat`、SSE、Proposal、购物车、订单或支付接口，也没有开放新的 Agent 用户入口。

## 已完成

- 新增 domain Agent Run、Scope、工具注册表、搜索请求、事实快照和调用结果模型。
- 新增 `IAgentRunRepository` 与 `IAgentRuntimePort`，domain 不依赖 infrastructure 或 trigger。
- 新增 `AgentRunCase` 和 `AgentToolInvocationCase`，复用 `ai_conversation.turn_token/turn_expires_at` 作为唯一有效租约。
- 新增 `search_products` 只读 Handler：候选召回后重新读取商品报价、SKU 状态、商户经营状态和实时库存；模型或向量召回不能直接成为交易事实。
- 新增 `ai_run`、`ai_run_invocation` 不可变迁移、PO、DAO、MyBatis mapper 和 Repository；调用结果按 Run 与调用键幂等重放。
- 新增隔离 schema 基线内容并通过 schema contract 校验。

## 自动验证

以下命令在本分支执行通过：

```text
openspec validate agent-v1-1-m2-gateway --strict
python scripts/schema_contract.py --check
./mvnw.cmd -pl campus-shopping-app -am '-Dtest=AgentGatewayTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dfrontend.skip=true' test
git diff --check
```

`AgentGatewayTest` 覆盖 Run 幂等、会话租约过期、商品事实复验、库存过滤、重复调用重放、不同输入冲突和商户越权拒绝，共 5 项通过。

## 当前边界

本记录证明 Java 代码与隔离 schema 的自动验证完成，不等同于真实 Python Runtime、NVIDIA/讯飞、Milvus、真实 MySQL 部署或端到端 HTTP 验收完成。M1 中 Milvus TLS 受配置门禁影响的 `DEGRADED/NOT_RUN` 结论仍然有效；真实供应商与跨服务验收留在后续集成阶段。
