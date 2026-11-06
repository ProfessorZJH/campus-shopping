# M1：明确缺陷与公共前端基础（2026-11-05）

## 结论与范围

本报告记录产品化规划 M1（任务 2.1～2.8）在当前工作树的实现和验证。**2.1～2.7 已完成并通过本地定向回归；2.8 的格式、UI 生成和 Chromium 检查通过，但真实后端页面验收尚未完成（隔离环境缺少 Redis，见下文）。** 工作树为 `G:/develop/campus-shopping-worktrees/productization-m1`，分支 `codex/productization-m1`，基于 `origin/main` `45ccbd1`。代码尚未提交、推送或合并。

本阶段没有修改 Java/DTO、HTTP 契约、数据库迁移或权限规则；没有启动、迁移或清理既有业务库，没有复用既有 Redis，没有调用真实外部模型。浏览器契约测试使用显式命名的 API 替身，不能据此宣称 Spring/MySQL 端到端通过；隔离验收结果单独标注。

## 2.1 退款动作的失败恢复

- `Orders.js` 的 `load()` 返回刷新是否成功；`action()` 返回 `{ok, refreshed}`，只有写请求成功且当前订单/请求代次未变才视为成功。写成功但详情刷新失败时提示“操作成功，但页面刷新失败，请稍后手动刷新”。
- `submitRefund()` 只在业务成功且订单仍是同一笔时才关闭表单并清空原因；业务拒绝、网络失败、切换订单后的迟到响应都保留原输入或忽略旧响应。
- 新增 `frontend/tests/ui_refund_recovery.py`，以真实 Chromium + API 契约替身覆盖五个场景：业务拒绝保留原因、成功才清理、写成功后刷新失败、提交中重复点击只发一次、切换订单后的迟到响应不污染新页面。
- 首轮执行发现原页面在刷新失败后只弹出瞬时 toast，用户看不到详情错误；改为由公共 `StatusPanel` 显示错误和“重新加载”按钮，测试断言随之更新，未放宽失败恢复要求。

## 2.2 表单横向检查

复核了登录、商户入驻、商品创建/编辑、库存补货、售后退款审核表单的实际提交路径：

| 表单 | 触发条件与现状 | 结论 |
|---|---|---|
| 登录/注册 | `AuthDialog` 在请求中禁止重复提交，错误显示在弹窗内；密码只在成功后清空。 | 已有保护，不改 |
| 商户入驻 | `Account.submit()` 保存表单快照，失败保留全部输入和幂等键；账号/路由变化后丢弃迟到结果。 | 已有保护，不改 |
| 商品创建/编辑 | 保存按钮受 `saving` 等状态约束；多图逐文件失败/重试沿用既有实现，失败不伪装保存成功。 | 见 2.8 图片回归，不改 |
| 库存补货 | `canAct` 同时检查加载、错误、权限和 busy；幂等键只在成功后清空，失败可用同一内容重试。 | 已有保护，不改 |
| 退款审核 | 商户/平台审核都要求填写审核说明，提交中禁用；失败保留说明并提示。 | 已有保护，不改 |

本阶段没有发现需要在这个批次新增修复的同类缺陷，因此没有对这些表单做无关重构。登录切换、账号/商户切换和审核失败等既有行为由 `ui_fix_regression.py`、`ui_three_pages.py` 和 `contract_ui.py` 继续覆盖。

## 2.3 公共卡片与状态反馈

- 新增 `frontend/src/components/StatusPanel.vue`，提供 `loading`、`empty`、`error` 三种状态，支持消息、操作按钮、提交中禁用；错误态使用 `role="alert"` / `aria-live="assertive"`，加载和空态使用 `role="status"` / `aria-live="polite"`。按钮可键盘触发。
- `Orders.js` 的加载、错误、空列表、未找到订单统一使用该组件；`Platform.js` 的加载、错误和全部路由内容外层也接入，避免加载/错误时继续显示上一状态内容。
- `app.css` 增加 `surface-card`、`status-panel` 及窄屏布局；错误重试按钮在 400px 以下保持至少 40px 高度。
- 新增 `frontend/tests/ui_status_panel.py`，覆盖订单加载态、错误态键盘重试、空态与桌面错误态无横向溢出；管理端错误重试（390px/1280px）及 AI 提交中禁用、失败恢复输入、Enter 重试。5 项通过。

