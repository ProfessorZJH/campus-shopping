# Design

## Context

见 [proposal.md](proposal.md) 及两份行为规格。当前仓库已经完成 Java 模块化单体、ShoppingAI 候选/证据职责整理、Python Provider/检索边界整理和现有导购交易链路验收；`/ai/chat`、SSE、Proposal 确认、会话租约和交易复验都是稳定兼容面。Agent v1.1 尚未有生产入口、Agent Run 表或 Tool Gateway。

现有 DDD 约定来自 `docs/specs/SDD-DDD-11.md`、`docs/architecture/DDD-REVIEW-20261029.md` 和已接受 ADR：Trigger 负责协议适配，Case 编排跨域用例，Domain 持有业务规则和窄 Port，Infrastructure 实现数据库/远程适配；模型和 Milvus 只能提供建议/检索投影，MySQL 与 Java 负责事实裁决。本文沿用这些约定，不创建新的分层体系，也不因为 Agent 预建通用工作流引擎。

## Goals / Non-Goals

**Goals:**

- 在 M0 冻结 Agent 只读工具、Scope、身份、错误和旧导购兼容契约，使后续实现有单一可审查边界。
- 在 M1 用独立 Python 实验环境验证真实模型原生 Tool Calling、结构化回执、流式/故障行为、隔离 Milvus 生命周期和 Java 事实复验。
- 让 DDD 设计在未来 M2 可以平滑落到现有 `trigger/case/domain/infrastructure` 模块，同时保留现有会话租约、短事务和交易写入口。
- 使每项真实/替身/降级/未执行结果都有可核对的指标、脱敏证据和回退路径。

**Non-Goals:**

- M0/M1 不新增公开 Agent API、用户入口、`ai_run` 迁移、购物车/订单/库存/支付写操作或 Action 账本。
- 不改造现有 `/ai/chat`、SSE、Proposal、购物车和交易确认契约，不把现有单一路径改成通用 Agent 工作流。
- 不在没有独立替换需求时继续拆 Provider，不为 Catalog 查询边界、前端大页面或交易 Repository 引入本次无关重构。
- 不把 CI、Stub、历史报告或本地替身解释成真实 NVIDIA/讯飞/Milvus、生产部署、性能或模型质量验收。

## Decisions

### 1. M0/M1 采用文档与实验边界，不提前落生产 Run 模型

M0 以本变更的两份规格、验收矩阵和现有 SDD/ADR 引用冻结契约；M1 在隔离 Python 实验环境中注册一个 `search_products` 只读工具。M2 以后才进入 Java 受控 Run 和 Tool Gateway。

**原因**：当前没有 Agent 用户入口和持久化运行状态，提前新增 `ai_run`、公共 HTTP DTO 或生产表会把未验证的供应商协议变成兼容负担。

**替代方案**：直接在现有 `/ai/chat` 中加入工具循环。放弃该方案，因为它会改变已验收的 SSE/Proposal 语义，且难以区分实验失败与旧导购故障。

### 2. 未来实现按现有 DDD 边界落位

- **Trigger**：只做请求/响应协议、CSRF、服务可信校验和 SSE/HTTP 适配，不解析模型意图，也不编排跨域规则。
- **Case**：未来由 `AgentRunCase` 管理 Run 生命周期、幂等和 Scope，由 `AgentToolInvocationCase` 编排一次工具调用的可信服务、Run 能力凭据、工具白名单、权限和资源归属。
- **Domain**：定义 Scope、工具注册元数据、能力凭据、权限策略、资源归属和运行状态等窄模型/Port；规则继续由领域服务持有，调用方不依赖可变聚合内部结构。
- **Infrastructure**：实现 `IAgentRuntimePort`、`IAgentRunRepository`、模型 HTTP 适配、只读查询适配和必要的 Redis/MySQL 访问；不得让 Python 直接写交易表。
- **Python Runtime**：负责模型推理、工具选择和有限循环；只接收最小化 Scope/候选事实，不提供任意类名、URL 或可执行参数。

**原因**：这与小傅哥 DDD 的“领域规则下沉、Case 编排、Port 隔离适配器”一致，并复用仓库已接受的分层和异常处理约束。

**替代方案**：在 Python 内实现全套权限和交易规则。放弃该方案，因为会复制 Java 事实并产生权限漂移；在 Java 内建通用节点工厂/责任链。放弃该方案，因为首期只有一个只读工具，过度抽象会扩大攻击面和维护成本。

### 3. `search_products` 使用稳定的结构化工具契约

M1 工具声明固定为名称、版本、用途、只读标识和 JSON Schema；输入只包含检索所需的受限字段，输出只包含候选 ID/展示摘要、来源和验证状态。工具执行前后都校验名称、参数、Scope 和回执；旧客户端不感知该实验契约。

**原因**：稳定 Schema 能验证原生 Function Calling，也能把未知工具、缺失参数和伪造字段在进入业务查询前拦截。

**替代方案**：让模型发送任意 URL/类名/参数，再由运行时动态调用。放弃该方案，因为这绕过工具白名单、增加 SSRF/越权风险并违反现有安全约束。

