# 青柠校园前端

> 当前源码入口：`frontend/src/`。业务与交互规范见 [前端开发](../docs/development/FRONTEND.md) 和 [前端设计](../docs/development/FRONTEND-DESIGN.md)。

## 技术栈与边界

- Vue 3 + Vite，消费者移动优先，商户与平台使用桌面工作台；新模块优先 Vue SFC/TypeScript，既有 JS 页面渐进迁移。
- 浏览器只调用同源 Java API，使用 Cookie Session、CSRF 和服务端 RBAC。演示数据只在显式 `?demo=1` 时启用，生产路径不使用前端假成交。
- `src/vue-runtime.js` 是 `main.js` 的首个导入，为尚未迁移的 JS 组件注入 `window.Vue`；不要重复加载全局 Vue。
- 异步页面必须按账号、商户、会话和请求代次隔离响应，旧请求不能覆盖当前主体。

## 构建

```bash
npm ci --prefix frontend
npm run dev --prefix frontend
npm run typecheck --prefix frontend
npm test --prefix frontend
npm run format:check --prefix frontend
python scripts/build-ui-bundle.py
python scripts/build-ui-bundle.py --check
```

`npm run build --prefix frontend` 只生成 `frontend/dist/`。正式同源交付由 `scripts/build-ui-bundle.py` 构建 `ui.bundle.js`、写入 UI 指纹并同步 Spring 静态快照。`frontend/ui.bundle.js` 与 `campus-shopping-app/src/main/resources/static/` 都是生成产物，禁止手改。

## 页面

- 消费者：首页、商品详情、AI 导购、购物车、订单/自提/售后、账号、商户申请和邀请。
- 商户：概览、商品、库存、订单、核销、售后、成员/角色、门店和知识库。
- 平台：概览、入驻审核、商户/商品/订单监管、争议、类目和知识库。

路由与入口以 `src/main.js` 和 `src/pages/` 为准；接口字段以 [生成 HTTP 契约](../docs/api/http-api.md) 和 `src/services/api-types.ts` 为准。

## 测试

```bash
npm test --prefix frontend
python frontend/tests/ui_shell_bundle.py
python frontend/tests/ui_design_system.py
python frontend/tests/ui_three_pages.py
```

CI 还执行权限、商品图片、结算确认、退款、订单快照、价格筛选和真实后端页面回归。Chromium 契约替身不能代替 Spring/MySQL 页面验收；完整矩阵与检查名见 [AI 开发流程](../docs/development/AI-WORKFLOW.md)。

本地运行测试默认把截图和结果写到 `var/verify/`。只有 CI 或明确发布证据时设置 `CAMPUS_EVIDENCE_DIR` 指向 `docs/testing/evidence`。

## 兼容入口

`campus-shopping-app/src/main/resources/static/legacy.html` 及其 `assets/` 是早期页面的兼容入口，单独由 `browser-contract/legacy` 验证。当前开发和缺陷修复只改 `frontend/src/`；不得把新逻辑写回 legacy 资源。
