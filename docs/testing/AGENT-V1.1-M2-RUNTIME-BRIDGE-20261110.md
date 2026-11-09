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

# Java Gateway -> 隔离 Uvicorn 的跨进程 STUB harness（默认关闭）
python scripts/smoke-agent-v1-1-m2-runtime-bridge.py --java-process-test --output docs/testing/evidence/agent-v1.1-m2-runtime-bridge-process-20261110.json

# 可选：手动连接测试专用 Java-owned loopback entry（当前跨进程验证优先使用 --java-process-test）
python scripts/smoke-agent-v1-1-m2-runtime-bridge.py --start-uvicorn --java-runtime-url http://127.0.0.1:8091/<test-only-runtime-entry> --env-file .env --output docs/testing/evidence/agent-v1.1-m2-runtime-bridge.json
```

结果：Python Runtime Bridge 定向测试 29 passed、1 个既有依赖弃用警告；Python 全量测试 361 passed、1 个既有依赖弃用警告；Java Agent 目标测试 42 passed、1 项按环境条件跳过；Maven 全量测试 434 passed、111 项按环境条件跳过；`mvnw verify -DskipTests` 编译、打包和重打包通过；schema、静态发布边界、DDD 和 API 契约检查通过；`git diff --check` 通过。Java loopback 测试覆盖一个 Run 的 `START → TOOL_CALLS → CONTINUE → FINAL`，2 次 Runtime HTTP turn、1 次 Java `search_products` 只读事实调用；跨进程 `--java-process-test` 还覆盖同一 START 重放、变更载荷冲突和 8 项 Gateway HTTP 故障映射，`businessWrites=false`。

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

额外执行的 `--java-process-test` 会在 Maven 测试 JVM 中启动 Java `AgentRuntimeGateway`，再由它通过 loopback HTTP 连接隔离 Uvicorn 和本地确定性模型夹具；该测试不启动 Spring Java/MySQL 服务，也不调用生产业务库。实际结果为 `PASS / STUB`，正常 Run 为 2 次 Runtime turn、1 次 native `search_products` 调用；另有 1 次独立 START 重放与 1 次同 key 改载荷冲突检查，provider 夹具共收到 3 次模型调用；同一轮还运行了 8 项 Gateway HTTP 故障映射测试。`businessWrites=false`，Uvicorn、模型夹具和临时 SQLite 均由测试清理。它证明了跨进程 HTTP、双重认证、Scope/租约边界、START 幂等重放、REQUEST_CONFLICT、CONTINUE/FINAL 和 Java 错误映射，不替代真实外部模型或真实 Spring/MySQL/Redis 验收。

证据文件：`docs/testing/evidence/agent-v1.1-m2-runtime-bridge.json`、`docs/testing/evidence/agent-v1.1-m2-runtime-bridge-process-20261110.json`。凭据、完整提示词、工具参数正文和下游异常正文不写入证据。

## 未验证边界

旧 `/v1/query`、`/ai/chat`、SSE 和 Proposal 兼容路径保持既有实现；本变更没有开放公开 Agent Trigger。外部 NVIDIA/讯飞模型、Embedding、Milvus、真实 Java/Uvicorn Runtime Bridge 跨进程联调以及生产灰度仍按各自报告单独验收；M1 4.3/4.4 已在对应报告中完成真实样本，不能由本地 stub 或 loopback 结果替代。

若后续要把 Runtime Bridge 接到真实 Java 服务，应在隔离 Java 服务、Uvicorn 和明确的测试服务密钥可用后重新运行 harness，并补充真实 CONTINUE、幂等、超时、429、5xx、清理和无业务写入证据；当前跨进程结果仍明确标为 `PASS / STUB`。
