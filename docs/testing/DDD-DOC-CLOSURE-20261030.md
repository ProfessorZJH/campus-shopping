# DDD 风格、行为契约与文档一致性收口

日期：2026-10-30。工作树基于 `37124d0` 及[前轮已验收修复](PROJECT-REVIEW-FIXES-20261030.md)继续；原有修复保留。比较依据与设计取舍见[DDD 对照](../architecture/DDD-REFERENCE-DOC-AUDIT-20261030.md)。

## 本轮处理

- Catalog 写 Case 收窄为 9 个语义明确的命令，查询独立；创建输入更名为 ProductCreateCommandEntity。保留领域状态 EnumVO、富聚合、AppException/ResponseCode 和 Controller 内捕获。
- 订单下单/支付/取消/核销在原事务内返回不可变只读模型；HTTP 不再处理 OrderAggregate。失败回滚、原锁顺序、报价与权限复验有针对性测试。
- 会话与邀请增加兼容的 page/size 参数，Vue 支持读取更早记录；知识检索取消静默截断，单次 1000 文档显式容量及 AI0005 写入行为契约。
- 修复中文预算、模糊数量和多轮替换需求的数量继承；模型和检索改写不能覆盖用户金额/数量约束。
- 重新生成 API、OpenAPI、路由/错误码；修订行为契约的分页、容量与成功响应 required/null 规则。交付、追踪、索引、路线、运行手册和审查报告统一到有日期的当前证据，早期 NOT_RUN 保留历史身份。

## 本轮验证

- [隔离全栈证据](evidence/ddd-doc-final-20261030/mysql.json)：MySQL 8.0.31，新库迁移/重放/校验和与脏数据拒绝通过；Maven Wrapper `clean verify` **185 通过、0 失败、0 错误、0 跳过**。包含 39 项 Commerce MySQL 测试，新覆盖第 101 条列表、1001 个知识库/1001 份文档，以及建单/付款响应组装失败回滚。
- 同一隔离构建启动真实 Spring/MySQL/FastAPI：**HTTP 173 项、OpenAPI 严格响应 117 份、真实后台 Chromium 8 项通过**，AI 为 LOCAL_RETRIEVAL_DEMO。生成 JAR 中 UI 与本次源码构建逐字节一致。[459 个已测源文件摘要](evidence/ddd-doc-final-20261030/tested-sources.json)在复验结束时与工作树一致，临时数据库已清理。
- [Python JUnit XML](evidence/ddd-doc-final-20261030/python.xml)：**47 项通过**，含中文预算、模糊数量、多轮约束继承及知识 1000/1001 边界；外部模型为替身。
- [前端定向回归](evidence/ddd-doc-final-20261030/browser-contract.json)：ui_fix_regression、ui_rbac_regression、ui_list_pagination 均通过；真实 Chromium 的 HTTP 后端为契约替身。新增的两项列表用例验证页面第 101 条可达，已加入 CI current 矩阵。
- 93 条路由/错误码与生成文档一致、58 项 Schema 检查、DDD 依赖/SQL 白名单、Java 可读性、源码/文档链接、格式、迁移快照、UI 全量生成对比和 3 项跨平台构建单测通过。机器结果见[源码与链接](evidence/ddd-doc-final-20261030/static-release.json)、[DDD 边界](evidence/ddd-doc-final-20261030/boundaries.json)与[Schema](evidence/ddd-doc-final-20261030/api-schemas.json)；它们不代替真实数据库测试。

复现主命令：

```powershell
python -X utf8 -B scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke --output docs/testing/evidence/ddd-doc-final-20261030/mysql.json --artifact-dir var/ddd-doc-final/verified-build
cd ai-service
python -m pytest -q
cd ..
python -X utf8 -B frontend/tests/ui_list_pagination.py
python scripts/generate-api-contract.py --check
python scripts/verify-release.py
python scripts/verify-api-schemas.py
python scripts/build-ui-bundle.py --check
```

Python 测试需从 `ai-service/` 目录运行 `python -m pytest -q`；上方数据库命令的 MySQL bin 路径按本机安装位置替换。测试过的 JAR 和清单位于忽略目录 `var/ddd-doc-final/verified-build/`，未覆盖运行服务。

## 固定范围

仅操作新建临时 MySQL 与临时构建目录，不连接或升级业务库、不替换运行服务。本轮 AI 为本地检索与明确模型替身；历史讯飞/NVIDIA/Milvus 联调见[2026-10-29 报告](LOCAL-LIVE-20261029.md)，不计成本轮通过。Docker/远端 CI、Qdrant、真实模型/Milvus 本轮回归、性能、生产代理与生产部署本轮未验收。会话消息最近 100 条、提案最近 20 条是上下文窗口；知识 1000 文档是显式容量，均不承诺完整导出。
