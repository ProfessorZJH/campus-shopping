# 旧库升级基线与漂移审计复验（2026-11-06）

本轮完成 `legacy-db-upgrade-baseline` 的 P2 实施，所有验证均在本 worktree 创建的临时 MySQL 实例和临时数据库中执行，未连接或修改既有业务库。Claude 正在使用的产品化 worktree 与本轮隔离。

## 已实施

- 新增 `V20261105_02__migration_drift_audit.sql`，建立 `sys_schema_migration_drift`，记录人工基线准入和迁移后结构漂移。
- `apply_migrations` 先计算结构指纹并核对发布基线与迁移历史；支持空库初始化、已发布前缀续迁、已发布结构缺历史时补登记，未知或残缺结构在任何 DDL 前拒绝。
- 迁移完成后再次核对目标指纹；不一致时写入漂移审计，不回滚 MySQL DDL，也不删除已登记历史。
- `migrate-database.py` 增加 `--accept-baseline`、`--reason`、`--operator`，人工准入必须显式、可追溯；`--check` 输出并核对结构指纹。
- 三个从真实发布提交复制的基线快照继续作为隔离回放输入，生成的 schema、Docker SQL 和 `database-manifest.json` 已同步。

## 实际命令与结果

| 命令 | 结果 |
|---|---|
| `python scripts/schema_contract.py --check` | PASS |
| `python scripts/verify-api-contract.py` | PASS（95 路由） |
| `python scripts/verify-api-schemas.py` | PASS（72 项） |
| `python scripts/verify-release.py` | PASS（静态边界检查） |
| `openspec validate legacy-db-upgrade-baseline --strict --no-interactive` | PASS |
| `python -X utf8 scripts/verify-mysql-isolated.py --mysql-bin D:\\develop\\mysql-8.0.31-winx64\\bin --skip-maven --output docs/testing/evidence/legacy-db-upgrade-baseline-p2.json` | PASS，MySQL 8.0.31 |
| 同一隔离脚本加 `--maven .\\mvnw.cmd` | Maven reactor BUILD SUCCESS，367 项测试 0 失败/错误；Redis 相关 9 项因未提供隔离 Redis 被跳过，脚本按门禁记为 FAIL，见 [Maven 证据](evidence/legacy-db-upgrade-baseline-p2-maven.json) |

隔离回放覆盖：空库完整初始化、当前目标结构缺历史补登记、发布基线缺历史补登记、三个真实基线升级后的指纹一致、缺 `trd_cart_item` / `ful_pickup_task` 在 DDL 前拒绝且无迁移表写入、显式审计准入、重复迁移幂等、校验和篡改、脏数据 CHECK 和历史数据保留。逐项结果见 [JSON 证据](evidence/legacy-db-upgrade-baseline-p2.json)。

## 未验证与待决策

- 本机只有 MySQL 8.0.31；8.0.16 与 8.4 的跨版本指纹一致性未执行。
- 本轮没有配置 REDIS_TEST_ADDRESS，因此 Redis 相关真实回归未通过验收门禁；Maven 编译和非 Redis 测试本身已完成。
- 启动期是否强制结构指纹、`--operator` 是否绑定连接身份、是否纳入 `e5cd2c1` 之前的教学版，仍保留在 ADR-020 的待决策中。
