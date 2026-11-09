# Tasks

## 1. 协议与 Domain Port

- [x] 1.1 定义版本化 Runtime turn 请求/结果、Scope、工具定义、工具结果和 continuation 数据模型，并冻结字段、大小上限和状态枚举；用共享 JSON fixtures 验证 START、TOOL_CALLS、CONTINUE、FINAL、FAILED 五类报文可互相解析。
- [x] 1.2 将 `IAgentRuntimePort` 扩展为不依赖 HTTP 的不可变 command/result 调用，保留 capability 明文只在调用上下文存在；运行 domain 编译与依赖边界检查，确认 domain 不依赖 infrastructure、Spring 或 FastAPI。
- [x] 1.3 实现 Run capability、Scope/租约、request/continuation fingerprint 的 canonical 计算及 HMAC 签名规则；单元测试覆盖篡改、过期、不同载荷复用 key 和签名不匹配，并断言凭据不出现在序列化日志。
- [x] 1.4 复核现有 `ai_run`/`ai_run_invocation` 持久化能保存幂等调用摘要、continuation 关联和脱敏结果；执行 `python scripts/schema_contract.py`（或等价只读核验），确认不新增第二种租约、不写入交易表且已发布迁移未被修改。

## 2. Python 内部 Runtime

- [x] 2.1 新增仅内部可用的 Runtime turn handler、严格 Pydantic 请求/响应模型和服务密钥/capability 签名校验；TestClient 覆盖合法请求、缺少/错误凭据、过期租约、公开路由不可用和请求体上限。
- [x] 2.2 将模型调用路径拆出决策模式：只提供白名单只读工具的 JSON Schema，返回原生 TOOL_CALLS 或 FINAL，不在内部 HTTP 路径执行 Java 业务工具；Python 单测覆盖原生调用、完整回答、文本伪调用、未知工具、缺失参数和非法响应。
- [x] 2.3 实现 continuation 结果接收、request key 去重和工具调用/往返上限；单测覆盖相同载荷重放、不同载荷冲突、过量调用以及 Runtime 重启/状态缺失时的安全失败。
- [x] 2.4 统一 Python 侧 401/403、422、429、5xx、模型超时和取消处理，确保 ExecutionGate/模型许可持有到实际工作结束；测试断言响应与日志不含 token、提示词、工具参数正文或下游异常正文。

## 3. Java Infrastructure Adapter 与 Case 编排

- [x] 3.1 实现 Runtime HTTP adapter，使用固定配置地址、HTTP/1.1、服务密钥、capability/signature/request ID、连接/总时限、响应体上限和禁止重定向；JUnit 覆盖序列化、native result 解析、取消、429/5xx/401/403/422/非法 JSON 的稳定映射。
- [x] 3.2 在非事务上下文编排 Run：每轮复核 capability、Scope 和 `turn_token/turn_expires_at`，处理 TOOL_CALLS、调用既有 `AgentToolInvocationCase`、提交只读结果并继续，最终在短事务中完成或失败 Run；单测覆盖租约过期、越权、重复调用、上限和无交易写入。
- [x] 3.3 将 adapter 错误与现有 `ResponseCode` 对齐，区分 Java 本地 AUTH/STATE/REQUEST 冲突与远程 AI_UNAVAILABLE；验证日志只含 request ID、Run ID、状态类别和耗时，且旧 `AiGatewayService` 的 `/v1/query` 行为测试保持通过。
- [x] 3.4 增加默认关闭的 Runtime bridge 配置、bean 条件和灰度回退；启动/配置单测确认关闭时旧 `/ai/chat`、SSE、Proposal 路径不变，协议版本不兼容时安全失败而不执行写操作。

## 4. Java/Python HTTP Harness 与证据

- [x] 4.1 编写 Java loopback HTTP 集成测试，串起 Run 创建、内部 Runtime native TOOL_CALL、Java `search_products` 事实复验、CONTINUE 和 FINAL；使用隔离数据并断言购物车、订单、库存、支付未被写入。
- [ ] 4.2 扩展真实 harness 启动隔离 Uvicorn 与 Java 服务，覆盖服务认证、Scope/租约、幂等、超时、429、5xx、脱敏和清理；输出 `REAL`、`STUB`、`DEGRADED` 或 `NOT_RUN`，缺 Java/隔离依赖时不能伪造 PASS。
- [x] 4.3 在 `docs/testing/` 保存本变更的实际命令、环境范围、协议版本、Run/工具调用数量、耗时、错误矩阵和清理证据；明确旧 `/v1/query`、外部模型、Embedding、Milvus 以及 M1 4.3/4.4 的未验证边界。

## 5. 交付门禁

- [x] 5.1 运行相关 Python pytest、Java 目标 JUnit、`mvnw` 编译/验证、`python scripts/verify-release.py`、API/schema/DDD 检查和 `git diff --check`；失败项保留原始结果并修复后重跑。
- [x] 5.2 运行 `openspec validate agent-v1-1-m2-runtime-bridge --strict --no-interactive` 与 `openspec status --change agent-v1-1-m2-runtime-bridge`，确认 proposal、spec、design、tasks 完整，实际代码/测试/真实联调状态分别记录。

## Workflow follow-up

- 通过评审并获得新的实施授权后，按本任务清单启动 apply；本次提案阶段不修改业务代码、不开放公开 Agent Trigger。
- 真实外部 NVIDIA、讯飞、Embedding、Milvus 和生产灰度验收另行记录，不能由本变更的协议测试替代。