## 2.4 SFC 试点与唯一 Vue 运行时

- 试点组件为 `StatusPanel.vue`（`<script setup lang="ts">`），由订单页和管理端页面实际使用。
- `frontend/src/vue-runtime.js` 是 `main.js` 的第一导入，把 npm `vue@3.5.45` 写入 `window.Vue`，保证旧 JS 组件在模块求值时拿到唯一运行时；`index.html`、`offline.html` 不再加载 vendor 全局脚本。
- `vite.config.js` 和 `scripts/build.mjs` 接入 `@vitejs/plugin-vue`；库模式显式 `define` 生产环境，避免 `process is not defined`。
- 删除 `frontend/vendor/` 与 `frontend/public/vendor/vue.global.prod.js`；保留 `public/vendor/LICENSE.txt` 许可文件。生成副本由 `scripts/build-ui-bundle.py` 统一刷新。
- 开发、离线、Java 静态服务和 CSP 由 `ui_shell_bundle.py`（2 项）及 Vite dev 检查覆盖；两者都确认只加载打包运行时、无 vendor 请求。

## 2.5 TypeScript 试点

- 新增 `tsconfig.json`（`strict`、`allowJs: true`、`checkJs: false`、`noEmit`），独立脚本 `npm run typecheck --prefix frontend` 执行 `vue-tsc --noEmit`。
- `src/services/api-types.ts` 按当前 `docs/api/openapi.json` 定义传输层类型；`src/services/ai-citations.ts` 提供 `citationsOf()`，由 `Guide.js` 的运行路径调用，验证 `.ts` 与 `.js` 共存。
- 临时写入 `const probe: number = 'not-a-number'` 后执行类型检查，得到 `TS2322` 并退出 2；删除探针后恢复通过。未把全仓转换为 TypeScript。
- 推广条件与构建入口写入 [前端开发与构建入口](../development/FRONTEND.md)：新模块需同时通过类型检查、相关 Chromium 回归，以及 Java 静态/离线/CSP 加载验证。

## 2.6 新对话与会话隔离

- `Guide.js` 增加“新对话”入口：递增 `conversationEpoch`，清空会话 ID、消息、提案、选择、错误、输入和进行中标记；旧请求返回时因代次不符被丢弃。
- 历史会话分页使用独立 `historyEpoch`；打开历史、确认/放弃提案和提问都校验当前代次与账号；账号切换 watch 清空消息、提案和输入。
- 新增 `frontend/tests/ui_guide_conversation.py`，5 项覆盖：新对话后旧响应不写入、仍可继续提问、引用可展开且无内部直链、历史无引用不拼造、会话失效并换账号后清空旧状态。首轮发现测试只让 `/ai/conversations` 返回 401，而 `/auth/me` 仍登录导致自动重登循环；修正为两条接口同时返回 401 后通过。
## 2.7 引用展示

- 当前回答的引用保留 `documentId/title/snippet` 结构，以 `<details><summary>` 展示标题，展开显示片段；没有构造内部文档直链。`citationsOf()` 对缺失引用返回空数组，历史消息没有引用时不显示引用区。
- `ui_guide_conversation.py` 断言引用标题、片段可展开、无 `<a>` 链接；历史消息缺失引用时页面不拼造。

## 2.8 最终检查与结果

