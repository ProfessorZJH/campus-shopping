# MySQL 数据模型与 SQL 专项检查

日期：2026-11-02。范围覆盖 R1 建表脚本、增量迁移、MyBatis Mapper、库存/交易读写路径、迁移版本校验和主要分页查询。

## 结论

当前模型覆盖身份、商户、商品/SKU、库存、购物车、订单、退款、自提和 AI 文档链路。已收口的实际问题如下：

| 等级 | 问题 | 处理 |
|---|---|---|
| P1 | `inv_stock_balance` 按 `(store_id, sku_id)` 唯一，但确认查询只按 SKU 读取；重复库存行会让购物车取到任意门店库存。 | 新增 `uk_stock_sku`；迁移发现重复 SKU 时直接失败，不合并历史库存；购物车确认对重复行显式拒绝。 |
| P1 | 初始化脚本只用单表存在性判断“新库”，部分旧库可能被登记成完整迁移。 | 空库才登记基线；显式迁移要求完整 R1 核心表集合，部分库拒绝执行。 |
| P2 | 列表索引不足，且 AI 文档列表曾用 `SELECT d.*` 读取正文。 | 新增商品、订单、售后、库存、知识库和文档根索引；文档列表改为显式摘要列。 |
| P2 | 迁移版本校验只验证名称/版本不足以识别同名错误定义。 | 迁移入口校验核对索引列顺序、升降序、唯一性及 CHECK 表达式；待执行 DDL 前拒绝同名错误索引。 |

## 模型与 SQL 结论

- 金额使用整数分，订单行保留成交快照，核心同库事务和锁序保持不变。
- 商品列表排序在分页前完成，订单读模型使用批量查询；未引入无条件“最新 100”截断。
- 价格/库存排序、召回相关子查询，文本 `LOCATE(LOWER())`，深页 `OFFSET`，AI 活动索引全量 `FOR UPDATE` 和知识库成员逐商户读取仍是数据规模增长后的重点热点，应以真实数据执行 `EXPLAIN ANALYZE` 后再改写。
- 当前一商户一门店约束与单 SKU 单库存余额一致；若未来支持多门店，必须把 `store_id` 纳入购物车、确认和展示查询，而不能移除唯一约束后继续按 SKU 取第一行。

## 变更范围

- 新增不可变迁移 [`V20261102_01__inventory_integrity_and_query_indexes.sql`](../database/migrations/V20261102_01__inventory_integrity_and_query_indexes.sql)。
- 同步应用 schema、Docker schema、迁移清单、逻辑模型和迁移手册。
- 收紧 [`schema_contract.py`](../../scripts/schema_contract.py) 的基线、索引方向和 CHECK 结构校验。
- 修正库存确认防御和 AI 文档摘要查询；未修改现有业务库，也未执行生产迁移。

## 验证

- `python scripts/schema_contract.py --check`：通过。
- `python scripts/verify-release.py`、`python scripts/verify-domain.py`、`python scripts/verify-api-contract.py`、`python scripts/verify-api-schemas.py`、`python scripts/verify-java-readability.py`：通过。
- `./mvnw.cmd -DskipTests compile`：通过。
- `./mvnw.cmd test`：267 项，0 失败，0 错误，88 项因缺少真实 MySQL/Redis 环境跳过。
- [`verify-mysql-isolated.py --skip-maven`](evidence/mysql-data-model-audit-20261102.json)：MySQL 8.0.31 隔离新库、旧库升级、重复迁移、脏数据拒绝和元数据等价性通过，临时实例已清理。
- 隔离 MySQL 上的完整 Maven `clean verify` 构建成功，276 项测试 0 失败/错误；9 项跳过（Redis 集成 8 项，另有 1 项 MySQL 套件条件测试）。由于仓库脚本要求零跳过，该次完整包装验收以未通过收口，但 MySQL 迁移检查本身已通过。
