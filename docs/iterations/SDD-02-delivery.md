# SDD-02 前后端缺口修复交付说明

基于上一版 `campus-shopping-product-image-flow-full.zip`，2026-10-28。

## 已修改源码（不是全栈验收声明）

- **A01/B05**：`#/shops/{merchantId}` 公开商户详情与 `/api/v1/merchants/public/{merchantId}`，只公开营业商户。
- **A02**：新建商品支持多个不重复 SKU；已有商品追加规格使用 Java 真实接口。
- **A03**：知识文档“上传新版本”提交相同 `rootId`，保留版本链。
- **A04**：商品/订单监管 DTO 返回 `merchantName`，不可得时前端退化为 ID。
- **A05/B04**：主要列表改 `/page`，`PageResponseDTO` 返回 `items/page/size/total/hasNext`，服务端 COUNT 与过滤条件对应。商户商品页签总数不再把当前页行数当作全部记录数。
- **B01/B02**：购物车和 AI 提案返回商品主图，由可信 Catalog 数据生成。
- **B03**：`trd_order_item.image_url` 成交图片快照，DAO/PO/领域/DTO/前端贯通。历史订单不使用当前 Catalog 图片补图；旧数据空图显示占位。

## 数据库部署注意（仅需要一列迁移）

已有数据库：**备份 → 执行 `docs/database/migrations/V20261028_01__order_item_image_snapshot.sql` → 部署新版 Java**。迁移会判断列是否已经存在；禁止删除表或用新商品图片回填历史订单。

新库：`docs/dev-ops/mysql/sql/00_r1_schema.sql` 已直接包含新列。读模型和分页不需要新增表。

## 实际执行过的验证

| 层级 | 结果 | 含义 |
|---|---|---|
| `python scripts/verify-source.py` | PASS | Java17 语法及基础内部映射，251 个 Java 文件；非 Maven 编译 |
| `python scripts/build-ui-bundle.py && python scripts/install-frontend-ui.py` | PASS | Vue 模板离线编译和静态资源安装；非 Vite/npm 构建 |
| `python frontend/tests/ui_sdd_integration.py` | 15 项 PASS | Chromium + HTTP 契约替身，跨页商品、SKU、文档版本、历史图片 |
| `python frontend/tests/ui_remaining.py` | 32 项 PASS | 26 个页面路由和主要交互 |
| `python frontend/tests/ui_three_pages.py` | 23 项 PASS | 核心三个页面回归 |
| `python frontend/tests/ui_product_images.py` | 11 项 PASS | 商品图片流程（上传 API 为替身） |
| `python frontend/tests/ui_remaining_contract.py` | 9 项 PASS | 部分关键接口协议契约 |
| `python scripts/verify-sdd-model.py` | 8 项纯 Java + 9 项 SQL/映射 PASS | 真正用 `javac/java` 检查分页和图片快照读模型，SQL 为静态检查 |
| `python scripts/verify-domain.py` | 56 项 PASS | 纯 Java 领域规则，含库存随机检验 |
| `python scripts/verify-http-body.py` | 6 项 PASS | 真实本机 HTTP 响应正文约束 |

测试存在重复覆盖，不得把以上数字直接相加推断完整业务通过率。

## 尚不能宣称通过的门禁

- Maven 依赖解析、Spring Boot 编译与注入、全部 JUnit：`NOT_RUN`（容器无 Maven，依赖仓库不可访问）。
- MySQL8 迁移、COUNT 正确性、事务幂等/并发和真实业务落库：`NOT_RUN`（容器无 MySQL）。
- 真实用户 Session/CSRF + Vue + Java + Python + MySQL 连通验收：`NOT_RUN`。
- 标准 `npm run build`、Docker Compose、真实 LLM/Embedding/Qdrant：`NOT_RUN`。
- 平台申请/商户/订单等自由文本搜索以及库存页关键词筛选目前仅在**当前页**过滤；商品搜索已实现服务端全局 `q` 检索。不要误称全列表全文搜索。

完整测试与限制：[`../testing/SDD-INTEGRATION-02-VERIFICATION.md`](../testing/SDD-INTEGRATION-02-VERIFICATION.md)。

## 合并与本地验收顺序

1. 将本包解压到**新目录**，先与现有 `G:\develop\campus-shopping` 的文件比较差异，不要覆盖本地未提交改动。
2. 备份现有 MySQL，先执行增量迁移，不要清库重建。
3. 本地 JDK17/Maven 执行 `mvn -B -ntp clean verify`，并配置隔离测试库进行真实 MySQL 测试。
4. 启动真实服务后执行 `python scripts/smoke-full.py`；检查新建商品双规格、上传主图、下单、换图、旧订单历史图、超 100 项翻页、知识新版本。
5. 运行浏览器实际后端模式（不带 `?demo=1`），补充全栈截图与日志；只有这些通过才能将 SDD 任务改为已验收。
