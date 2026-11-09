# Agent v1.1 M3 消费者只读工具验收记录（2026-11-10）

本记录覆盖 OpenSpec `agent-v1-1-m3-consumer-readonly-tools` 的 `knowledge_qa` 与 `get_my_orders` 只读链路、Java 幂等结果信封、Python/Java 合约同步和默认关闭闸门。当前不开放新的公开 Agent 入口，不改变既有 `/ai/chat`、SSE、Proposal 或交易写入契约。

## 实施结果

- Java domain 增加版本化、不可变的知识问答和本人订单请求/结果模型，以及消费者只读 Case Port。
- Java Case 使用当前 actor、consumer scope、Run capability、工具白名单和 `run_id + invocation_key + input_fingerprint` 幂等约束；订单结果只返回窄摘要，知识结果要求引用复核。
- Java 工具结果增加版本化 envelope，保留显式 `null` 字段，兼容已有 `search_products` candidates 结果和历史 output JSON。
- `knowledge_qa`、`get_my_orders` 的 Runtime schema、fixtures、错误分类和脱敏断言已加入 Python；Python 默认生产 registry 与 M2 Gateway 仍只执行 `search_products`，消费者工具闸门默认关闭。
- Java Gateway 对工具名、参数字段、类型、范围和返回状态做 fail-closed 校验；schema 不一致时映射为 `AI_UNAVAILABLE`，不执行业务工具。

## 已执行验证

```text
python -m pytest -q tests/test_consumer_readonly_contract.py tests/test_runtime_bridge_contract.py tests/test_runtime_bridge_harness.py
# 21 passed

python -m pytest -q
# 361 passed, 1 warning

./mvnw.cmd -q -pl campus-shopping-app -am -Dtest=AgentToolInvocationEnvelopeTest,AgentToolRegistryTest,AgentConsumerReadModelTest,AgentConsumerReadToolCaseTest,AgentGatewayTest,AgentRuntimeCaseTest,AgentRuntimeContractTest,AgentRuntimeSignatureTest,AgentRuntimeGatewayHttpTest,AgentRuntimeConfigTest,AgentRuntimeConsumerContractTest -Dsurefire.failIfNoSpecifiedTests=false -Dfrontend.skip=true test
# 42 tests, 0 failures, 0 errors

./mvnw.cmd clean verify -q
# 434 tests, 0 failures, 0 errors, 111 skipped

python scripts/verify-release.py
python scripts/verify-api-contract.py
python scripts/verify-api-schemas.py
python scripts/verify-domain.py
python scripts/verify-ddd-boundaries.py
python scripts/schema_contract.py --check
git diff --check
openspec validate agent-v1-1-m3-consumer-readonly-tools --strict --no-interactive
# all PASS
```

M3 隔离测试覆盖 Run 租约复核、消费者/商户身份边界、知识 scope、订单 buyer 绑定、重复调用重放、不同载荷冲突、未知字段、缺失分页、显式空值、schema mismatch、429/5xx/超时分类和无交易写入。Java 全量验证使用测试配置和隔离夹具；没有写入购物车、订单、库存或支付数据。

## 状态与未验证边界

| 检查 | 状态 | 说明 |
| --- | --- | --- |
| Java 消费者只读模型、Case、幂等 envelope | `STUB / PASS` | 42 项目标 JUnit 与全量 Maven 验证通过 |
| Python schema、原生 Tool Calling、错误和脱敏 | `STUB / PASS` | 21 项定向测试、全量 351 项通过 |
| Java/Python schema mismatch fail-closed | `STUB / PASS` | loopback HTTP contract 测试通过 |
| 新消费者工具公开入口 | `PASS / CLOSED` | 没有新增公开 Trigger，默认 feature gate 为 `false` |
| 真实 Java + MySQL + Runtime 消费者链路 | `NOT_RUN` | 当前没有可确认的隔离 Java HTTP 入口和独立测试数据库；不把 loopback/mock 结果写成真实验收 |
| 真实 NVIDIA/讯飞/Embedding/Milvus 消费者样本 | `NOT_RUN` | M1 真实证据仍按 M1 报告记录，不能由 M3 合约测试替代 |

`businessWrites=false`。本变更没有新增交易写 Port、DDL、公开 API 或第二套租约。真实外部依赖缺失时保持 `NOT_RUN`/`DEGRADED`，不伪造通过。

## 证据文件

- `docs/testing/evidence/agent-v1.1-m3-consumer-readonly-20261110.json`
- `ai-service/contracts/consumer_readonly/v1/manifest.json`
- `ai-service/tests/fixtures/consumer_readonly_tools/`

后续若要启用消费者工具，需要同时发布 Python registry、Java Gateway 白名单和独立业务验收配置；在此之前保持默认关闭。
