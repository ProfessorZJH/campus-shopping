# SDD-04 缺陷修复验证记录（2026-10-28）

> 证据来源：当前隔离容器实际操作。与 `SDD-API-CONTRACT-03-VERIFICATION.md` 分开；没有 Maven、MySQL 或真实用户会话环境时不假称通过。

## 修复映射

对应 `docs/specs/SDD-REPAIR-04.md` 的 F01–F10。修复已经写入源码，Java 实际编译、MySQL 行为和真实后端业务回归仍需 CI 或部署环境执行。浏览器专项回归使用真实 Vue 生产 JS，但 API 是受控替身。

## 验证表

| 验证项 | 结果 | 限制 |
|---|---|---|
| 预编译 Vue 17 模板与静态发布目录同步 | PASS | 预编译与文件校验，不是部署 |
| 87 条 Controller/DTO HTTP 静态契约 | PASS | 未真实调用 Spring |
| `verify-source.py` Java 语法与模块静态检查 | PASS（252 Java 源文件） | 不是 `javac` 编译和 JUnit 运行 |
| `verify-fix-regressions.py` SQL 谓词结构与库存分批静态检查 | PASS | 非 MySQL 执行 |
| `ui_fix_regression.py` 真实 Chromium + 后端替身 | PASS（10 场景） | 不代替 Spring 认证或数据库 |
| 现有 Vue 合同回归脚本 | PASS（见本轮控制台输出） | 与新增 10 个场景有交叉覆盖 |
| 纯 Java 领域规则、HTTP 正文边界检查 | PASS（原工具集） | 隔离领域环境，不是 Spring 整体集成 |
| AI Python 测试 | PASS（26 项） | 不代替真实 LLM/Qdrant |
| `CatalogPageSkuBatchTest`（新增 JUnit） | **NOT_RUN** | 等待 Maven 运行 |
| `CommerceMySqlIntegrationTest.catalogLiteralSearchAndCountCoverMerchantSkuAndSpecification` | **NOT_RUN** | 等待专用 MySQL/Maven 运行 |
| `mvn -B -ntp clean verify`、真实 HTTP、Docker、外部模型和向量库 | **NOT_RUN** | 当前隔离环境不可执行此完整链路 |

此表中的 PASS 是源代码检查和受控测试阶段的结果，不代表用户系统已经在生产部署或完成真实业务验收。

## 推荐完整复验命令

```bash
python scripts/verify-fix-regressions.py
python scripts/verify-api-contract.py
python scripts/verify-source.py
python scripts/verify-release.py
python scripts/build-ui-bundle.py
python scripts/install-frontend-ui.py
python frontend/tests/ui_fix_regression.py
python frontend/tests/contract_ui.py
python frontend/tests/ui_sdd_integration.py
python frontend/tests/ui_contract_v11.py
# 有 JDK17 + Maven + 专用 MySQL8 后，再运行：
mvn -B -ntp clean verify
python scripts/smoke-full.py
python frontend/tests/live_ui.py
```

## 升级提示

本批没有 schema.sql 或 Flyway 迁移变更；无需新数据迁移。R1 已要求的 `V20261028_01__order_item_image_snapshot.sql` 是既有旧库升级条件，不能遗漏或重复执行。
