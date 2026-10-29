# SDD-03 验证报告（2026-10-28）

> 本报告仅依据当前容器实际执行结果。以下 Chromium 测试使用真实 Vue 代码及**明确标识的 HTTP 契约替身**，没有 Java/MySQL；Maven/数据库/Spring 安全过滤器测试**未执行**，不得写成 PASS。

| 验证入口 | 实际结果 | 边界 |
|---|---|---|
| `python scripts/generate-api-contract.py --check` | PASS（87 路由） | 根据 Controller/DTO 源码生成，不校验运行时行为 |
| `python scripts/verify-api-contract.py` | PASS | 路由对照、DTO `$ref`、匿名白名单、SQL q/COUNT 相同谓词、CI/选择器静态一致性 |
| `python scripts/verify-source.py`、`verify-release.py` | PASS | Java17 语法 251 文件、37 个内部接口实现、9 个 Mapper、31 张表；不是 Maven 编译 |
| `python scripts/build-ui-bundle.py` + `install-frontend-ui.py` | PASS | 离线 Chromium Vue 预编译 17 个模板，静态目录同步；不是 npm/Vite 构建 |
| `python frontend/tests/ui_sdd_integration.py` | PASS，15 项 | 真 Chromium + API 替身（分页、多 SKU、知识版本、订单图片） |
| `python frontend/tests/ui_three_pages.py` | PASS，23 项 | 真 Chromium + 演示/契约替身 |
| `python frontend/tests/ui_product_images.py` | PASS，11 项 | 真 Chromium + 文件上传契约替身 |
| `python frontend/tests/ui_remaining.py` | PASS，32 项 | 26 页入口和菜单/交互，演示数据 |
| `python frontend/tests/ui_remaining_contract.py` | PASS，9 项 | API 请求结构替身 |
| `python frontend/tests/contract_ui.py` | PASS，20 项 | API 契约替身、无 Spring/MySQL |
| `python frontend/tests/ui_contract_v11.py` | PASS，3 项 | 新增跨页搜索与 total，API 替身 |
| `python scripts/verify-domain.py` | PASS，56 项 | 独立纯 Java 领域规则 |
| `python scripts/verify-sdd-model.py` | PASS，Java8/SQL9 项 | Java 读模型与 SQL 静态链路，不是数据库执行 |
| `mvn -B -ntp clean verify` | **NOT_RUN** | 当前环境无 Maven 及可用依赖缓存 |
| `SessionAuthenticationIntegrationTest`（新增公开商户 H2 安全用例） | **NOT_RUN** | Java 测试代码已写，H2 测试 Schema 已加最小商户/门店表 |
| `python scripts/smoke-full.py` | **NOT_RUN** | 真实 Java、MySQL、Python HTTP 端到端待执行 |
| `python frontend/tests/live_ui.py` | **NOT_RUN** | 真实 Spring Boot Session + Chromium E2E 待执行 |
| GitHub Actions 工作流 | **NOT_RUN** | 已编辑 `.github/workflows/full-release.yml`，未推送或触发远程 CI |

上述 113 项 Chromium 检查包含重复覆盖，不能相加为独立功能完成率。核心 P0 的**匿名公开商户真实放行、管理员认证、MySQL 搜索/COUNT、一致性事务**尚须在真实 Spring/MySQL 环境通过。

## 复现顺序

```bash
python scripts/generate-api-contract.py --check
python scripts/verify-api-contract.py
python scripts/verify-source.py
python scripts/verify-release.py
python scripts/build-ui-bundle.py
python scripts/install-frontend-ui.py
python frontend/tests/ui_contract_v11.py
python frontend/tests/ui_sdd_integration.py
# 以下必须先准备 JDK 17、Maven、MySQL 8 及服务，不能跳过：
mvn -B -ntp clean verify
python scripts/smoke-full.py
python frontend/tests/live_ui.py
```

## 数据库升级

本批**不新增数据库迁移**。已有旧库继续遵守 SDD-02 的 `V20261028_01__order_item_image_snapshot.sql`；新库使用 R1 全量 Schema。切勿重复初始化或删库重建。
