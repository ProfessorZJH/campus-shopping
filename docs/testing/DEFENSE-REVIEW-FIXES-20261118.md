# 毕设答辩前多维审查缺陷修复与治理记录（2026-11-18）

## 1. 目标与范围

基于对 `main`（`f5fc538`）的全栈审查结论，在不改变任何已冻结 HTTP/DDL 外部业务契约的前提下，集中修复 Java 网关/协议层、Python `ai-service` 可观测性与并发状态、前端跨平台构建归一化、CI 漏跑测试以及文档/ADR 编号冲突，确保答辩演示与源码走读稳健一致。

工作分支：`codex/defense-review-fixes`。

## 2. 修复清单

### 2.1 Java 后端与网关层
- **流式网关断流快速失败**：重构 `AiGatewayService.queryStream`，以有界响应式 `HttpResponse.BodySubscriber` 替代 `BufferedReader.ready() + Thread.sleep(25)` 轮询，消除下游异常断流（EOF）时 `available() == 0` 导致线程与 Redis 共享准入槽位空等至完整超时上限的缺陷。
- **独立 SSE 新会话标识补齐**：在 `AiStreamEndpoint` 中捕获 `started` 阶段生成的 `conversationId`，供后续 `progress`、`cancelled`、`failed` 事件统一回传（不再对新建会话发送 `null`），并将流式执行池上限对齐至 `32`。
- **协议层价格参数异常提示解遮蔽**：将 `minPriceCent` / `maxPriceCent` 类型绑定错误的明确提示收敛至 `ApiProtocolExceptionResolver` + `ApiErrorWriter`，移除 `CatalogController` 中被 `HIGHEST_PRECEDENCE` 遮蔽的不可达 `@ExceptionHandler`。
- **Agent 用例接口收敛与中文短语兜底**：修复 `AgentToolInvocationCaseImpl` 第 48 行乱码注释；将 `AgentToolInvocationCaseImpl` 与 `AgentRuntimeCaseImpl` 对 `AgentRunCaseImpl` 的具体类依赖收敛至 `IAgentRunCase` 接口；为 `search_products` 补充长中文自然短语的二元词兜底召回；为 `AgentRuntimeGateway` 接入可选的 `IAiResourceRepository` 共享准入保护；优化 `AiResourceRepository.acquire()` 避免每次调用重复执行 `trySetPermits` 网络往返。

### 2.2 Python `ai-service` 与评测执行器
- **Milvus 就绪探针恢复**：为 `ProductIndex` 的 `upsert`、`search`、`delete` 补充 `@observed` 指标记录，并在 `observability.observed` 中标记已记录异常以避免路由层重复计数，修复启用 Milvus 时 `/ready` 因缺少 `last_success_at` 永久处于 `UNVERIFIED`/`DEGRADED` 的缺陷。
- **流式线程链路追踪上下文传播**：在 `app/main.py` `/v1/query/stream` 中通过 `contextvars.copy_context().run` 启动工作线程，保留 `X-Request-ID` 日志关联。
- **`RuntimeBridge` 并发安全与有界缓存**：在 `app/runtime_bridge.py` 中增加 `threading.RLock()`、按租约到期与容量上限（默认 `512`）清理 `_continuations` 和 `_responses`，并在下游模型成功返回后再提交会话历史变更，消除重试污染与长稳内存增长；根据非回环 HTTPS 模型配置区分 `REAL` / `STUB` 证据状态。
- **Agent 外发 PII 脱敏与评测属性透传**：在 `app/agent_provider.py` 中接入消息级手机号/身份证号/邮箱脱敏与无正文 `audit`；修复 `evaluation/runner.py` `offers_for()` 漏传 SKU `attributes` 字典的问题。

