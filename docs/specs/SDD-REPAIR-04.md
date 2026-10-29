# SDD-04 · 校园商城 v1.1 缺陷修复实施规格

> 2026-10-28。基线：`campus-shopping-contract-v1.1-full(1).zip` 和源码审查报告 `campus-shopping-audit-20261028.md`。此文件记录代码变更合同与验收条件，**不表示真实 Java/MySQL 已验收**。

## 目标与边界

不增加业务模块，不改变 87 条 HTTP 路由、不改响应 DTO、不开新数据表，也不改变多商户身份授权最终由 Java 服务端判断的原则。修复商品搜索和分页数据的正确性，以及多异步请求下页面应展示的**当前登录主体/当前商户/当前筛选条件**。

涉及领域：Catalog（商品检索/读模型）、Inventory（库存只读视图）、Trading（退款审批输入契约）、Knowledge（已授权资料的商户页面范围）、前端三端状态管理。`CatalogController` 只做读模型适配和批量查询，不移动库存状态不变量到 HTTP 层。Repository/DAO 继续归属 Infrastructure，未改变 DDD 模块依赖方向。

## 变更与验收清单

| 问题 | 新合同/修复策略 | 验收条件 |
|---|---|---|
| F01：商品页 SKU 超过领域批量上限 | 以每次最多 **500 个不同 SKU ID** 读取库存并合并；对外 `size<=100` 不变 | 51 商品 × 20 SKU（1020 SKU）返回全部 51 件，每个 SKU 库存可售正确；每批最多 500，预计 3 批 |
| F02：商户/登录主体切换覆盖数据 | `replaceSession()` 使旧 session、merchant、public 请求全部失效；`switchMerchantContext()` 使旧商户请求失效；商户加载提交前核对请求版本、账号、商户和路由 | 先请求 m1，切 m2，再返回 m1：m2 页面不得出现 m1 数据；从商户端返回购物端也不被 m1 覆盖；管理员 A 登录成无权账号 B 后旧监管表格立刻清空 |
| F03：首页搜索乱序 | `beginPublicSearch()` 自增版本，所有请求仅最新版可提交商品、分页、错误/加载状态 | alpha 先发、beta 后发且先返回，最后仍展示 beta |
| F04：`%`、`_` 被当作 SQL 通配符 | 商品搜索/COUNT 四个 SQL 使用 `LOCATE(LOWER(#{query}), LOWER(...))>0` 字面子串；仍使用 MyBatis 参数绑定 | `%`、`_` 只匹配字面含该字符的商品；列表/COUNT 等价 |
| F05：搜索框与后端检索范围不一致 | 公共/管理商品均匹配商品标题、描述、SKU ID、规格；公共搜索额外匹配商户名；公开检索 SKU 限 ACTIVE | 按商户名、规格、SKU ID 能找回匹配商品，且总数准确；不用 SKU JOIN 造成重复商品 |
| F06：店铺分页/库存/AI会话/知识库旧响应 | 页面级 `epoch` 及 route、merchant、page 快照；卸载后旧请求失效；商户运营页包括库存分支；平台页切换登录主体时清空当前私有读模型并重新授权加载 | 旧页晚返回不覆盖新页；旧会话消息不覆盖新会话；切知识库/商户不串页 |
| F07：退款审批空理由 | 平台和商户**同意与驳回**均要求 `reason.trim()` 非空（最多 500 字）；不填则按钮禁用且 JS 不发送请求 | 空理由无法提交；填写后实际请求包含理由；服务端继续验证 |
| F08：价格、库存排序误导 | 暂不扩展 SQL 全量排序，明确将商品排序控件标为**本页价格/本页库存**；分页仍按后台创建时间 | 界面不再暗示跨页最低价/最高库存 |
| F09：多商户知识库范围 | Java 返回当前账号已授权全部知识库；商户页面还需按 **当前选中 merchantId** 过滤；平台页面保持授权全量 | m1/m2 切换时只展示对应资料，且内容/选中项清空旧上下文 |
| F10：店员可进入 Owner 页面 | 店员侧隐藏售后、成员、设置、知识库等入口，并对直接访问的 Owner 页面显示无权限状态；服务端权限照旧 | Clerk 看不到无权入口；粘贴 URL 不触发 Owner 专属操作 |

## 异步与信任边界

- 页面请求版本号与旧响应丢弃只解决**浏览器显示一致性**，不能代替服务端的身份认证、成员鉴权或数据库事务。
- 登录/退出会清理当前共享业务状态；消费者页面需要重新获取公开商品，否则在原页面会留下空列表。
- 从商户页面切到公开页面时旧商户请求失效；商户页面的最后提交还要核对当前路由。
- 库存查询的分批仅用于读取快照；分页下的多个批次不是原子快照，不适用于下单库存预占或核销写事务，真实成交仍由已有数据库行锁/事务保障。
- `LOCATE` 能保证字面匹配而非索引优化。在校园首版商品规模内优先合同正确性；未来数据增长如需全文索引，须另立性能设计和测试。
- F08 选择的**本页排序**是明确的产品范围收敛；以后若要求全局排序，必须增加排序参数白名单与服务端 SQL `ORDER BY ... LIMIT`，不是简单去掉“本页”字样。

## 代码与数据变更

- Java：`CatalogController.products(...)` 库存 ID 分批，新增 `CatalogPageSkuBatchTest`（Mockito/JUnit，等待 Maven 环境运行）。
- SQL：`icatalogdao_mapper.xml` 的 `search/count/searchManaged/countManaged`；`EXISTS` 保证单商品不重复；新增 `CommerceMySqlIntegrationTest` 的字面搜索/COUNT 实测用例（等待专用 MySQL 环境运行）。
- Vue：`store.js`、`Home.js`、`Merchant.js`、`MerchantOps.js`、`Shop.js`、`Guide.js`、`Knowledge.js`、`Platform.js`、`BackofficeShell.js`、`ConsumerShell.js`、`AuthDialog.js`（具体见修复测试报告）；部署产物必须重建并同步到 Spring static 目录。
- 数据库表和 DDL：**没有变更；本轮不新增迁移**。旧版数据库如果未执行 SDD-02 图片快照迁移，仍需先按原有迁移手册升级。

## 验证门禁

1. 静态合同：`python scripts/verify-fix-regressions.py`、`verify-api-contract.py`、`verify-source.py`。
2. 浏览器代码：`python frontend/tests/ui_fix_regression.py`，真实 Chromium + 预编译 Vue，后端为可控 API 替身。
3. Java JUnit：`mvn -B -ntp clean verify`，包括 `CatalogPageSkuBatchTest`；带专用 MySQL 环境时 `CommerceMySqlIntegrationTest` 执行动态 SQL 语义测试。
4. 真实 HTTP：`python scripts/smoke-full.py`、`python frontend/tests/live_ui.py`；Docker 服务和真实模型/Qdrant 按既有门禁额外验收。

**当前状态**：源码和受控浏览器测试可分别标记为已实现/已验证；Maven、MySQL、Spring Boot 端到端未运行前不得标记为全部通过。
