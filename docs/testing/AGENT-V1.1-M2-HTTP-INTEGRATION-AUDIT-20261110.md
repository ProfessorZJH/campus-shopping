# Agent v1.1 M2 HTTP 联调审计（2026-11-10）

## 结论

M2 当前已经完成 Java Run、Scope、`search_products` 只读 Tool Gateway 及 MySQL 持久化，但还没有可调用的 Python Runtime HTTP 适配：`IAgentRuntimePort` 只有 domain Port 声明，没有 infrastructure 实现、Spring Bean 或调用方；Python FastAPI 也没有 `/v1/agent` 或 `/agent` 路由。现有 Python 测试明确要求 Agent 用户入口保持关闭，因此本审计没有把未冻结的运行协议提前变成生产 API。

本次新增 `scripts/smoke-agent-v1-1-m2-http.py` 作为内部验收 harness。它要求 Java 已经在 loopback 运行，通过既有匿名只读 `GET /api/v1/products/page` 读取 Java/MySQL 商品事实，把当前可售 SKU 映射成既有 Python `/v1/query` 的 `offers` 只读请求，再用隔离临时 SQLite 启动真实 Uvicorn loopback 服务并校验推荐 SKU 只能来自 Java 快照。脚本不启动或修改 Java 数据库，不调用购物车、订单、库存、支付或 M2 Agent Gateway 写入能力。

## 当前边界

| 链路 | 状态 | 说明 |
| --- | --- | --- |
| Java/MySQL 公开商品只读事实 | 可运行 | 由现有 `/api/v1/products/page` 提供，权限仍由现有 Spring Security 决定 |
| Uvicorn HTTP | 可运行 | 通过现有 `/v1/query`，只使用临时 SQLite 和本地降级检索 |
| Java `IAgentRuntimePort` HTTP 适配 | 未实现 | 当前 Port 没有实现或 Bean |
| Java Agent Run → Python 原生 Tool Calling → Java Tool Gateway | 未运行 | 需要独立冻结内部协议和认证方式 |
| 交易写入 | 未执行 | harness 只读 Java，Python 只处理请求，不写业务表 |

脚本成功只能证明“真实 Java/MySQL 事实经过 loopback Uvicorn HTTP 后仍受 Java 快照约束”，不能宣称 M1 4.4 的完整 Agent 端到端通过；完整 Agent 链路继续标为 `NOT_RUN`，隔离 Milvus、原生模型和真实 Tool Gateway 结果以各自报告为准。

## 运行方式

先启动已有本地 Java/MySQL 验收服务（例如 `scripts/run-local-live.py`），再执行：

```text
python scripts/smoke-agent-v1-1-m2-http.py --java-base-url http://127.0.0.1:8091 --output docs/testing/evidence/agent-v1.1-m2-http.json
```

脚本只接受 loopback Java 地址；没有可售商品、Java 不可达或 Uvicorn 未就绪时写入 `NOT_RUN` 证据并返回退出码 2。不会打印环境变量、凭据或下游异常正文。

## 最小后续变更

要把当前审计 harness 升级成 M2 真实 Agent 联调，需要另开 OpenSpec 变更并冻结：

1. Java 到 Python 的内部请求/响应 DTO，包含 Run 标识、能力凭据摘要、`turn_token` 租约和工具调用回执；不得复用匿名公开商品接口作为长期 Agent 协议。
2. Python 内部服务认证、loopback/服务网络边界、超时、429/5xx、流式终止和脱敏日志规则。
3. Java 侧在 Python 返回候选 ID 后调用 `AgentToolInvocationCase` 重新校验价格、SKU、库存、商户状态和 Scope；Python 返回值不能直接成为交易事实。
4. 受控集成测试：真实 Uvicorn、真实 Java/MySQL 和隔离 Milvus；未提供真实依赖时分别记为 `NOT_RUN`/`DEGRADED`，不通过 Stub 替代。
