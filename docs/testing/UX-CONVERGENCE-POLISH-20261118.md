# 产品需求收束与 UI/UX 去 AI 味打磨验证记录（2026-11-18）

## 1. 目标与边界

- **目标**：
  1. 从产品经理视角对平台功能需求进行收束，明确核心交付范围与非目标边界，输出三端功能架构与端到端业务闭环流程图（见 [PRODUCT-CONVERGENCE-20261118.md](../requirements/PRODUCT-CONVERGENCE-20261118.md)）。
  2. 从用户体验视角全面清理界面中的“AI 模板味”与生硬技术黑话，精简导航层级，缩短高频操作路径，修复布局细节并同步生成静态交付包。
- **不变量与契约边界**：
  - 未修改任何 Java 后端业务代码、SQL 迁移或 Python 服务接口，102 条 HTTP 路由与 OpenAPI Schema 零漂移。
  - 保留价格/库存/经营资格服务端实时复验、单商户结算、CSRF 校验、`Idempotency-Key` 幂等键、AI 推荐显式确认加购及 RBAC 细粒度权限门禁。

## 2. 主要优化内容

### 2.1 信息架构与导航收束
- **后台侧栏降噪**：将低频技术入口“RAG 调试”从商户端、平台端一级导航移除，更名为“问答检索测试”并收归“知识库”页面顶栏（同时提供“返回知识库”闭环与侧栏高亮联动）。
- **个人中心工作台打通**：已登录账号具备商户成员或平台管理员身份时，在消费者“个人中心”直接展示“商户工作台 / 平台管理端”快捷入口，并修复个人中心顶栏返回首页跳转。
- **首页筛选分层**：将“价格区间”筛选条从顶部搜索区下沉至“在售好物”排序栏下方，释放首屏空间；再次点击已选门店卡片支持直接取消筛选，并新增“进店逛逛”一键直达门店主页。

### 2.2 文案去 AI 味与去工程术语
- 去除首页与 AI 导购页悬浮星标装饰（`✦` / `✧`）；AI 推荐卡片去掉 `HOT PICK / DAILY / GOOD VALUE` 假英文角标，改为展示真实门店名称。
- 将“自提令牌”统一口语化为“自提码 / 自提凭证”；流式等待文案由“已读取 X 字节”改为“正在为你挑选合适商品…”；注册常驻提示去掉“UTF-8编码不超过72字节”，知识上传说明由“最多2,000,000字节”改为“不超过 2MB”；商品详情去掉“含税售价”改为“门店自提”。
- 后台经营概览、商品管理、库存管理、平台监管列表全面隐藏裸露的内部 `skuId` / `productId` / `merchantId` 标识，优先展示中文名称、分类与业务状态。

### 2.3 操作简化与视觉布局修复
- **AI 加购直达**：推荐提案确认加购后，原位展示“去购物车”按钮；支持点击商品图切换勾选。
- **订单与核销提效**：订单列表直接区分“备货中”与“待自提”；签发自提凭证后支持一键“复制自提码”；商户端库存表点击“补货”自动带入规格并聚焦数量输入框；自提核销页隐藏次要状态筛选并将核销框收敛为单行输入。
- **网格与样式对齐**：修复后台总览 5 项 KPI 卡片在桌面端第 5 项掉行问题（改为 5 列等宽响应式布局）；修复商品卡标题按钮左对齐与字重、购物车行内“移除”按钮排版、问答检索测试页卡片表格样式及无选中订单时表格自适应满宽。

## 3. 实际执行的检查与结果

> 说明：本节 7 层全链路真实验收在同分支完整工作树上执行，同时覆盖并更新前序记录 [DEFENSE-REVIEW-FIXES-20261118.md](DEFENSE-REVIEW-FIXES-20261118.md) 中当时标为 `NOT_RUN` 的隔离 MySQL / 双 Redis / 全量 Maven 集成与真实浏览器验收范围。