| 检查 | 结果 |
|---|---|
| `npm run format:check --prefix frontend` | PASS，`All matched files use Prettier code style!` |
| `npm run typecheck --prefix frontend` | PASS；故意类型探针得到 `TS2322`，删除后恢复 PASS |
| `python scripts/build-ui-bundle.py` / `--check` | 生成 858.06 kB / gzip 156.45 kB；`UI source/artifacts verified` |
| `python frontend/tests/ui_guide_conversation.py` | PASSED 5 |
| `python frontend/tests/ui_refund_recovery.py` | PASSED 5 |
| `python frontend/tests/ui_status_panel.py` | PASSED 5 |
| `python frontend/tests/ui_shell_bundle.py` | PASSED 2 |
| `python frontend/tests/ui_three_pages.py` | PASSED 23，Chromium 无未捕获异常 |
| `python frontend/tests/ui_fix_regression.py` | PASSED 11 |
| `python frontend/tests/ui_copy_polish.py` | PASSED 4 |
| `python frontend/tests/ui_product_images.py` | PASSED 24（真实 Chromium + API 契约替身：多图、缺图、失败重试、七牛路径） |
| `node --test tests/product-image-field.test.mjs tests/product-image-list.test.mjs`（`frontend/`） | 23 tests / 23 pass / 0 fail |
| `python frontend/tests/contract_ui.py` | 20 checks passed，无浏览器错误 |
| `python scripts/verify-release.py` | PASS，363 Java sources / 163 SQL statements；拒绝夹具全部被拒 |
| `npm audit --prefix frontend` | 0 vulnerabilities |
| Vite dev（`node frontend/node_modules/vite/bin/vite.js frontend --host 127.0.0.1 --port 5177`） | 页面挂载，`window.Vue` 为 3.5.45，无 vendor 请求；API 替身下仅有预期的 401 控制台记录 |
| 隔离 MySQL/Maven/HTTP/Chromium（`verify-mysql-isolated.py --http-smoke`） | **Maven BUILD SUCCESS，361 tests / 0 failures / 9 skipped**；脚本要求 skipped=0，在启动 HTTP/浏览器阶段前中止。跳过项为 1 个 MySQL 集成用例和 8 个 Redis 用例；本机无隔离 Redis，未复用既有 6379。真实后端页面验收 **NOT_RUN**。 |

补充说明：

- `ui_three_pages.py` 原第 5 段断言已不存在的“登录账号”内联按钮，实际入口是现行全局“请先登录”门禁；已改为断言门禁并点击“登录”，保留“未登录商户可进入认证并重新获取数据”的原意图。修正测试入口后 23 项通过。
- `ui_refund_recovery.py` 原断言 `.inline-error`，现统一由 `StatusPanel` 显示错误；改为断言 `.status-panel--error` 和“重新加载”，未减少错误可见性要求。
- 当前环境没有 `chromium` 命令；测试通过 `CHROMIUM_PATH` 指向本机 Chrome/Playwright Chromium。该变量只影响浏览器可执行文件定位，不改变页面断言。
- `npm audit` 在依赖升级后为 0 漏洞：`vue@3.5.45`、`vue-tsc@3.3.14`，`@vue/compiler-dom` 对齐 3.5.45。

## 明确未验证 / 未完成

- **提交、推送、PR、CI、合并**：未执行；本报告不代表远端门禁或最终业务验收。
- **真实后端页面验收**：`verify-mysql-isolated.py --http-smoke` 已用新建临时 MySQL 执行完整 Maven，BUILD SUCCESS（361 tests，0 failures，9 skipped）；因为脚本要求 0 skipped，且在未配置隔离 Redis 时 8 个 Redis 用例和 1 个 MySQL 用例被跳过，脚本在启动 HTTP/浏览器阶段前失败。**没有复用本机已有 Redis，也没有把该结果写成浏览器验收通过。** 需要在具备隔离 Redis 的环境重跑后，才能勾选 2.8。
- **真实外部 AI/模型**：未调用；AI 契约替身只验证请求/渲染路径。
- **生产部署、真实域名 HTTPS、性能与多实例**：未验证，按规划后续阶段或独立条件处理。
- **图片能力**：已运行 `ui_product_images.py`（24 项）及 23 项 Node 图片组件测试，均通过；真实对象存储上传、七牛联通和真实媒体服务不在本阶段范围。
- 隔离验收的具体日志/失败项见 `docs/testing/evidence/productization-m1/isolated.json` 及 Maven/Browser 未启动说明；未用替身结果替代真实后端。
