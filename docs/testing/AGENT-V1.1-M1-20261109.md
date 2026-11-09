# Agent v1.1 M0/M1 实施与验证记录

> 日期：2026-11-09  
> 分支：`codex/agent-v1-1-proposal`  
> OpenSpec：`agent-v1-1`  
> 基线：`main` `7408926`  
> 当前真实证据总体为 `DEGRADED`：讯飞 Tool Calling 与 NVIDIA Embedding 已取得真实样本，Milvus 因 TLS 配置门禁未运行，Java/MySQL 事实复验和完整链路仍未运行。

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
| 真实 Embedding passage/query | `NOT_RUN` | 本地未配置 `EMBEDDING_BASE_URL/EMBEDDING_API_KEY/EMBEDDING_MODEL` |
| 真实 Milvus 隔离生命周期 | `NOT_RUN` | 本地未配置 `EMBEDDING_*` 与 `MILVUS_*` |
| Java/MySQL 商品事实复验 | `NOT_RUN` | M0/M1 未新增 Java Agent/商品事实 HTTP Port |
| 真实端到端 Agent 链路 | `NOT_RUN` | 等待真实模型、Milvus 和后续受控 Java Gateway |

当前本地 Stub 报告的顶层状态是 `NOT_RUN`，`productionProductCollectionModified=false`、`javaMySqlTested=false`、`businessWrites=false`。该报告不代表后续私有 `.env` 真实运行结果。

## 私有配置真实运行证据

证据文件：[agent-v1.1-live.json](evidence/agent-v1.1-live.json)、[agent-v1.1-stream-retry.json](evidence/agent-v1.1-stream-retry.json)

执行命令（配置文件只在进程内读取，未复制到分支或报告）：

```powershell
python scripts/smoke-agent-v1-1.py --env-file G:\develop\campus-shopping\.env --output docs/testing/evidence/agent-v1.1-live.json --require-live
```

真实结果如下：

| 检查 | 状态 | 证据 |
| --- | --- | --- |
| 讯飞原生 Tool Calling | `PASS / REAL` | `spark-x2.6` 返回 1 个原生工具调用，回执状态 `SUCCEEDED`，随后继续回答；本次 631 tokens，约 58.8 秒 |
| 讯飞流式 Tool Calling | 首轮 `FAIL / REAL`，定向重试 `PASS / REAL` | 首轮安全记录为 `ASSERTIONERROR`；重试返回 1 个 `SUCCEEDED` 调用并继续回答，740 tokens，约 21.3 秒 |
| NVIDIA Embedding passage/query | `PASS / REAL` | `nvidia/nemotron-3.5-embed-1b`，2048 维，passage/query 数量和维度一致 |
| Milvus 隔离集合生命周期 | `NOT_RUN` | 配置为公网 `http` 地址，服务端 TLS 校验拒绝；443 证书与域名不匹配，未跳过证书校验 |
| Java/MySQL 商品事实复验 | `NOT_RUN` | M0/M1 未新增 Java Agent/商品事实 HTTP Port |
| 真实端到端 Agent 链路 | `NOT_RUN` | Milvus 未建立安全连接，且尚无受控 Java Gateway |

真实报告明确记录 `productionProductCollectionModified=false`、`javaMySqlTested=false`、`businessWrites=false`；本轮没有创建或清理任何 Milvus 集合，也没有访问既有商品集合。`--require-live` 会同时阻断 Milvus、Java/MySQL 事实复验或端到端检查未完成的运行，因此本轮不能宣称完整 M1 通过。

## 已执行验证

- `python -m pytest -q`（工作目录 `ai-service`）：276 passed，1 个既有 Starlette `PendingDeprecationWarning`。
- 审查修复后重新执行 `python -m pytest -q`（工作目录 `ai-service`）：282 passed，1 个既有 Starlette `PendingDeprecationWarning`。
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
- 私有配置真实运行：真实原生/流式 Tool Calling 重试和 NVIDIA Embedding 已记录；Milvus 因 TLS/证书门禁 `NOT_RUN`。

审查修复后的代码还增加了流式终止标记与响应大小门禁、供应商调用 ID 校验、轮次 Token 累加、模型/工具调用后的租约复验、Milvus 删除后查询证明，以及完整 `--require-live` 阻断条件。现有 `agent-v1.1-live.json` 是修复前的真实采样，保留作故障和供应商行为证据；当前配置未通过 TLS/证书安全门禁，因此没有用不安全地址重跑真实请求。

## 未完成与下一步

OpenSpec 任务 4.1 已有真实讯飞/NVIDIA 样本和一次流式重试证据；4.2～4.4 仍不能完成。4.2 需要修复 Milvus 的 TLS/证书配置后重新执行随机集合写入、检索、更新、删除和清理；4.3/4.4 还需要后续 M2 的受控 Java Agent/商品事实 Gateway。真实模型的流式首轮失败必须保留在报告中，不能用重试结果覆盖供应商稳定性事实。

M2 前不得把本次实验模块挂入公开 `/ai/chat`、SSE 或交易写链路，也不得创建 `ai_run`。Java 受控 Run、Tool Gateway 和事实复验 Port 应作为下一项独立 OpenSpec 变更提出。
