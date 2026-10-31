# SDD-05 RBAC、全局排序与多角色验收记录

> **后续真实页面验收（2026-10-29）**：Owner 在真实 Spring/MySQL 页面完成角色创建、成员分配、编辑撤权、恢复内置角色及删除；店员和消费者权限边界通过，见[本地真实报告](LOCAL-LIVE-20261029.md)。以下为此前验证记录，不将专用 MySQL JUnit 的跳过状态改写为通过，也不声称完成排序性能评估。

日期：2026-10-28。说明：所有通过项仅限下面明确列出的工具和测试类型，不将浏览器契约替身冒充真实后端测试。

| 类型 | 命令/范围 | 结果 |
|---|---|---|
| Vue 生产预编译 | `python scripts/build-ui-bundle.py`，新增 RoleManager 模板，前端与 Spring 同源构建同步 | PASS |
| 路由与 DTO | `python scripts/generate-api-contract.py && python scripts/verify-api-contract.py` | PASS，93 条路由 |
| Java 源码结构静态检查 | `python scripts/verify-source.py` | PASS，262 个 Java 文件语法静态检查；**不等于 javac/mvn 编译** |
| 领域规则（独立 Java） | `python scripts/verify-domain.py` | PASS，56 项 |
| HTTP 边界（独立 Java） | `python scripts/verify-http-body.py` | PASS，6 项 |
| 既有 UI 修复 | `python frontend/tests/ui_fix_regression.py` | PASS，10 项受控 Chromium + HTTP 替身 |
| 旧 SDD 页面 | `python frontend/tests/ui_sdd_integration.py` | PASS，15 项受控 Chromium + HTTP 替身；关闭 Chromium 时有 Playwright 异步 TargetClosed 警告 |
| 既有跨页搜索 | `python frontend/tests/ui_contract_v11.py` | PASS，3 项受控 Chromium + HTTP 替身 |
| RBAC、知识、AI 账号边界 | `python frontend/tests/ui_rbac_regression.py` | PASS，14 项受控 Chromium + HTTP 替身（含只读库存与平台直达页面） |
| 跨页全局排序请求及展示 | `python frontend/tests/ui_global_sort.py` | PASS，4 项受控 Chromium + HTTP 替身 |
| 自定义权限、撤销恢复、跨商户 | 新增 `MerchantRbacMySqlIntegrationTest` | NOT_RUN，本容器无 Maven/MySQL |
| 全局价格/库存排序 MySQL 跨页 | 新增 `CommerceMySqlIntegrationTest.catalogGlobalSortOrdersEntireResultBeforePaging`（22 件商品两页、两种排序、非法枚举） | NOT_RUN，本容器无 Maven/MySQL |
| Java 源文件和 MyBatis XML 语法 | `node --check frontend/src/**/*.js`、XML 解析 | PASS；并非完整 Java 编译 |
| Python AI 服务单元 | 在 `ai-service/` 下运行 `python -m pytest -q tests` | PASS，26 项 |
| Java 全量构建、实际 MySQL 排序查询 | `mvn -B -ntp clean verify` | NOT_RUN，本容器无 Maven/MySQL |
| Java+MySQL+Python 服务、真实 HTTP/浏览器 | `scripts/smoke-full.py`、`frontend/tests/live_ui.py` | NOT_RUN，未启动真实服务 |
| 外部 LLM 与 Qdrant | 真实 AI 接入测试 | NOT_RUN，未使用外部配置 |

## 待在 CI / 验收环境检查的重点

1. `iam_merchant_role_permission` 外键、角色名唯一约束、角色成员改派与删除的事务/并发，以及撤销后重新接受邀请是否恢复为 `CLERK`。
2. 两个真实商户的 Owner、CLERK、自定义角色和普通消费者登录；直接 HTTP 改写 merchantId、roleCode、权限值仍必须拒绝。
3. MySQL8 对价格最低有效 SKU 和库存 SUM 排序子查询的执行正确性、性能，分页/COUNT 过滤一致；可执行 `EXPLAIN ANALYZE`。
4. 前端菜单与服务端权限矩阵一致，账号权限变化后重新进入页面立即复权；AI 历史会话仅按当前用户访问。
5. 执行数据库升级前先备份，按顺序执行既有 V20261028_01 与新增 V20261028_02（如果尚未部署），然后重跑完整 CI 和浏览器验收。

## 本批实际复核补充

- 旧 `CatalogPageSkuBatchTest` 的 Controller 直接调用签名已跟随新增 `sort` 参数更新，避免 Maven 测试代码编译时仍调用旧签名。
- 只读库存界面仍展示库存流水，而补货表单在 `stock.replenish` 缺失时完全隐藏；平台知识库 URL 对非管理员展示拒绝页面。
- `ui_rbac_regression.py` 增加了上述两个越权 UI 场景；因此现行为 **14 项**。
- 独立 API/前端测试运行过；完整 Java `mvn verify`、MySQL 实际排序与权限事务、多商户真实账号 E2E 不在本地已通过范围。
