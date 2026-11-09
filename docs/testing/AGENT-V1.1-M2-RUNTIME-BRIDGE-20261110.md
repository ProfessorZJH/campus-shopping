# Agent v1.1 M2 Runtime Bridge 联调证据（2026-11-10）

## 范围

本记录覆盖 OpenSpec `agent-v1-1-m2-runtime-bridge` 的协议实现、Java loopback 测试和真实 HTTP harness 入口。Runtime 协议版本为 `1.0`，Python 只负责模型决策并返回原生 `TOOL_CALLS`/`FINAL`，Java 负责 Run、Scope、租约、商品事实复验和只读工具执行。

当前报告区分代码/单测完成与真实外部联调状态。真实 NVIDIA、讯飞、Embedding、Milvus 和生产灰度不由本变更的 stub 或 loopback 单测代替。

## 已执行的验证

```text
python -m pytest -q tests/test_runtime_bridge.py tests/test_runtime_bridge_fixtures.py tests/test_runtime_bridge_harness.py
python -m pytest -q
python -m compileall -q app tests
python scripts/schema_contract.py --check
python scripts/verify-release.py
python scripts/verify-api-contract.py
python scripts/verify-api-schemas.py
./mvnw.cmd -pl campus-shopping-app -am -Dtest=AgentRuntimeLoopbackIntegrationTest,AgentRuntimeCaseTest,AgentRuntimeGatewayHttpTest,AgentRuntimeSignatureTest,AgentRuntimeContractTest,AgentRuntimeConfigTest -Dsurefire.failIfNoSpecifiedTests=false test
python scripts/smoke-agent-v1-1-m2-runtime-bridge.py --output docs/testing/evidence/agent-v1.1-m2-runtime-bridge.json
```

结果：Python Runtime Bridge 定向测试 26 passed，Python 全量测试 335 passed、1 个既有依赖弃用警告；Java Runtime 与兼容性目标测试 32 passed，其中 Runtime 相关测试 19 passed；`mvnw clean verify` 全量测试 412 passed、110 项按既有环境条件跳过；schema、静态发布边界和 API 契约检查通过；`git diff --check` 通过。Java loopback 测试覆盖一个 Run 的 `START → TOOL_CALLS → CONTINUE → FINAL`，2 次 Runtime HTTP turn、1 次 Java `search_products` 只读事实调用，购物车、订单、库存和支付没有写入路径。

## 错误与安全矩阵

| 检查 | 状态 | 证据 |
| --- | --- | --- |
| 服务密钥、capability、digest、HMAC、request ID | PASS | Python TestClient、Java HttpServer loopback |
| 过期租约、Scope 指纹变化、continuation 丢失 | PASS | Runtime Bridge 单测 |
| 相同 request 重放与不同载荷冲突 | PASS | Runtime Bridge 单测 |
| 未知工具、缺失参数、文本伪调用、非法模型响应 | PASS | Runtime Bridge 单测 |
| 工具调用/往返上限 | PASS | Runtime Bridge 单测 |
| Java 401/403/422/429/5xx、非法 JSON | PASS | Gateway JUnit，统一映射为 `AI_UNAVAILABLE` |
| 请求体上限、公开 Agent 路由和 OpenAPI 暴露 | PASS | Python Route/TestClient 单测 |
| 日志/证据泄露凭据、提示词、工具参数或下游正文 | PASS | 脱敏断言与错误日志检查 |

## 持久化复核

现有 `ai_run` 保存 Run 的 capability 哈希、Scope/工具快照、状态和版本；`ai_run_invocation` 通过 `run_id + invocation_key` 保存幂等调用键、输入指纹、脱敏后的输入/输出 JSON、状态和错误类别。这个关联足以恢复已完成的只读工具回执，不新增第二套 `turn_token`/`turn_expires_at` 租约，也不向交易表写入 Runtime 数据。continuation ID 只在 Runtime 上下文和请求回执中短暂存在，Runtime 重启后按既定安全失败路径要求新 Run；已完成的 Java invocation 不会因为 continuation 丢失而自动重放。

## 真实 harness 状态

执行 `scripts/smoke-agent-v1-1-m2-runtime-bridge.py` 时，当前环境没有显式配置 `AI_SERVICE_KEY`，证据文件记录为 `NOT_RUN`，范围为 `protocol_probe_only`，`realAgentIntegration=NOT_RUN`。该脚本会拒绝非 loopback 地址、URL 内凭据、query/fragment，验证 capability SHA-256 digest 和 HMAC 请求签名；缺少隔离 Java/Uvicorn/外部模型依赖时不会伪造 `PASS`。

本次未启动外部模型、未连接生产 Milvus、未修改业务 MySQL、Redis、购物车、订单、库存或支付数据。loopback 单测使用临时 HTTP server、mock 的 Java 事实工具和临时测试状态，测试结束后关闭 server/数据库句柄；没有执行 `FLUSHDB`、`FLUSHALL` 或生产清理。

证据文件：`docs/testing/evidence/agent-v1.1-m2-runtime-bridge.json`。凭据、完整提示词、工具参数正文和下游异常正文不写入证据。

## 未验证边界

旧 `/v1/query`、`/ai/chat`、SSE 和 Proposal 兼容路径保持既有实现；本变更没有开放公开 Agent Trigger。外部 NVIDIA/讯飞模型、Embedding、Milvus、真实 Java/Uvicorn 跨进程联调、M1 4.3/4.4 以及生产灰度仍按各自报告单独验收，不能由本地 stub 或 loopback 结果替代。

在隔离 Java 服务、Uvicorn 和明确的测试服务密钥可用后，应重新运行 harness，并补充真实 CONTINUE、幂等、超时、429、5xx、清理和无业务写入证据；成功结果仍需区分 `REAL`、`STUB`、`DEGRADED` 与 `NOT_RUN`。
