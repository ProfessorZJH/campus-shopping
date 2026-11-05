# 旧库升级形状探针：猜测夹具 vs git 固定发布（2026-11-05）

目的：复核 [`BRANCH-VERIFY-20261104.md`](BRANCH-VERIFY-20261104.md) 第 5 节「旧 Redis 库升级路径不可用」的结论，并确认当前代码对真实历史旧库的实际行为。本轮只做只读验证与临时库实验，未修改代码、未修改任何业务库。

结论：**该结论不成立**。以 git 固定的真实发布 `schema.sql` 重建旧库后，三种历史形状在当前代码下全部升级成功，升级后结构与新空库指纹完全一致；真正未被覆盖的缺陷是「残缺库被静默标记为已升级」。

## 1. 方法

- 从 git 取三个发布提交的 `campus-shopping-app/src/main/resources/schema.sql` 作为不可变旧库快照，写入 `var/verify/*.sql`（已 gitignore）。
- 探针 `var/verify/legacy_upgrade_probe.py` 在 MySQL 8.0.31 上为每个形状创建临时库 `p15_<name>_<hex>`，执行快照 DDL，再调用真实的 `scripts/schema_contract.py::apply_migrations`，最后用与 `verify-mysql-isolated.py` 相同的 `fingerprint()`（`information_schema` 的列/索引/约束/CHECK 快照）与新空库比较。
- 临时库全部在 `finally` 中 `DROP DATABASE`；未连接、未读写既有业务库。

## 2. 真实旧库形状的升级结果

| 形状来源 | 表数 | 升级前已登记 | `apply_migrations` | 升级后表数 / 登记 | 与新空库指纹 |
|---|---|---|---|---|---|
| `e5cd2c1`（v1.2.3 导入） | 33 | 0 | ACCEPTED | 39 / 10 | 相同 `e35dc40624813b69` |
| `7bd21e2^`（pre-Redis） | 34 | 4 | ACCEPTED | 39 / 10 | 相同 |
| `ab31f89^`（pre-multi-image） | 37 | 7 | ACCEPTED | 39 / 10 | 相同 |

即：迁移内 `information_schema` 守卫对真实旧形状有效，`V20261028_01`…`V20261105_01` 全部可重复执行且结果收敛到当前结构。

## 3. 对上一轮结论的更正

| 上一轮表述 | 本轮证据 |
|---|---|
| 「真实旧 Redis 分支形状（31 表，无 `iam_merchant_role*`、无 V31_02 列）」 | 该形状是用正则从当前 `schema.sql` 删对象造出来的。git 固定的 pre-Redis 发行版是 **34 表**且**已含** `iam_merchant_role` / `iam_merchant_role_permission`，缺的是 `ai_knowledge_quota` / `ai_knowledge_usage` / `ai_sync_checkpoint` 与 `index_expires_at` / `index_version` 列。 |
| 「新旧两套硬编码基线清单都不描述旧库真实形状」 | 成立，但根因不是「清单少了表」，而是**用猜测夹具反推清单**；两套清单都不等于 33/34/37 表中的任何一个。 |
| 「`verify-mysql-isolated.py` 的 PASS 不能证明真实旧库可升级」 | 成立。原因是它测的是自己变造出来的夹具；本轮用真实快照重放才得到可迁移结论。 |
| 「旧 Redis 升级路径仍不可用，需另行设计」 | 不成立：三个真实发行形状均可升级且结构收敛。需要另行设计的是**准入判定与验证保真度**，不是迁移脚本本身。 |

## 4. 本轮发现的真实缺陷：残缺库被静默放行

以 `e5cd2c1` 形状为基线，删掉单张表后再执行 `apply_migrations`：

| 删表 | 结果 | 已登记 | 启动期 `validate_history` |
|---|---|---|---|
| `trd_cart_item` | **ACCEPTED** | 10 | **PASS**（应用会带着缺表结构启动） |
| `ful_pickup_task` | **ACCEPTED** | 10 | **PASS** |
| `trd_order_item` | REJECTED（`1146 Table doesn't exist`） | 0 | FAIL |
| `cat_product` | REJECTED（`1146 Table doesn't exist`） | **7** | FAIL |

原因：`apply_migrations` 的准入门禁只要求 `iam_user` 存在；迁移只触及部分对象，缺失的其它业务表不会让任何迁移失败，于是 10 条迁移全部登记，版本/校验和校验也通过。

同时暴露两个可用性问题：失败是裸 `ProgrammingError`（操作者拿不到「哪个库形状不对」的信息），且失败前已登记 7 条迁移，库停在半升级状态。

## 5. 设计产出

已按 OpenSpec 起草独立变更 [`openspec/changes/legacy-db-upgrade-baseline/`](../../openspec/changes/legacy-db-upgrade-baseline/)（`openspec validate --strict` 通过）：

- 准入改为「已登记历史 + 结构指纹」双条件，取消硬编码表清单；
- 基线快照与目标指纹来自发布产物（`docs/database/baselines/` + `database-manifest.json`），删除正则变造夹具；
- 升级成功路径末尾追加指纹断言与漂移审计（`sys_schema_migration_drift`），不自动回滚 DDL、不自动删除登记行；
- 人工准入必须显式 `--accept-baseline` + 非空 `--reason` 并留审计；
- 指纹归一化忽略 collation/字符集/自增值/统计信息，保证 MySQL 8.0.16、8.0.31、8.4 一致。

## 6. 未执行

- 未修改任何代码或迁移文件；`apply_migrations` 仍是「仅 `iam_user` 门禁」的现状。
- 未在 MySQL 8.0.16 / 8.4 上验证指纹归一化稳定性（本轮只有 8.0.31）。
- 未验证教学版（早于 `e5cd2c1`）形状。

## 7. 副作用与隔离

- 所有临时库名为 `p15_*`，执行后 `DROP DATABASE`；未触碰既有业务库。
- 快照与探针脚本位于 `var/verify/`（已 gitignore），不随提交分发。
