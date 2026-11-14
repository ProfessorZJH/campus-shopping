# Agent v1.1 Java/MySQL 事实复验（2026-11-10）

## 结论

Java/MySQL 事实复验已在隔离临时 MySQL 8.0.31 实例中完成。商品检索、下架后的实时过滤、相同调用键回放，以及调用期间不写购物车/订单的用例均通过。

这份报告只覆盖 Java/MySQL 事实边界，不把 Milvus 隔离集合或完整真实 Agent 链路标记为通过。

## 隔离条件

- 使用 `scripts/verify-mysql-isolated.py` 创建随机 loopback 端口和临时数据目录。
- 未读取或复用现有业务库；脚本结束后临时 MySQL 和临时数据库已清理。
- MySQL 版本：`8.0.31`。
- 原始脚本证据：`evidence/agent-v1.1-m1-mysql-20261110.json`。

## 实际结果

| 范围 | 结果 |
| --- | --- |
| 迁移重放、旧库升级、脏历史数据拒绝、结构等价 | 9 项检查通过 |
| Maven `clean verify` | 退出码 0，406 tests，0 failures，0 errors |
| `CommerceMySqlIntegrationTest` | 97 tests，0 failures，0 errors，1 skipped |
| Agent 事实复验 | `agentSearchRevalidatesMySqlFactsAndReplaysOnlyTheSameInvocation` 通过 |
| Redis 专项 | 9 个用例跳过，原因是未配置显式 `REDIS_TEST_ADDRESS`；不计作 Java/MySQL 失败 |

新增集成用例验证：

1. 只有当前已发布且有库存的商品进入事实回执；
2. 商品下架后，新的搜索调用不再返回该商品；
3. 相同调用键只重放原回执；
4. 搜索调用前后购物车和订单行数不变。

## 未完成范围

- 真实 Milvus 隔离集合的创建、写入、检索、更新、删除和清理仍被当前远端 TLS/连接配置阻断。
- 因 Milvus 未可用，本轮没有宣称真实 Milvus → Java/MySQL → Agent 的端到端通过。
- OpenSpec `agent-v1-1` 的 4.2 和 4.4 继续保持未完成；4.3 的 Java/MySQL 事实复验部分已有隔离证据，但 Milvus 候选输入链路仍待补齐。

