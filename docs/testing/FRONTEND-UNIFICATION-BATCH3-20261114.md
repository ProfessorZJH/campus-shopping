# 前端统一第三批：消费者与智能导购

日期：2026-11-14。代码测试基线：`64d2149755dc176d5bf2ee080fc9e1b40b315228`，基于前两批变更。

导购对话、历史与推荐视图拆为 Vue 组件；消息、流式请求、取消恢复、提案确认、身份切换和原有请求竞态保护仍由页面和传输层负责。历史展开与推荐选择增加可访问状态。购物车加载及错误使用公共状态面板，失败时支持重新加载且不误显示空购物车。

| 实际执行 | 环境与范围 | 结果 |
|---|---|---|
| `npm run typecheck --prefix frontend`、`npm run format:check --prefix frontend` | Node 22.16.0，仓库锁文件 | PASS |
| `python scripts/build-ui-bundle.py` 及 `--check` | 当前前端源、离线和 Java 静态副本 | PASS |
| `node --test frontend/tests/*.test.mjs` | 本地 JavaScript 测试，含流式断线恢复与身份竞态 | 35 项 PASS |
| `ui_shell_bundle.py` / `ui_design_system.py` | Chromium 静态预览，320、390、1440 像素，9 个消费者和后台路由 | 27 个视口组合 PASS，含商品详情与导购；离线、CSP、键盘焦点检查 PASS |
| `ui_guide_conversation.py`、`ui_status_panel.py` | Chromium + HTTP 契约替身 | PASS；覆盖历史、推荐选择、价格变化、失败恢复及购物车错误重试 |
| `ui_r1_correctness.py`、`ui_checkout_confirmation.py`、`ui_product_detail.py`、`ui_price_filter.py`、`ui_order_snapshot.py`、`ui_after_sale_history.py`、`ui_storefront.py`、`ui_rbac_regression.py` | Chromium + HTTP 契约替身 | PASS；覆盖重复提交幂等、变价、页面切换、商品和订单边界、权限与移动端布局 |

契约替身及静态预览不代表真实外部模型或本批真实 Java/MySQL 联调；远端完整 CI、生产环境与人工体验验收仍需按实际结果单独确认。