### 4. 事务、租约和幂等沿用现有边界

M0/M1 不新增数据库迁移。每轮继续以 `turn_token` / `turn_expires_at` 作为唯一有效租约；远程模型、Embedding、Milvus 调用不持有数据库事务或行锁。若未来 M2 建立 `ai_run`，创建、去重、状态转移和 Scope 绑定在短事务内完成；模型调用完成后再次核对 Run 代次和租约再提交结果。M3 写操作才引入 Action 账本，并要求动作与成功回执在同一 MySQL 事务中提交。

**原因**：保留当前已验收的 600 秒租约和短事务原则，避免长调用占用锁，也避免重复提交或断线重放产生业务写入。

**锁与幂等**：M0/M1 无业务写锁；未来交易写操作遵循现有订单→售后/履约/库存等稳定锁序，必须按用户/商户/资源和幂等键去重。断线恢复只读取 Run 快照，不重新执行已完成工具。

### 5. 事实复验由 Java/MySQL 完成

Milvus 仅返回语义候选 ID/相似度；Python 不把价格、库存、经营资格、权限或订单状态带入最终事实。候选回到 Java 后通过既有 Catalog/Inventory/权限窄能力重新查询和过滤，输出给模型的字段是不可变只读快照。查询成本或 `ICatalogReadService` 的聚合恢复问题不在本变更中优化，除非后续有查询计划和性能证据。

**替代方案**：由向量索引保存可购买 SKU 和价格快照并直接回传。放弃该方案，因为索引会过期且无法裁决当前交易状态。

### 6. 真实 Milvus 使用隔离集合和可证明清理

每次 M1 运行生成独立集合名/命名空间和运行标识，记录创建、写入、检索、更新、删除、清理结果以及集合不存在的最终证据。测试不得复用生产商品集合，不执行 `FLUSHDB/FLUSHALL`，Redis 若需要只使用显式 `REDIS_TEST_ADDRESS` 的测试实例和随机命名空间。

**原因**：隔离和清理是验收条件，不以“查询成功”推断没有污染生产索引。

### 7. 故障回退与证据状态分层

运行时将参数/权限失败、未知工具、供应商 429/5xx、超时、连接中断、异常终止和模型不兼容分别归类。支持的上游故障可以回退到现有 RAG/导购，但回退必须记录 `DEGRADED`；没有真实依赖时使用 `NOT_RUN`，受控替身才使用 `STUB`，完整真实链路才使用 `REAL`。日志和报告只写脱敏类型、运行标识、时延、工具次数、Token/成本和摘要。

### 8. 版本锁定和供应商适配顺序

先以隔离实验验证 NVIDIA、讯飞、Embedding、Milvus 与 SDK 的真实兼容性，再锁定依赖版本和配置；不可用的供应商只在报告中标记 `NOT_RUN` 或 `DEGRADED`，不通过提示词模拟 Tool Calling。现有 `provider.py` 的兼容 Provider 结构不作为本次重构目标。

## Risks / Trade-offs

- **真实供应商配置缺失** → 保留受控 Stub 和协议回归，但报告必须标记 `NOT_RUN`/`STUB`，并把真实验收留给具备凭据的环境。
- **模型输出不稳定或不支持原生工具** → 只接受可解析的原生调用；不兼容时回退既有 RAG/导购，不执行文本猜测出的工具。
- **隔离 Milvus 清理失败** → 将清理失败作为阻断性验收问题，保存集合和运行标识，禁止宣称 M1 完成。
- **Scope/身份在多轮中漂移** → 每次工具调用携带服务端生成的 Scope 快照和代次，忽略模型自报的全局角色；越权或资源歧义返回澄清/拒绝。
- **实验契约与未来 M2 生产 DTO 漂移** → M2 开始前用契约测试把工具 Schema、Run 状态和权限矩阵映射到生成 API/行为契约；本次不把实验 DTO 暴露为公共接口。
- **查询恢复完整聚合的成本** → 先保留现有兼容实现，只有性能数据证明收益时再单独提出只读投影优化，不把 P2 审查建议混入 Agent 基线。

## Migration Plan

本次没有生产数据库、Redis 数据或公开 API 迁移。落地顺序为：

1. 合并 OpenSpec 契约和 DDD 设计文档，核对现有 SDD、ADR、HTTP/行为契约引用；旧导购继续作为默认路径。
2. 在独立 Python 环境配置真实模型、Embedding 和测试 Milvus；使用随机集合/命名空间执行 M1 生命周期测试，报告所有 REAL/STUB/DEGRADED/NOT_RUN 状态。
3. 若真实验证通过，再单独提出 M2 变更，设计最小 `ai_run` 表、Run/Scope 端口、Tool Gateway 和受控 Java 入口，并补齐 API/Schema/迁移与真实权限测试。
4. 若 M1 失败，关闭实验开关并删除隔离集合；旧 `/ai/chat`、SSE、Proposal 和交易链路保持原实现。不存在需要回滚的生产 DDL 或业务数据写入。

## Open Questions

无。供应商版本、模型选择和 M1 样本集合属于真实兼容测试后记录的运行参数，不改变本次契约或任务边界。