| 检查类别 | 执行命令 | 结果 | 说明 |
| --- | --- | --- | --- |
| 代码格式检查 | `npm run format:check --prefix frontend` | `PASS` | 前端 JS/TS/Vue/CSS 与 Java 格式全部通过 Prettier 校验 |
| 类型检查 | `npm run typecheck --prefix frontend` | `PASS` | `vue-tsc --noEmit` 零错误 |
| 构建与静态副本核验 | `python scripts/build-ui-bundle.py` && `python scripts/build-ui-bundle.py --check` | `PASS` | 56 个模块打包生成 `ui.bundle.js` 并同步 Spring `static/`，指纹一致 |
| 前端单元测试 | `npm test --prefix frontend` | `PASS` | 35/35 Node 单元测试全部通过 |
| 设计系统与多视口溢出检查 | `python frontend/tests/ui_shell_bundle.py` | `PASS` | CSP 严格模式样式加载 + 320/390/1440px 三端 27 项无横向溢出检查通过 |
| 全量 Chromium 界面契约回归（25 套） | `ui_copy_polish.py`、`ui_three_pages.py`、`ui_audit_contract.py`、`ui_sdd_integration.py`、`ui_contract_v11.py`、`ui_fix_regression.py`、`ui_rbac_regression.py`、`ui_global_sort.py`、`ui_list_pagination.py`、`ui_r1_correctness.py`、`ui_permission_correctness.py`、`ui_product_images.py`、`ui_remediation.py`、`ui_review_regression.py`、`ui_guide_conversation.py`、`ui_refund_recovery.py`、`ui_status_panel.py`、`ui_after_sale_history.py`、`ui_checkout_confirmation.py`、`ui_order_snapshot.py`、`ui_price_filter.py`、`ui_product_detail.py`、`ui_storefront.py`、`contract_ui.py` | `PASS` | 全部 25 套真实 Chromium 渲染与接口契约替身回归通过，零未捕获 JS 异常 |
| 契约与源码门禁（16 项） | `schema_contract.py --check`、`verify-supply-chain.py`、`verify-java-readability.py`、`scripts/tests`、`verify-mapper-scan.py`、`verify-api-contract.py`、`verify-api-schemas.py`、`verify-fix-regressions.py`、`verify-source.py`、`verify-domain.py`、`verify-http-body.py`、`verify-release.py` | `PASS` | 102 条路由、75 项 Schema、449 个 Java 源文件、44 张表与 DDD 依赖方向零违规 |
| 数据库 15 库迁移重放与漂移拒绝 | `verify-migrations.py --host 127.0.0.1 --port 18307` | `PASS` | 独立隔离 MySQL 8.0 实例：13/13 项新库/补历史/漂移审计/准入拒绝检查 + 3/3 历史发布基线升级重放全部通过 |
| Python AI 服务全量测试与容量评测 | `ai-service/.venv` 锁文件环境：`pytest -q`、`smoke-ai-local.py`、`verify-ai-load-isolated.py`、`evaluate.py` | `PASS` | **408/408 项 pytest 通过**（0 失败）；Uvicorn 本地检索 13/13 通过；80 请求并发准入限流与重启持久化恢复通过；3 组评测实验通过 |
| Java Maven 全量 7 模块集成与并发测试 | `mvnw.cmd -B -ntp test`（接入隔离 MySQL `18307` + 隔离双 Redis `18381`/`18382` + 故障隔离容器包装器 + `AGENT_RUNTIME_PROCESS_TEST=true`） | `PASS` | **449/449 项 JUnit/MySQL/Redis 测试全部通过（`failures=0, errors=0, skipped=0`，零跳过）**；Java-MySQL 评测适配器与安全评测通过 |
| 双 Java 实例共享 Redis 跨节点回归 | `smoke-redis-shared.py`（`18093` + `18094` 双真实节点共享 MySQL 与双 Redis） | `PASS` | **9/9 项通过**：跨节点共享会话、单边登出即时失效、RBAC 实时赋权/撤权、展示缓存价格版本/补货/下架一致性、共享限流与 `Retry-After` |
| 核心业务链路 HTTP + OpenAPI 核验 | `smoke-full.py --base-url http://127.0.0.1:18091 --check-contract` | `PASS` | **291/291 项通过**（含双用户并发抢最后 1 件库存、幂等键、知识权限隔离，**213 次真实响应**逐条通过 OpenAPI Schema 校验） |
| 真实全栈浏览器与七牛 CSP 验收 | `live_ui.py`（22/22）、`live_m2_fulfillment.py`（5/5）、三端 7 步核心闭环走查（7/7）、`verify-qiniu-csp-browser.py`（9/9） | `PASS` | 全部真实后端浏览器验收与严格 CSP 检查通过，未触碰本机原有 `3306`/`5173`/`8091` 服务 |
| 外部商业模型 / 云端 Milvus / 生产压测 | `smoke-ai-live.py` / 生产环境压测 | `NOT_RUN` | 按仓库规范，公网第三方供应商配额调用与生产容量不在常规本地验收中自动触发，按既有专项报告边界保留 |

