# 购物车、SKU 与并发整改 · 2026-11-01

## 目标、范围与不变量

基于 `origin/main` 的 `804f0f1`，覆盖用户确认的三个整改批次。购物车读模型及普通/AI 加购统一累计库存语义；补齐 SKU 独立上下架；固化四项双并发和强制下架/Checkout 专项测试，修正 Issue #2 的配置说明。

规则归属 [R1](../specs/RELEASE-01.md) 和[行为契约](../api/behavior-v1.1.md)。商品状态留在 ProductAggregate；权限与跨域事务由现有 Case 协调。价格、权限与库存仍由 Java/MySQL 复验，加购不预占、Checkout 原子预占。无数据库迁移、DAO 锁序修改或通用死锁重试。

## 实现与验收标准

- 零库存或余额缺失时 sellable=false；库存不足请求量独立检查。保留失效购物车行。
- 普通 PUT 在购物车锁内使用现有 FOR UPDATE 当前读，减少/同量不要求商品仍可售，增加才复验商户、商品、SKU 和累计库存。缺货用 I0001。
- AI 加购返回锁内累计量，在同一确认事务中比较库存；任何一行失败回滚所有购物车写入、提案状态与 selection_hash。
- 首页及商品详情页比较累计量；购物车失效行禁止增加，可减少和直接移除。
- 新增 SKU status PUT，必填 active 和商品 expectedVersion；本商户 product.write 与归属实时复验。停业可停用，启用需商户有效。同目标重放不更新版本；不同目标按商品乐观锁；已上架商品保留至少一个 ACTIVE SKU。历史成交快照保留。
- 固化 pay/pay、cancel/cancel、requestRefund/requestRefund、同 Proposal confirm/confirm。数据库断言包括单 payment/履约、单次释放、单 REQUESTED、单次加购。
- 强制下架与 Checkout 进行 10 轮真实竞争，并检查 EXPLAIN 的表/索引和 InnoDB 死锁计数；不输出完整 InnoDB SQL 或业务正文。有限轮次未复现不能证明所有执行计划均无死锁。
- [Issue #2](https://github.com/ProfessorZJH/campus-shopping/issues/2) 已直接修正，保留原有验收清单与 Open 状态；优先在受保护 external-ai Environment 配置四个 LIVE_* Secrets 与 XFYUN_MODEL Variable，不涉及密钥值。

## 验证过程

首轮契约生成因新请求 DTO 尚未登记必填规则失败，补齐 api_contract_rules.py 后通过。首轮 Maven 因旧 InvalidInputContractTest 未同步 CartCaseImpl 构造器失败，已修正。

第二轮 251 项 JUnit、217 项 HTTP、9 项 Redis 双实例检查及 12 项真实浏览器检查通过；但验收期间补充了商品详情页与测试，源码摘要检测正确将整轮标记 FAIL，不能作为最终版本通过证据。最终版本另起独立实例复验，结果以下方最终记录为准。

新增 InnoDB 诊断的第一轮因误用非 MySQL 原生的 `SHOW GLOBAL STATUS LIKE Innodb_deadlocks` 而查询为空报错；已按 [MySQL 官方说明](https://dev.mysql.com/blog-archive/innodb-data-locking-part-3-deadlocks/)改用 `information_schema.INNODB_METRICS` 的 `lock_deadlocks`，随后重新全量复验。该失败属于测试诊断查询，不是复现业务死锁。

## 最终记录

[最终隔离证据](evidence/cart-sku-20261101/isolated.json)为 PASS，testedSourceMatchesCheckout=true，临时数据库已清理。命令入口为 `python scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke`；由本地辅助脚本新启临时 Redis 并显式设置 REDIS_TEST_ADDRESS，未读取已有业务配置。

| 实际检查 | 结果 |
|---|---|
| 隔离 MySQL/Redis 下 Wrapper clean verify | 255 项 JUnit，0 失败、0 错误、0 跳过（交易集成 66 项） |
| 真实 Spring/MySQL/FastAPI HTTP，逐响应核对 OpenAPI | [217 项通过，153 次响应契约校验](evidence/cart-sku-20261101/full-http.json)，AI 为本地检索演示 |
| Redis 两 Java 实例 HTTP | [9 项通过](evidence/cart-sku-20261101/redis-shared-http.json)，独立随机命名空间 |
| Chromium 与真实后端 | [12 项通过](evidence/cart-sku-20261101/browser.json)，含新增购物车、首页和 SKU 页面检查，无 API mock |
| 下架/Checkout 专项 | [10 轮通过](evidence/cart-sku-20261101/lock-diagnostics.json)，EXPLAIN 两表 PRIMARY，新增死锁 0，未发现历史死锁记录 |
| format:check / UI --check / Node tests | 通过；Node 7 项通过 |
| verify-release / verify-domain / verify-java-readability | 通过；领域脚本 56 项 |
| generate-api-contract / verify-api-contract / verify-api-schemas / schema_contract --check | 通过，94 条路由，58 项 schema 检查 |

原始失败记录保留在本地忽略目录 var/remediation/cart-sku*，上文保留原因与修正过程。公开证据不含凭据或完整事务 SQL。

## 边界

本机 JDK 17.0.12、Node 22.16.0、Python 3.11.9、Wrapper Maven 3.9.9、MySQL 8.0.31。Redis 为本轮新启的独立实例（Windows Redis 3.2.100），随机端口与随机命名空间，未复用业务实例。MySQL 8.0.36 / Redis 7.4.2 以完整 CI 为准。外部 NVIDIA/讯飞/Milvus 真实连通为 NOT_RUN；文档修正不能解除该独立验收项。未迁移既有库、替换运行服务、合并或部署。
