# Agent v1.1 M0/M1 实施与验证记录

> 日期：2026-11-09  
> 分支：`codex/agent-v1-1-proposal`  
> OpenSpec：`agent-v1-1`  
> 基线：`main` `7408926`  
> 本记录不代表真实供应商、生产 Milvus 或 Java/MySQL Agent Gateway 验收通过。

## 本次实施

本次在不改变现有 FastAPI 公共路由、Java API、数据库和交易写入的前提下，新增独立 M1 实验运行时：

- `ai-service/app/agent_contract.py`：`AgentScope`、`ToolSpec`、`ToolRegistry` 和 `search_products` 只读契约；Pydantic strict Schema 拒绝缺失、错误类型和额外字段。
- `ai-service/app/agent_runtime.py`：原生 `tool_calls` 解析、有限工具循环、Scope/租约检查、重复调用拒绝、普通文本伪造调用拒绝和流式参数累积。
- `ai-service/app/agent_provider.py`：OpenAI 兼容模型的独立 Tool Calling HTTP 适配器；不替换现有 `Provider`，不记录请求正文或授权头。
- `ai-service/app/agent_fact.py`：Java/MySQL 商品事实复验的窄 Port 和失效候选过滤契约；当前只验证边界，未伪造真实 Java 连接。
- `ai-service/app/agent_evidence.py`：`REAL`、`STUB`、`DEGRADED`、`NOT_RUN` 状态、隔离集合名校验、故障类型和脱敏报告。
- `scripts/smoke-agent-v1-1.py`：先执行受控 Stub，再按私有环境变量尝试真实模型和随机 Milvus 集合；默认不接入 `/ai/chat`，不执行交易写入。

## M0 契约结果

`docs/testing/AGENT-V1.1-M0-CONTRACT-MATRIX-20261109.md` 已固定旧导购兼容面、工具白名单、Scope/身份、租约、事实复验和无写边界。实验注册表只包含 `search_products`，未知工具、未声明字段、缺少 `query`、过期租约、商户范围歧义和跨商户资源都会返回结构化失败。

## 本地运行证据

证据文件：[agent-v1.1-local.json](evidence/agent-v1.1-local.json)

执行命令：

```powershell
python scripts/smoke-agent-v1-1.py --output docs/testing/evidence/agent-v1.1-local.json
```

结果摘要：

| 检查 | 状态 | 说明 |
| --- | --- | --- |
| Stub 原生 Tool Calling + 继续回答 | PASS / `STUB` | 只验证协议和运行时循环 |
| Stub 流式参数只执行一次 | PASS / `STUB` | 覆盖重复分片和工具回执 |
| Stub 无业务写入 | PASS / `STUB` | 注册工具只有 `search_products` |
| 真实原生 Tool Calling | `NOT_RUN` | 本地未配置 `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL` |
| 真实流式 Tool Calling | `NOT_RUN` | 本地未配置真实模型 |
| 真实 Milvus 隔离生命周期 | `NOT_RUN` | 本地未配置 `EMBEDDING_*` 与 `MILVUS_*` |
| Java/MySQL 商品事实复验 | `NOT_RUN` | M0/M1 未新增 Java Agent/商品事实 HTTP Port |
| 真实端到端 Agent 链路 | `NOT_RUN` | 等待真实模型、Milvus 和后续受控 Java Gateway |

当前报告的顶层状态是 `NOT_RUN`，`productionProductCollectionModified=false`、`javaMySqlTested=false`、`businessWrites=false`。本地没有 `.env`，也没有发现 `LLM_*`、`EMBEDDING_*`、`MILVUS_*` 或 `REDIS_TEST_ADDRESS` 环境变量；没有发送真实凭据或操作既有业务库。

## 已执行验证

- `python -m pytest -q`（工作目录 `ai-service`）：276 passed，1 个既有 Starlette `PendingDeprecationWarning`。
- Agent 定向测试：17 passed。
- `python -m compileall -q app tests`：通过。
- `openspec validate agent-v1-1 --strict --no-interactive`：通过。
- `npm run format:check --prefix frontend`：通过。
- `python scripts/build-ui-bundle.py --check`：通过。
- Maven 编译：`mvnw -q -pl campus-shopping-app -am -DskipTests -Dfrontend.skip=true compile` 通过。
- Java 定向回归：`AiConversationBoundaryTest`、`AiGatewayProtocolTest`、`AiGatewayProductIndexTest`、`ProductCandidateSnapshotTest`、`PurchaseConstraintTest`、`ProposalProductIdentityTest` 通过；执行时对无关模块使用 `-Dsurefire.failIfNoSpecifiedTests=false`。
- `python scripts/verify-release.py`、`python scripts/verify-source.py`、`python scripts/verify-supply-chain.py`：通过。
- 变更文件凭据模式扫描：未发现私钥、云访问密钥或 Slack Token 模式。
- `git diff --check`：通过。

## 未完成与下一步

M1 的真实模型、真实 Embedding、隔离 Milvus 生命周期和 Java/MySQL 事实复验仍未执行，不能勾选 OpenSpec 任务 4.1～4.4。它们需要私有环境中的真实配置和受控运行环境；具备条件后使用 `scripts/smoke-agent-v1-1.py --require-live`，并将实际样本、工具次数、时延、Token/成本、故障和清理证据追加到 `docs/testing/`。

M2 前不得把本次实验模块挂入公开 `/ai/chat`、SSE 或交易写链路，也不得创建 `ai_run`。Java 受控 Run、Tool Gateway 和事实复验 Port 应作为下一项独立 OpenSpec 变更提出。
