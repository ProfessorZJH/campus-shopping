# 前端开发与构建入口

适用于 `frontend/` 下的 Vue 3 界面。业务规则、接口和页面验收仍以 [AI 开发流程](AI-WORKFLOW.md)、[工程入口](../../AGENTS.md)及对应规格为准；本文只说明当前工具链和迁移边界。

## 源码与运行时

- 唯一源码在 `frontend/src/`，主入口为 `src/main.js`；`campus-shopping-app/src/main/resources/static/` 和 `frontend/ui.bundle.js` 是生成副本，禁止手改。
- Vue 运行时由 `package.json` 锁定的 `vue` 提供。`src/vue-runtime.js` 必须保持为 `main.js` 的第一个导入：它把打包运行时写入 `window.Vue`，供尚未迁移的旧 JS 组件在模块求值时使用；页面和测试不再加载 `vendor/vue.global.prod.js`。
- 新组件优先使用 `.vue` 单文件组件；旧 JS 组件在过渡期继续兼容。`vite.config.js` 和 `scripts/build.mjs` 均启用 `@vitejs/plugin-vue`，旧 JS 静态 `template` 仍由 `scripts/template-plugin.mjs` 预编译，不依赖运行时模板编译或 `unsafe-eval`。
- 公共状态反馈使用 `src/components/StatusPanel.vue`（加载、空态、错误重试、提交中禁用），卡片底色使用 `surface-card`；页面只在确有对应状态时接入，不改变业务动作本身。
- 品牌变量、样式模块、按钮、表单、弹窗和分页的使用方式见 [前端设计与交互约定](FRONTEND-DESIGN.md)。`UiPagination.vue` 只管理翻页控件的显示与事件，分页数据和请求仍由页面持有。

## 常用命令

在仓库根目录执行：

```text
npm run dev --prefix frontend          # 开发服务器，默认 127.0.0.1:5173
npm run typecheck --prefix frontend    # vue-tsc --noEmit，检查 .ts/.vue
npm run format --prefix frontend       # Prettier：js/ts/vue 及 Java
npm run format:check --prefix frontend
node scripts/build.mjs                 # 等价于 npm run build --prefix frontend
python scripts/build-ui-bundle.py      # 正式生成 ui.bundle.js、UI 指纹并同步 Spring 静态副本
python scripts/build-ui-bundle.py --check
```

- `npm run build --prefix frontend` 只生成 `frontend/dist/`；交付和 Maven 使用的静态副本必须由 `scripts/build-ui-bundle.py` 生成，后者会统一文本换行、写入 `ui-build.json` 并同步 `campus-shopping-app/src/main/resources/static/`。
- `scripts/build.mjs` 在库模式下显式把 `process.env.NODE_ENV` 固定为 `production`；不要删除该 `define`，否则 Vue 运行时在浏览器中会因 `process` 未定义而失败。
- 提交前至少运行 `format:check`、`typecheck` 和 `build-ui-bundle.py --check`；修改浏览器可见行为时再运行相关 Chromium 回归。

## TypeScript 试点与推广条件

- 当前 `tsconfig.json` 使用 `allowJs: true`、`checkJs: false`：`.ts`/`.vue` 严格检查，既有 `.js` 不因个别类型缺失阻塞构建。`src/env.d.ts` 声明兼容入口和测试注入的全局变量。
- API 传输类型在 `src/services/api-types.ts`，按 [OpenAPI](../api/openapi.json) 核对；视图状态与传输类型分开，避免把页面内部字段写进接口类型。`src/services/ai-citations.ts` 是当前运行路径上的类型化投影示例。
- 新增或迁移到 TypeScript 的模块须同时满足：`vue-tsc` 通过、相关 Chromium 行为回归通过、构建产物在 Java 静态服务/离线/CSP 下可加载。满足后再逐页推广，不以全仓改写作为业务迭代前置；旧 JS 页面可以继续只做被调用处的窄类型导入。

## 验证边界

- Chromium 契约测试使用明确的 API 替身时只能证明页面行为，不能声称为 Spring/MySQL 端到端。真实后端页面验收使用 `scripts/verify-mysql-isolated.py --http-smoke` 的隔离 MySQL 环境；本地未执行时在交付报告中写明。
- 静态/CSP 样式加载和键盘焦点检查见 `frontend/tests/ui_shell_bundle.py`；三端设计预览的 320/390/1440px 检查见 `frontend/tests/ui_design_system.py`。DOM 注入式测试通过 `browser_transport.add_campus_styles` 按入口顺序加载样式模块。
- Maven `clean verify` 会从源码重新构建 UI。全量构建需要隔离 MySQL/Redis 环境，见 [AI 开发流程](AI-WORKFLOW.md) 的测试矩阵。
