# SDD-03：HTTP 契约与前后端一致性修复

> 日期：2026-10-28。基线：SDD-02 完整源码。目标：修复 C01–C10 审计项，**不扩大业务范围、不新建表**。代码更改、文档更改、实际测试状态分别追踪。本文件是当前修复实施规格，并非生产验收报告。

## 1. 范围与准则

- 业务需求继续以 `docs/requirements/PRD.md` 的 FR-001～025 为基础，本批补齐其实现契约，不重新发明功能。
- 当前 Java Controller/DTO/实际权限实现是代码事实；生成 `docs/api/http-api.md` + `openapi.json` + `route-manifest.json`，并以 `docs/api/behavior-v1.1.md` 补充角色、Session、CSRF、分页和错误语义。
- Domain 保持本地 `Repository`、远程 `Port`，Case 负责必要的跨领域业务流程；不因为接口文档问题新建 Repository/Port/DTO 包装器。
- 旧教学草案不删除，但不得被 AI 当成正在运行的接口。文档与源码冲突时报告差异，先修规格再改代码。

## 2. 修复项与验收标准

| ID | 问题 | 方案/关键修改 | 无真实服务时可执行的证明 | 真实端到端验收 |
|---|---|---|---|---|
| C01 | 路由表在主文档和附录里重复分散 | 自动生成全量 87 条路由与字段索引，生成 OpenAPI/manifest | `generate-api-contract.py --check` | `NOT_RUN` |
| C02 | DTO/请求参数说明不全 | 从 Java Controller、DTO 抽取参数、响应字段；复杂约束另写行为契约 | `verify-api-contract.py` 逐条引用 | `NOT_RUN` |
| C03 | 领域文档仍沿用旧路径 | 按当前 Controller 修正 Catalog、Trading、Fulfillment、Identity、ShoppingAI 当前 HTTP 段 | 契约审查 + 旧路径查找 | `NOT_RUN` |
| C04 | 文档引用老前端模板 | 更新文档索引，以 `frontend/src/services/api.js` 为当前调用层；`static/assets/app.js` 是历史文件 | 文本检查 | `NOT_RUN` |
| C05 | 幂等键业务必填性模糊 | 保留 Controller 可选注解以返回统一领域错误；行为契约明确业务必填且限制 64 字符 | 路由 manifest、业务契约 | `NOT_RUN` |
| C06 | 公开商户 `/page`/详情被鉴权拦截 | Security GET permitAll 精确补齐，仅允许公开商户；私有 ACL 不放开 | 静态白名单及新增 MockMvc 测试源码 | **Spring 测试 `NOT_RUN`** |
| C07 | 自由文本仅过滤当前页 | 平台商户/入驻申请/商户订单/平台订单/商户库存改为 SQL q + 同条件 COUNT；Vue 传 q 并显示 total | SQL Mapper/Controller 一致性 + 替身浏览器 | **MySQL 搜索 `NOT_RUN`** |
| C08 | 购物车商户名依赖缓存 | Cart DTO 新增 `merchantName`，Controller 从商户域读取；前端优先使用 DTO | DTO/Controller 静态 + 浏览器 | `NOT_RUN` |
| C09 | 鉴权、Session、CSRF、分页、错误码不完整 | 当前行为契约统一说明，OpenAPI 仍从源码生成 | 文档与 Python 门禁 | `NOT_RUN` |
| C10 | CI live_ui 仍使用旧 Vue 选择器 | 重写 `frontend/tests/live_ui.py`，用真实 Java HTTP + Chromium 验证匿名/登录/登出/普通用户禁止管理页面 | `py_compile`、前端测试选择器校验 | **真实浏览器 `NOT_RUN`** |

> C 编号沿用上一轮审计：行为与列表项可能跨前后端，不代表 10 项都是独立 DB 缺陷。搜索的 q 只对路由声明过的列表生效；其他页面不宣称跨页搜索。单商户订单、库存不超卖、知识 ACL 等业务规则保持 SDD-02 不变。

## 3. HTTP 契约更新顺序

1. 修改 Controller/DTO/安全规则及 SQL 查询条件；每次保留旧 List 路由兼容，不换响应包裹结构。
2. 运行 `python scripts/generate-api-contract.py`，产出全量权威路由/字段表和 OpenAPI 文件。
3. 补充 [行为契约](../api/behavior-v1.1.md)，明确领域不可从注解推知的校验和状态机。
4. CI 使用 `python scripts/verify-api-contract.py` 检查生成文件不漂移、公开路径、DTO、分页查询与 COUNT 的过滤语义。
5. 执行本地 Chromium UI 回归、静态检查及 isolated Java 规则；有 Spring/MySQL 环境时再运行 `mvn clean verify`、真实 HTTP 与浏览器验收。

## 4. 数据库与兼容性

- 本批 **无新增表/字段**；`merchantName` 从现有 `mer_merchant.name` 构造读模型；`q` 使用现有商户、申请、订单、订单行、SKU、商品列查询。
- **继承 SDD-02 的订单行图片快照迁移**：旧库仍必须先执行 `docs/database/migrations/V20261028_01__order_item_image_snapshot.sql`；本批不重复运行或重命名迁移。
- GET `/page` 仍返回 `Response<PageResponseDTO<T>>`，`page` 从 1 开始、`size<=100`；各列表保持稳定排序。已经存在的非分页接口保留以降低升级风险。
- 实际编译和数据库升级状态在本批测试报告里记录，不能因为文档和脚本通过就宣称 MySQL 已完成迁移。

## 5. 执行门禁与状态

```bash
python scripts/generate-api-contract.py --check
python scripts/verify-api-contract.py
python scripts/verify-source.py
python scripts/build-ui-bundle.py
python scripts/install-frontend-ui.py
python frontend/tests/ui_sdd_integration.py
# 具备 Java/Maven/MySQL 的环境才执行下述真实验收：
mvn -B -ntp clean verify
python scripts/smoke-full.py
python frontend/tests/live_ui.py
```

实际通过/未执行项见 `docs/testing/SDD-API-CONTRACT-03-VERIFICATION.md`。CI 配置 `.github/workflows/full-release.yml` 在真实 Maven 前增加接口门禁。
