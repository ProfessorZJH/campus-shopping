# UI-06 前端精简与移动端权限导航 · 验证记录

> **后续真实验收（2026-10-29）**：真实 Java/MySQL 下的 28 条路由、消费者/商户/平台移动端，以及自定义角色授予和撤销均已通过列明检查，见[真实报告](LOCAL-LIVE-20261029.md)。下文仍是本阶段原始的受控浏览器记录。

2026-10-29 · 验证对象：从 v1.2 RBAC ZIP 解包后的增量前端改动。**界面级真实 Chromium 浏览器 + Java HTTP 契约替身**，不是 Spring Boot/MySQL 实时联调。

## 结果

| 验证 | 执行方式 | 状态 |
| --- | --- | --- |
| UI 预编译与同步 | `python scripts/build-ui-bundle.py && python scripts/install-frontend-ui.py` | PASS |
| RBAC 定向回归（14 项） | `python frontend/tests/ui_rbac_regression.py` | PASS |
| UI-06 桌面/移动端、权限导航、只读预览（4 项） | `python frontend/tests/ui_copy_polish.py` | PASS |
| 首页、AI 导购、商户商品高保真交互（23 项） | `python frontend/tests/ui_three_pages.py` | PASS |
| 商品主图（11 项） | `python frontend/tests/ui_product_images.py` | PASS |
| 全页面路由（32 项） | `python frontend/tests/ui_remaining.py` | PASS |
| 核心接口交互契约（20 项） | `python frontend/tests/contract_ui.py` | PASS |
| 旧请求竞态与售后校验（10 项） | `python frontend/tests/ui_fix_regression.py` | PASS |
| 全局排序（4 项） | `python frontend/tests/ui_global_sort.py` | PASS |
| 搜索字段契约（3 项） | `python frontend/tests/ui_contract_v11.py` | PASS |
| API 行为契约（9 项） | `python frontend/tests/ui_remaining_contract.py` | PASS |
| SDD 前端接口联动（15 项） | `python frontend/tests/ui_sdd_integration.py` | PASS |
| 当前 Java HTTP 路由/OpenAPI 静态一致性 | `python scripts/verify-api-contract.py` | PASS：93 条路由 |
| SDD-04 搜索/分页修复静态检查 | `python scripts/verify-fix-regressions.py` | PASS |
| 原始领域规则/HTTP 边界 | `python scripts/verify-domain.py` / `python scripts/verify-http-body.py` | PASS：56 / 6 |
| Python AI 本地单测 | `cd ai-service && python -m pytest -q` | PASS：26 |
| Maven、真实 MySQL、Spring Boot 多账号 E2E | 需要 Maven、MySQL 服务和完整部署环境 | **NOT RUN** |

注：上表仅列出**在本轮实际见到完整 PASS 结果**的验证，不包含此前超时的测试。如对源码继续修改，必须重新执行受影响回归。

## 浏览器截图

- `evidence/ui-polish/roles-desktop.png`：桌面角色权限；权限以用户可理解的名称展示。
- `evidence/ui-polish/roles-mobile.png`：手机端角色权限；当前选中的导航项可见。
- `evidence/ui-polish/products-mobile.png`：手机端商品管理；可以返回其他商户功能。
- `evidence/ui-polish/roles-preview.png`：预览中内置和自定义示例角色；所有写操作禁用。

所有截图为**接口替身或 `?demo=1` 演示数据**，不能当作服务器生产数据。

## 未覆盖边界

- 真实的角色变更后多端会话即时刷新、数据库权限/事务与 tenant SQL 隔离、真实模型/Qdrant、Docker 与生产移动端实机测试：**未验收**。
- 本轮未修改后端接口、SQL、迁移、库存和交易业务规则，不增加数据库迁移步骤。
