# 前端统一第一批：基础视觉与公共交互

日期：2026-11-14。代码测试基线：`008271db1f7850d78965cefc36e0960b8ad2d082`。

本批建立现有品牌的设计变量和有序样式分层，复用状态面板并接入公共分页；购物、商户和平台页面保留原有数据、权限及请求处理。门店加载失败后提供重新加载入口，表单恢复键盘焦点提示。生成资源使用仓库构建脚本同步。

| 实际执行 | 环境与范围 | 结果 |
|---|---|---|
| `npm run build --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run format:check --prefix frontend` | Node 22.16.0，仓库锁文件 | PASS |
| `python scripts/build-ui-bundle.py --check`、`python scripts/verify-release.py` | 当前工作区，源码和生成副本 | PASS |
| `node --test frontend/tests/*.test.mjs` | 本地 JavaScript 测试 | 35 项 PASS |
| 完整工作流现有的前端 Chromium 契约脚本及 `ui_design_system.py` | HTTP 契约替身、静态预览，不调用真实业务或外部模型 | PASS；覆盖分页、图片、RBAC、订单、结算、导购、错误恢复及离线/CSP 入口 |
| `ui_shell_bundle.py` 中设计预览检查 | 320、390、1440 像素，消费者、商户、平台 | 21 个路由与视口组合 PASS；额外检查样式加载、键盘焦点和弹窗关闭 |
| `scripts/verify-mysql-isolated.py --http-smoke` | 新建 MySQL 8.0.31、两个本机隔离 Redis、临时 Redis 故障实例、Spring 和 FastAPI；本地检索，无外部模型 | PASS；迁移及重放检查通过，Maven 446 项、失败 0、错误 0、跳过 0；HTTP 291 项、共享 Redis HTTP 9 项、真实后端 Chromium 22 项 PASS。测试源码快照一致，临时数据库及 Redis 已清理 |

第一次隔离验收未配置故障隔离用例的 Redis 子进程启动命令，Maven 构建本身通过，但两项测试被跳过，故验收脚本判定 FAIL，HTTP/浏览器未执行；配置测试专用 Redis 启动器后重新执行，得到上表结果。

预览截图对比仅检查了消费者首页、商户商品页和平台商品页，不代表全页面人工视觉验收。真实外部模型效果、生产部署、性能和用户体验验收均未在本批执行。