## 4. 代码审查问题追补修复与专项回归（2026-11-18）

针对审查指出的 1 项 P1 合并阻断、3 项 P2 边界风险及 1 项 P3 无障碍体验问题，逐项完成源码修复并新增专项回归测试：

1. **P1 · SSE 流式响应跨分片 UTF-8 中文/Emoji 截断修复（`AiGatewayService.readSseAnswer`）**
   - **修复**：在 `CharsetDecoder.decode(input, chars, eof)` 返回 `UNDERFLOW` 且 `!eof && input.hasRemaining()` 时，将未消费的 1~3 字节多字节 UTF-8 前缀保存在 `carry` 缓冲中并与下一网络分片拼接解码，消除跨 TCP 分片切开多字节字符导致的 `\uFFFD` 乱码或 SSE JSON 解析失败。
   - **回归测试**：`AiGatewayProtocolTest#queryStreamReassemblesMultiByteChineseAndEmojiSplitAcrossChunkBoundaries`（同时覆盖将汉字“中” `0xE4 0xB8 0xAD` 在第 2 字节处拆包，以及包含中文与 4 字节 Emoji `🍜` 的完整 SSE 载荷按**逐单字节 `1 byte/chunk` 刷写**两种极端分片边界）。
2. **P2 · `RuntimeBridge` 同续接 / 同请求并发重入保护（`ai-service/app/runtime_bridge.py`）**
   - **修复**：在锁内维护 `_inflight_requests` 与 `_inflight_continuations` 集合（`finally` 必定释放），并在模型返回提交阶段校验当前续接实例未被替换，阻止同一 `continuationId` 或同一 `(runId, requestId)` 并发穿透锁重复调用上游模型。
   - **回归测试**：`test_runtime_bridge.py::test_concurrent_continue_and_inflight_duplicate_do_not_double_invoke_model`（通过线程栅栏构造真实并发重入，确认 `CONTINUATION_IN_PROGRESS` / `REQUEST_IN_PROGRESS` 快速返回 HTTP `409` 且上游模型仅被调用 `1` 次）。
3. **P2 · `RuntimeBridge` `CONTINUE` 阶段待处理工具调用严格核验（`ai-service/app/runtime_bridge.py`）**
   - **修复**：将 `_Continuation.pending_calls` 升级为 `(callId, name)` 元组序列，在 `CONTINUE` 阶段严格校验 `toolResults` 数量无增减、`callId` 无重复、每个 `(callId, name)` 与待处理调用一一对应，并按原调用顺序归一化写入上下文；同时拒绝模型返回重复 `callId`。
   - **回归测试**：`test_runtime_bridge.py::test_continue_validates_pending_tool_call_ids_count_names_and_duplicates`（覆盖少传、多传、重复 ID、错误 ID、错误工具名 5 类拒绝场景及乱序合法结果归一化）。
4. **P2 · Redis 准入信号量 Key 丢失自愈与容量耗尽区分（`AiResourceRepository.acquire`）**
   - **修复**：当 `tryAcquire` 返回 `null` 时，通过 `recoverMissingSemaphore` 利用 Redisson `trySetPermits` 底层 Lua `GET == false` 原子判空特性：若因容量真实耗尽（Key 仍存在且值为 `0`）则保持返回 `AI0001` 不超发许可；若因 Redis 重启或 Key 被淘汰删除则原子重设初始许可并重试获取一次。
   - **回归测试**：新增单测 `AiResourceRepositoryTest` + 增强真实 Redis 集成测试 `RedisInfrastructureIntegrationTest`（实测删除 `:ai:admission:v1` 后同一仓储实例可自动恢复准入，且恢复后并发超额请求仍被 `AI0001` 拦截）。
5. **P3 · AI 推荐卡片商品图片支持键盘无障碍操作（`GuideRecommendations.vue`）**
   - **修复**：将 `.rec-photo` 由可点击 `<div>` 改为语义化 `<button type="button">`，补充 `aria-label` 与 `aria-pressed` 状态同步及按钮盒模型重置。
   - **回归测试**：`frontend/tests/ui_guide_conversation.py` 增加对 `button.rec-photo` 的键盘 `focus()` + `Space` / `Enter` 切换勾选与 `aria-pressed` 状态断言。
