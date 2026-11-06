# Tasks

## P1 证据与回归（不改变升级判定行为）

- [x] 1. 入库不可变基线快照 `docs/database/baselines/{v1.2.3-import,pre-redis-7bd21e2,pre-multiimage-ab31f89}.sql`（内容取自对应发布提交的 `schema.sql`）与 `baselines/manifest.json`（release、期望历史前缀、目标指纹）。
- [x] 2. `scripts/schema_contract.py` 生成 `database-manifest.json` 时追加归一化 `schemaFingerprint`，并把归一化实现抽成可复用函数。
- [x] 3. `scripts/verify-mysql-isolated.py` 删除 `INDEXES`/`CHECKS` 正则变造夹具，改为逐基线重放 + 指纹等价断言；保留脏数据拒绝、重复升级幂等、误放 `schema.sql` 不登记、元数据等价检查。
- [x] 4. 用 `var/verify/legacy_upgrade_probe.py` 的证据更正 `docs/testing/BRANCH-VERIFY-20261104.md` 第 5 节与 `docs/testing/SHOPPINGAI-RAG-CORRECTIONS-20261101.md` 中基于猜测夹具的结论，新增本轮探针报告。

## P2 准入与漂移判定

- [x] 5. 新增迁移 `V20261105_02__migration_drift_audit.sql`（`sys_schema_migration_drift`，带 `information_schema` 守卫与 `CREATE TABLE IF NOT EXISTS`）；同步 `schema_contract.py` 生成物、`database-manifest.json`、Docker schema 与迁移清单。
- [x] 6. `apply_migrations` 改为双条件准入：空库 / 历史前缀 + 指纹匹配 / 指纹匹配但缺历史；不匹配时在任何 DDL 前抛错并输出差异明细。
- [x] 7. `apply_migrations` 成功路径末尾追加指纹断言与漂移审计写入；不自动回滚 DDL、不自动删除已登记行。
- [x] 8. `scripts/migrate-database.py` 增加 `--accept-baseline <release|fingerprint>`、`--reason`、`--operator`（必填校验），准入审计先写入再继续；`--check` 输出指纹差异。
- [x] 9. 回归测试：三种基线升级成功且指纹等于新库；缺 `trd_cart_item` / `ful_pickup_task` 的库被拒绝且无任何写入；无历史非空库拒绝与显式准入路径；重复升级幂等；校验和篡改、脏数据 CHECK 仍被拒绝。

## P3 文档与登记

- [x] 10. 更新 `docs/database/migrations/README.md` 运行手册（准入判据、`--accept-baseline` 使用条件、漂移处置流程）与 `docs/specs/SDD-REDIS-12.md` 升级章节引用。
- [x] 11. 登记 ADR（状态 Proposed，编号顺延当前最大号；获接受后改 Accepted），并更新 `docs/README.md` 索引与 `docs/testing/` 报告。
- [ ] 12. 执行 `python scripts/schema_contract.py`、`verify-api-*`、`verify-release.py`、隔离 MySQL 复验（含 8.0.16/8.0.31/8.4 指纹一致性）与真实 MySQL/Redis 回归，记录实际结果与未验证项。

## 决策待确认

- [ ] 13. 启动期是否强制指纹校验（Java 侧需实现同一归一化算法）。
- [ ] 14. `--operator` 取值来源（显式参数 vs 连接账号）。
- [ ] 15. 是否需要把教学版（早于 `e5cd2c1`）纳入基线集合。