### 2.3 前端交互细节、工程门禁与毕设文档体系
- **跨平台构建、脚本入口与前端状态收敛**：在 `frontend/scripts/build-files.mjs` 与 `.gitattributes` 补入 `.ts`、`.vue` 等文本扩展名的 LF 归一化；同步 `frontend/src/services/api-types.ts` 中 `ProposalItem` 的 `productId` 与 `detailAvailable` 字段；统一 `frontend/src/services/store.js` 中 `merchantPage.size` 默认值为 `9`（与商家页分页请求对齐）；在 `frontend/src/pages/Guide.js` 流式连接中断轮询满 30 秒仍未收口时补充显式用户提示；在 `frontend/package.json` 补充 `npm test` 脚本并重新同步 UI 产物。
- **CI 漏跑补齐与本地工作区零污染**：将 `.github/workflows/full-release.yml` 中的脚本单测改为 `unittest discover -s scripts/tests -p "test_*.py"`，纳管 `ui_permission_correctness.py` 浏览器契约检查；将 `verify-release.py`、`verify-domain.py`、`verify-ddd-boundaries.py`、`verify-api-schemas.py`、`verify-http-body.py` 的默认输出路径迁至忽略目录 `var/verify/`（保留 `--output` 参数）。
- **ADR 重号、根 `README.md` 焕新与毕设全周期资料包**：整理 [ADR](../architecture/decisions.md) 章节顺序，将重号的第二个 `ADR-017` 与第二个 `ADR-020` 顺延为 `ADR-021`、`ADR-022` 并更新验收状态；重写根目录 [README.md](../../README.md) 消除早期过时状态描述；统一 [文档索引](../README.md)、[状态路线](../ROADMAP.md)、[交付说明](../DELIVERY-R1.md) 与 [门禁说明](../development/REPOSITORY-GATES.md) 中的 `102` 条路由计数、独立 SSE 交付状态及 PR 触发说明；新增 [毕设全周期导航与资料包](../thesis/README.md)（覆盖开题答辩指南、6 章论文蓝图、44 表/102 路由架构数据手册、消融实验 SOP 与终期答辩问答库）。

## 3. 实际验证与边界

- **已执行并通过（测试通过）**：
  - 前端格式、TS 类型、Node 单测与 UI 产物一致性：`npm run format:check --prefix frontend`、`npm run typecheck --prefix frontend`、`npm test --prefix frontend`（35/35 通过）、`python scripts/build-ui-bundle.py --check`。
  - 契约、DDL、供应链、Mapper 与源码边界门禁：`schema_contract.py --check`、`verify-supply-chain.py`、`verify-api-contract.py`（102 条路由）、`verify-api-schemas.py`（75 项）、`verify-java-readability.py`、`verify-mapper-scan.py`、`verify-fix-regressions.py`、`verify-release.py`、`verify-domain.py`（56 项）、`verify-http-body.py`（6 项）及 `scripts/tests` 全量单测（37 项）。
  - Chromium 契约全量回归：CI 编排的 `22` 组现行 Vue 浏览器契约套件（含 `ui_audit_contract.py`、`ui_global_sort.py`、`ui_guide_conversation.py`、`ui_permission_correctness.py` 等）及 `contract_ui.py` 兼容套件全部通过（`23/23 PASS`）。
  - Java Maven 全量单测回归：7 模块编译与 `.\mvnw.cmd -B -ntp test "-Dfrontend.skip=true"` 全套运行通过（总计 `440` 项，`329` 项本地独立单测全部通过，`0` 失败 / `0` 错误，`111` 项依赖外部 `MYSQL_TEST_URL` / Redis / 独立进程的集成测试按预设条件跳过；含新增流式断流快速失败、价格参数类型错误提示、中文短语二元词兜底用例）。
  - Python `ai-service` 全量 pytest：锁定依赖环境（Python 3.11 + Pydantic 2.13.5）下 `408` 项全部通过（0 失败）；离线评测 smoke（`evaluate.py --dataset campus-shopping-v1 --split smoke --profile local`）退出码 `0`。
- **未在本轮执行（`NOT_RUN`）**：
  - 本轮未启动隔离 MySQL / Redis / Docker 容器执行全栈集成验收（`verify-mysql-isolated.py`、`smoke-full.py`、`live_ui.py`），亦未调用外部真实大模型与云端向量服务；合并或发布前仍按远端 `Campus Shopping - Real Acceptance` 完整流水线核验。
