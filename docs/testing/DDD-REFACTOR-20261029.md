# DDD 专项整改与真实验收

日期：2026-10-29。用户授权后完成 [D01–D12 审查](../architecture/DDD-REVIEW-20261029.md) 的本轮整改，设计见 [SDD-11](../specs/SDD-DDD-11.md)。保留原审查证据，本报告不把此前通过的结果计作本轮验证。

## 改动与证据

| 审查项 | 本轮处理 | 验证 |
|---|---|---|
| D01 响应契约过宽 | 33 个响应 DTO 逐字段声明必填与可空；成功 data 必填；合法状态枚举 | 41 项 Schema 检查；117 份真实响应通过严格契约 |
| D02 字符串状态与筛选 | 17 个新业务枚举；核心聚合内部使用枚举；边界快照校验；非法状态不进入仓储 | 生产源码回归、DddRulesTest、真实 HTTP |
| D03 上游坏数据归因 | 检索词、引用、推荐、语义 ID 逐项防腐校验，统一 AI0001 | 原 3 个反例转为通过；额外空引用、非有限分数、非法数量/语义 ID 测试 |
| D04 异常分类 | 注册码与安全提示补全；业务拒绝 warn，系统/依赖 error；安全类型链/位置诊断 | 异常构造/分类/脱敏 JUnit；真实协议回归 |
| D05 异常静默 | 知识 FAILED 与安全诊断、语义约定故障降级、同步作业失败计数及时间记录 | 网关/同步既有测试与真实本地 AI HTTP；源码检查 |
| D06 AI 规则位于 Case | RRF、SKU 均衡、推荐去重/库存约束移至 RecommendationPolicy | 确定性排名、200 商品采样、可信报价/库存及图片快照测试 |
| D07 规则入口分散 | AfterSaleAggregate、KnowledgePublicationAggregate；确认/拒绝归入提案服务 | 领域状态测试；真实 MySQL 价格/购物车失败回滚与版本发布并发 |
| D08 大服务/仓储能力 | 交易和 AI 各拆 3 个服务实现；仓储按能力提供端口；读取接口去除写入/锁定能力 | 完整 Maven、Spring 注入、33 项 MySQL 集成测试 |
| D09 Controller 编排与 N+1 | OrderQueryCase、独立读模型；订单行/自提/售后/商户批量读取 | 100 单批量调用次数断言、授权拒绝前不读订单、真实 MySQL 读模型 |
| D10 跨域 SQL 混入写仓储 | Catalog/Inventory 独立 QueryRepository、QueryDao 和 Mapper | SQL SELECT/COUNT 一致性；真实搜索/排序；逐语句只读白名单 |
| D11 架构门禁不足 | 增加领域、类型、SDK、状态与表归属检查，接入现有静态入口 | 10 个故意违规样例全部被拒绝；当前源码通过 |
| D12 模板和错误语义 | 新购物车/自提专用码；共享响应构造与诊断，清理 Controller 旧模板导入 | 93 路由契约不漂移；格式检查及完整回归 |

Controller 中的显式 catch 按仓库约定保留；统一构造和诊断逻辑，不新增全局业务异常处理器。同一领域内部仍可由一个 MyBatis 适配器实现多个窄仓储端口；这里没有宣称拆成独立微服务或消除全部跨域协作。

## 本轮实际执行

