# Proposal

## Why

校园商城的产品化和结构重构已经在 `main` 基线 `7408926` 完成，但 Agent v1.1 仍停留在待评审的产品与工程方案中。现在需要把“模型负责理解、Java 负责事实裁决、Milvus 只做检索投影”的边界冻结为可验证契约，并先用真实模型、真实 HTTP 服务和隔离 Milvus 完成 M0/M1 验证，避免直接把未验证的 Tool Calling 或写操作带入现有交易链路。

## What Changes

- 建立 Agent v1.1 的 M0 产品契约：冻结现有 `/ai/chat`、SSE、Proposal 和交易 API 的兼容行为，明确只读工具清单、每轮身份与资源范围、未授权访问和动作写入规则。
- 建立 Agent v1.1 的 M1 验收边界：在独立 Python 实验环境中验证真实 NVIDIA、讯飞模型与真实 Milvus 的原生 Tool Calling、Embedding、商品召回、故障处理、流式响应和成本记录。
- 首期只注册 `search_products` 只读工具；工具调用必须使用可验证的原生函数调用和 JSON Schema，未知工具、缺失参数、伪造参数、越权资源和模型伪造文本均安全失败。
- 要求商品候选经过 Java/MySQL 的价格、库存、SKU、经营资格和权限复验；模型、Embedding 和 Milvus 不拥有购物车、订单、库存或其他交易写权限。
- 保留现有 `turn_token` / `turn_expires_at` 600 秒租约，模型长调用不得持有数据库事务或行锁；M0/M1 不新增生产 Agent 用户入口、真实购物车写入、交易 API 或 `ai_run` 持久化表。
- 统一 REAL、STUB、DEGRADED、NOT_RUN 证据状态，记录真实样本的时延、工具次数、Token、成本、超时、429、5xx、异常终止和降级结果，并确保 Trace/日志不暴露凭据、提示词和下游异常正文。
- 明确 M2 以后才实施受控 Tool Gateway、Run 生命周期、工具 Handler、商户多身份只读范围和 `ai_run`；M3 的直接加购及动作账本必须另行经过产品审批与事务/幂等验收。

## Capabilities

### New Capabilities

- `agent-contract-governance`: Agent v1.1 的只读工具注册、每轮 Scope/身份、权限边界、兼容冻结、失败回退和交易写入隔离契约。
- `agent-runtime-validation`: 真实模型与 Milvus 的原生 Tool Calling、结构化参数、商品检索复验、流式/故障行为、隔离集合生命周期和可观测验收证据。

### Modified Capabilities

无。当前 `openspec/specs/` 没有已登记的主能力规格；现有导购、会话、Proposal、交易和权限规则继续以 R1、已接受 SDD/ADR、HTTP/行为契约及源码为准，本次不改写这些既有能力。

## Impact

- **文档与规格**：新增本变更的 OpenSpec 提案、行为规格、DDD 对齐设计和实施任务；验收报告统一落在 `docs/testing/`，并引用现有 AI 开发流程、SDD 和架构决策。
- **Python 验证环境**：新增独立 Agent SDK POC/测试边界，复用现有 FastAPI、模型 smoke、商品索引和检索能力；具体供应商版本只在真实兼容测试后锁定。
- **Java 影响面**：M0/M1 只核对并保护现有 Trigger、Case、Domain、Infrastructure 端口和交易不变量，不新增公共 Agent API、交易写 Port 或数据库迁移；M2 的 `AgentRunCase`、`IAgentRuntimePort`、`IAgentRunRepository` 仅作为后续设计边界。
- **外部系统**：真实 Milvus 只能使用独立测试集合和随机命名空间，完成创建、写入、检索、更新、删除和清理证据；不得修改生产商品集合或既有业务库。真实供应商凭据使用私有环境变量，不进入代码、日志、报告或截图。
- **可观察验收**：M0 通过契约、权限、兼容和安全矩阵；M1 只有在真实原生工具调用、结构化参数、Java 事实复验、故障降级、隔离 Milvus 清理和证据状态均可核验时，才记录对应场景为 REAL。CI 通过、替身测试或历史重构报告不能替代真实供应商与生产验收。
