# Proposal

## Why

Agent v1.1 的 M0/M1 已冻结只读工具契约并在 Python 实验环境验证了原生 Tool Calling，但生产 Java 侧还没有受控 Run、Scope 和工具执行边界。现在需要把首个 `search_products` 只读工具落到现有 DDD 分层，使模型只能请求白名单能力，商品价格、状态和库存继续由 Java/MySQL 裁决。

## What Changes

- 新增最小 `ai_run` 持久化模型，记录用户、会话、服务端 Scope、允许工具、现有 `turn_token` 租约引用、幂等键和运行状态。
- 在 domain/case 层新增受控 Run 生命周期和 Tool Gateway；首期只注册 `search_products`，不开放任意 URL、类名或动态参数执行。
- 复用现有目录候选、实时报价、库存和身份权限能力，输出不可变的商品搜索回执；模型或向量召回结果不能直接成为交易事实。
- 新增内部 Java Runtime Port，保留 Python Runtime 的适配边界；本次不新增公开 Agent 用户入口，不接入购物车、订单、支付或其他写操作。
- 为 Run 幂等、现有会话租约过期、工具白名单、商户范围、价格/库存复验和拒绝写入补齐单元及集成契约测试，并记录迁移与验收范围。

## Capabilities

### New Capabilities

- `agent-run-gateway`: 受控 Agent Run、Scope、只读工具注册与商品搜索执行边界。

### Modified Capabilities

- 无。

## Impact

- Java `domain`、`case`、`infrastructure` 模块新增 Agent 模型、端口、Case、工具 Handler 和 MyBatis 适配。
- `campus-shopping-app` 新增不可变数据库迁移和测试夹具；不修改既有 `/ai/chat`、SSE、Proposal、购物车及交易 API。
- 需要同步 OpenSpec、测试报告和数据库 manifest；真实 Python/Milvus 端到端验收仍以独立 M1/M2 报告为准。
