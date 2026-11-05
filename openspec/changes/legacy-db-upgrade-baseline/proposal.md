# Proposal

## Why

`docs/specs/SDD-REDIS-12.md` 承诺旧库可通过显式迁移升级，但仓库里没有任何可信证据证明这个承诺成立：

- 上一轮把「旧 Redis 分支库」定义成一张 31 表的猜测形状，并据此写出两套硬编码基线表清单（旧 31 表 / 新 33 表）。两套清单都不描述任何一个真实发布过的库，探针 A/B 因此给出一正一负的假结论。
- `verify-mysql-isolated.py` 的「旧库夹具」是用正则从**当前** `schema.sql` 里删对象造出来的，不是任何真实发布状态；因此脚本 PASS 只证明它能升级自己造的夹具。
- 以 git 固定的真实发布 `schema.sql` 复验后，结论与上述相反：v1.2.3 导入版（33 表、0 条登记）、pre-Redis 版（34 表、4 条）、pre-multi-image 版（37 表、7 条）三种真实旧库在当前代码下全部升级成功，升级后结构与新空库指纹完全一致。也就是说，**升级链路本身是好的，坏的是判定与验证**。
- 真正未被覆盖的风险是「不完整库」：只要存在 `iam_user`，`apply_migrations` 就会执行并登记全部 10 条迁移。实测删掉 `trd_cart_item` 或 `ful_pickup_task` 的库被 ACCEPTED、`validate_history` 也 PASS，应用会带着残缺结构启动，只在运行期报错。

## What Changes

- 把「可否升级」的判定从硬编码表清单换成**结构指纹 + 已登记历史的双条件**：指纹必须等于某个已发布状态，或数据库为空库；否则在任何 DDL 之前拒绝。
- 指纹与基线快照来自**可追溯产物**：`docs/database/baselines/<release>.sql`（从发布提交复制的不可变快照）与构建清单里的 `schemaFingerprint`；删除正则变造夹具。
- 迁移完成后增加只读指纹断言：结构与目标不符时抛错并写审计行，不自动回滚 DDL、不自动删除已登记行（保留断点续跑语义）。
- 为无历史行或结构不匹配但经人工确认可升级的库提供显式 `--accept-baseline <release>`，要求写入审计（指纹、操作者、时间、原因）。
- 保留应用启动只读校验版本/校验和；启动期强制指纹校验需另做决策，不在本次范围。

## Capabilities

### New Capabilities

- `database-upgrade-baseline`: 定义旧库升级的准入判定、指纹契约、审计与验证夹具来源，扩展既有 [`docs/database/migrations/README.md`](../../../docs/database/migrations/README.md) 与 SDD-12 的升级承诺，不新增第二套迁移标准。

### Modified Capabilities

无已建立的 OpenSpec 主能力基线；本次只新增上述能力，既有 SDD 仍为业务基线。

## Impact

影响 `scripts/schema_contract.py`、`scripts/migrate-database.py`、`scripts/verify-mysql-isolated.py`、`docs/database/baselines/`、`campus-shopping-app/src/main/resources/database-manifest.json`，以及一条新增迁移（审计表）。

不修改任何已发布迁移文件，不迁移或清理既有业务库，不让应用启动执行 DDL。指纹算法必须跨 MySQL 8.0.16/8.0.31/8.4 稳定，并与库字符集/collation 解耦。

验收：三种 git 固定基线升级后指纹等于新空库；缺表形态在 DDL 前被拒绝；无历史非空库被拒绝或经审计显式准入；重复升级幂等、校验和篡改与脏数据仍被拒绝。
