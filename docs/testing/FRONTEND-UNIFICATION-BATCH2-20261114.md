# 前端统一第二批：商户与平台业务视图

日期：2026-11-14。代码测试基线：`45c3b45d97a4999f2eadda9d971db4ec26b73020`，基于第一批前端基础组件。

拆分商户订单表、库存表、商品新建表单和平台申请审核面板；请求、业务状态、权限判断和防止过期响应写入仍由原页面负责。商户工作台的加载及错误反馈改用已有状态面板。

| 实际执行 | 环境与范围 | 结果 |
|---|---|---|
| `npm run typecheck --prefix frontend`、`npm run format:check --prefix frontend` | Node 22.16.0，仓库锁文件 | PASS |
| `python scripts/build-ui-bundle.py` 及 `--check` | 当前前端源、离线和 Java 静态副本 | PASS |
| `python frontend/tests/ui_sdd_integration.py` | Chromium + HTTP 契约替身 | 18 项 PASS，覆盖多规格商品提交、订单选中和商户备货、库存补货的数量和幂等键、平台审核意见和驳回 |
| `ui_rbac_regression.py`、`ui_fix_regression.py`、`ui_product_images.py`、`ui_shell_bundle.py`、`ui_contract_v11.py`、`ui_remediation.py` | Chromium + HTTP 契约替身或静态预览 | PASS，覆盖商户权限、异步请求竞态、图片和静态入口 |

本地浏览器的后端为契约替身，不能称为本批真实 Java/MySQL 业务联调。以当前 PR 提交及目标分支为准的远端完整 CI 是后续门禁；外部模型和生产环境未验证。