| 层级 | 结果 | 证据 |
|---|---|---|
| 完整 Maven clean verify | 116 通过、0 失败、0 跳过 | [隔离 MySQL/Maven 汇总](evidence/ddd-refactor-20261029/mysql.json)、[构建清单](evidence/ddd-refactor-20261029/tested-release-manifest.json) |
| 真实 MySQL JUnit | 33 项，包含新增 4 项；非 H2 锁/事务模拟 | 汇总中的 Commerce 27、Identity 3、RBAC 3 |
| 新领域/批量单测 | DddRulesTest 12、OrderBatchQueryTest 4 | 汇总中的独立 suite 结果 |
| 真实 Java/MySQL/FastAPI HTTP | 173 项通过，AI 为 LOCAL_RETRIEVAL_DEMO | [真实 HTTP](evidence/ddd-refactor-20261029/full-http.json) |
| 严格真实响应 Schema | 117 份，校验契约 SHA-256 记录于证据 | HTTP 汇总 contractValidation |
| 真实 Chromium → Spring | 8 项通过，apiMockUsed=false | [浏览器结果](evidence/ddd-refactor-20261029/frontend-live/results.json) |
| 数据库升级/完整性专项 | 6 项通过，含重放、脏数据阻断、校验和与 CHECK | MySQL 汇总 checks |
| 原审查反例回归 | 5 项生产 Java + 3 项 Schema 通过 | [新回归证据](evidence/ddd-refactor-20261029/regression.json)；原 REPRODUCED 文件保留 |
| 响应 Schema 正反例 | 41 项通过 | [Schema 样例](evidence/ddd-refactor-20261029/api-schemas.json) |
| DDD 静态边界 | 当前源码通过；10 个故意违规样例被拒绝 | [边界证据](evidence/ddd-refactor-20261029/boundaries.json) |
| 纯 Java 领域 | 56 项规则 + 5000 步库存随机序列通过 | [领域证据](evidence/domain-rules.json) |
| Python 单测 | 42 通过；本机已有测试依赖，一项 multipart 弃用提示 | 本轮执行 `cd ai-service; python -X utf8 -B -m pytest -q` |
| API/SDD/格式 | 93 条路由生成一致；SDD 8 项纯 Java + 9 项映射检查；Prettier 通过 | 本轮对应脚本及 format:check 输出 |

本轮没有连接现有业务数据库，没有读取私有 `.env`，没有重启运行中的业务服务。测试脚本创建独立 MySQL datadir、随机回环端口和独立构建目录，结束后已清理临时实例；汇总记录 existingDatabaseUsed=false、temporaryDatabaseCleaned=true。

隔离构建保存了 [422 个受测文件的逐文件摘要](evidence/ddd-refactor-20261029/tested-sources.json)，覆盖 Maven 模块（排除 target 与私有配置）、根 pom 和真实 AI 应用代码。全部测试结束后与当前源码逐项比对，testedSourceMatchesCheckout=true，sourceChangedDuringTest 为空；构建清单同时记录 sourceMatchesBuild=true。该摘要不覆盖整个共享工作区其他未提交任务。已验证的 JAR 与原始 JUnit 报告保存在忽略目录 `var/ddd-refactor-20261029/verified-build/`，本轮没有替换运行中的 JAR。

## 复现

```powershell
python -X utf8 -B scripts/generate-api-contract.py --check
python -X utf8 -B scripts/verify-api-contract.py
python -X utf8 -B scripts/verify-api-schemas.py
python -X utf8 -B scripts/probe-ddd-review.py
python -X utf8 -B scripts/verify-domain.py
python -X utf8 -B scripts/verify-release.py
python -X utf8 -B scripts/verify-sdd-model.py
npm --prefix frontend run format:check
$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
python -X utf8 -B scripts/verify-mysql-isolated.py --mysql-bin 'D:\develop\mysql-8.0.31-winx64\bin' --maven 'D:\develop\Maven\apache-maven-3.8.8\bin\mvn.cmd' --offline --http-smoke --artifact-dir var/ddd-refactor-20261029/verified-build --output docs/testing/evidence/ddd-refactor-20261029/mysql.json
```

## 验证限制

本轮没有重新调用讯飞/NVIDIA、远程 Milvus 或 Qdrant，没有执行 Docker 镜像部署、生产部署或性能压测；这些状态为 NOT_RUN，已有其他专项记录不并入本轮通过数。100 单批量测试证明调用次数不随行数增长，不代表已经得到真实负载下的延迟或容量指标。

响应契约仍明确兼容历史入驻信息和受限投影的可空字段。现有库需遵循已发布迁移流程，本轮状态枚举重构不要求将数据库列改成 MySQL ENUM。业务扩展仍需同步领域规则、权限、契约、表归属与测试，不能将此次整改理解为项目此后不会再有缺陷。
