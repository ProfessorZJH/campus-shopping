# SDD-02：前后端缺口修复验证记录

> **后续真实验收（2026-10-29）**：本机 Spring/MySQL 已执行真实 HTTP 和 Chromium 购物闭环；图片上传、双 SKU、订单历史图片快照及交易/库存落库结果见[本地真实报告](LOCAL-LIVE-20261029.md)。下文原始记录中的 NOT_RUN 不覆盖后续证据，未逐项复测的操作不扩大声明。

> 2026-10-28；作用范围：A01–A05 / B01–B05。**测试环境只包含离线预编译 Vue、真实 Chromium 和明确的 HTTP 契约替身。没有将真实 Spring Boot、MySQL 或 AI 服务启动并互连。**

## 1. 已执行检查

| 项目 | 执行命令 | 结果 | 能证明什么 |
|---|---|---|---|
| Java、MyBatis、DDL 与链接静态检查 | `python scripts/verify-source.py` | PASS（修复包打包前重新执行） | 语法和基础映射一致性；不证明 Maven 类型检查或事务正确性 |
| 离线 UI 打包及静态安装 | `python scripts/build-ui-bundle.py` + `python scripts/install-frontend-ui.py` | PASS | Vue 模板可转换并安装到 Spring 静态目录；不等于 Vite 正式构建 |
| SDD 分页 / 多规格 / 文档版本 | `python frontend/tests/ui_sdd_integration.py` | **15 项 PASS** | 真实 Chromium UI + 模拟 HTTP 响应的跨页操作与请求契约；135 条追加测试商品 |
| 历史订单图片快照/分页读模型的实际 Java 17 检查 | `python scripts/verify-sdd-model.py` | **8 项纯 Java PASS + 9 项 SQL/映射静态检查 PASS** | 编译并运行真实 Java record 与分页类；不包含 MySQL 或完整项目依赖 |
| 历史页面路由 | `python frontend/tests/ui_remaining.py` | **32 项 PASS** | 全量主要页面的浏览器路由与交互 |
| 早期三页回归 | `python frontend/tests/ui_three_pages.py` | **23 项 PASS** | 首页、AI 导购与商户商品页交互 |
| 商品图片 | `python frontend/tests/ui_product_images.py` | **11 项 PASS** | 上传、换图、缺图回退，HTTP 上传与保存用契约替身 |
| 原其他请求契约 | `python frontend/tests/ui_remaining_contract.py` | **9 项 PASS** | 部分关键接口路径、参数、响应处理 |

> 上述检查有覆盖重叠，不能简单将数量相加当作独立业务场景；测试替身不具备 Java 服务或真实 MySQL 事务语义。

本批另修复：消费者历史订单列表/详情原本使用 `coverSku` 读取当前商品图片，违反快照定义；现仅使用 `OrderItemResponseDTO.imageUrl`，旧订单字段为空展示占位图。商户商品列表页签的总数改为服务端 `total`，不再误用当前页的 9 行作为全库数量。

## 2. SDD 修复项逐项核对

| 编号 | 已写入源码 | 检查重点 | 尚缺的真实验收 |
|---|---|---|---|
| A01 | `Shop.js`、路由注册 | ACTIVE 商户详情、按商户商品分页 | Java 返回 ACTIVE 和 SUSPENDED 的 200/错误码与权限 |
| A02 | `Merchant.js` | 多个不同 specKey、现有商品追加 SKU、无效价校验 | Java + MySQL SKU 唯一约束及事务回滚 |
| A03 | `Knowledge.js` | 新版本 rootId 保留、上传动作 | 实际知识索引、文档版本并发与授权 |
| A04 | `ProductResponseDTO/OrderResponseDTO` + Platform | 页面商户名称及退化显示 | 数据库中停用、删除、数据缺失时读模型表现 |
| A05 / B04 | `PageResponseDTO`、Controller、DAO/XML、页面 | 超过 100 商品时远端分页与搜索 | MySQL count 与分页并发一致性、索引及性能 |
| B01 | `CartResponseDTO`、Catalog offer | 商品主图随购物车显示 | 真实购物车图片与商品更新 |
| B02 | `ProposalItemVO/DTO`、AI Case、Controller | 提案商品图片快照字段与旧模型兼容设计 | 实际 JSON 序列化、老提案读取和跨实例保存 |
| B03 | 订单行聚合/PO/DTO/Mapper/SQL | 新建订单快照 imageUrl，历史行空图 | **迁移后**下单、换图、历史详情确认不变；浏览器已确认旧订单空图不会回查当前商品 |
| B05 | `/merchants/public/{merchantId}` | 商户详情页 ID 查找 | Java 对停用商户不泄露信息 |

## 3. 明确未运行（NOT_RUN）

- `mvn -B -ntp clean verify` / Spring Boot 编译、依赖注入、JUnit：**NOT_RUN**，环境缺少 Maven。
- `docs/database/migrations/V20261028_01__order_item_image_snapshot.sql` 真实 MySQL 执行：**NOT_RUN**，环境没有 MySQL。
- 真实登录 Cookie/CSRF + 前端 + Java/MySQL 全链路：**NOT_RUN**。
- 下单预占／支付／核销／退款并发及历史订单图片数据库快照：**NOT_RUN**。
- 真实 AI/Embedding/Qdrant 检索和知识库端到端：**NOT_RUN**。
- 标准 `npm run build` 的 Vite 依赖安装编译：**NOT_RUN**；交付内有离线预编译静态资源。

## 4. 推荐正式环境验证顺序

1. 核对数据库版本并备份：`SHOW CREATE TABLE trd_order_item;`，**旧库先运行** `docs/database/migrations/V20261028_01__order_item_image_snapshot.sql`；空库使用更新后的 `00_r1_schema.sql`。
2. JDK 17 / Maven 与 MySQL 8：运行 `mvn -B -ntp clean verify`，并配置专用测试库跑数据库并发测试。
3. 用真实 Session/CSRF 登录商户创建双规格商品、上传图片并补货；其他用户可见上架商户和商品。
4. 下单后更换主图，旧订单仍返回下单图片，旧数据空图显示占位；测试重试幂等和多并发库存。
5. 真实接口验证 `/page` 的 items/total/hasNext 与同筛选条件一致；分页越界、空列表、停用商户安全。目前平台非商品列表的自由文本搜索与库存页关键词筛选仅筛选**当前页**，不应误报为跨页全库搜索（按需另行扩展后端 q）。
6. 验证导购提案与知识新版本上传的服务端读写和权限，再做浏览器真实后端截图。

本报告只针对当前代码副本。将其合并到其他历史版本前，必须核对数据库迁移与冲突文件差异。
