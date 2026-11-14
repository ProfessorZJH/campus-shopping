# Design

## Context

见 `proposal.md`。2026-11-05 在隔离 MySQL 8.0.31 上用 git 固定的历史 `schema.sql` 重建真实旧库，实测结论如下（探针脚本 `var/verify/legacy_upgrade_probe.py`，临时库 `p15_*`，执行后 DROP，未触碰业务库）：

| 形状来源 | 表数 | 升级前登记 | `apply_migrations` | 升级后表数/登记 | 与新空库指纹 |
|---|---|---|---|---|---|
| `e5cd2c1`（v1.2.3 导入） | 33 | 0 | ACCEPTED | 39 / 10 | 相同 |
| `7bd21e2^`（pre-Redis） | 34 | 4 | ACCEPTED | 39 / 10 | 相同 |
| `ab31f89^`（pre-multi-image） | 37 | 7 | ACCEPTED | 39 / 10 | 相同 |
| `e5cd2c1` 但删 `trd_cart_item` | 32 | 0 | **ACCEPTED** | 39 / 10 | 不同（未检查） |
| `e5cd2c1` 但删 `ful_pickup_task` | 32 | 0 | **ACCEPTED** | 39 / 10 | 不同（未检查） |
| `e5cd2c1` 但删 `trd_order_item` | 32 | 0 | REJECTED（1146 裸 SQL 错） | — / 0 | — |

两点结论：

1. 迁移脚本本身对真实旧库是有效的、幂等的，`information_schema` 守卫让中断后可重跑；上一轮「旧 Redis 升级路径不可用」的判断来自把猜测夹具当成真实形状。
2. 准入门禁（仅要求 `iam_user` 存在）会放行残缺库，且 `sys_schema_migration` 会记录成「已全部升级」，`validate_history` 也通过，应用启动无告警。这是当前真实缺陷。

现有代码位置：`scripts/schema_contract.py::apply_migrations`（门禁 + 逐条登记）、`scripts/migrate-database.py`（CLI）、`scripts/verify-mysql-isolated.py::migration_checks`（正则变造夹具 + `fingerprint()` 元数据快照）、`campus-shopping-app/src/main/resources/database-manifest.json`（版本/校验和清单）。

## Goals / Non-Goals

**Goals:**

- 让「这个库能不能升级」有可机读、可复现的判据，不依赖任何人手写的表名清单。
- 让升级结果可验证：升级后结构与已发布目标一致才算成功。
- 让验证夹具来自真实发布产物，任何「脚本 PASS」都必须能追溯到某个真实旧库形状。
- 保持现有安全属性：应用启动只读、迁移显式执行、已发布迁移不可变、DDL 隐式提交的人工可恢复性。

**Non-Goals:**

- 不修改任何已发布的 `V*.sql` 迁移文件，也不改写 `schema.sql` 的生成方式。
- 不让应用启动或后台任务执行升级 DDL。
- 不承诺支持任意第三方分支/手工改过的库自动升级；这类库走显式人工准入。
- 不做业务库迁移、清理或数据修复。
- 不在本次决定「启动期强制指纹校验」（见 Open Questions）。

## Decisions

1. **准入判定 = 结构指纹 + 已登记历史（取消表清单）**
   三种可接受入口状态：

   | 状态 | 判据 | 行为 |
   |---|---|---|
   | 空库 | `information_schema` 中无业务表 | 建基线并登记完整版本（保留现有 `@campus_new_schema` 机制） |
   | 已发布状态 | 已登记历史是发布列表前缀，且当前指纹等于该状态的目标指纹 | 只执行其后的迁移 |
   | 历史缺失但结构匹配 | 无 `sys_schema_migration`，指纹等于某个已发布基线 | 先登记该基线历史（等价于「早期手工执行过幂等 SQL」），再执行后续迁移 |
   | 其它 | 指纹不匹配任一已发布状态 | 在任何 DDL 前拒绝，错误信息给出缺失/多余对象明细与可选 `--accept-baseline` 指引 |

   判定只做只读查询，失败时不产生任何写入。

2. **指纹与基线都是构建产物，不是手写常量**
   - 新增不可变基线快照 `docs/database/baselines/<release>.sql`，内容来自对应发布提交的 `schema.sql`（本次先入库 `v1.2.3-import`、`pre-redis-7bd21e2`、`pre-multiimage-ab31f89` 三个已实测形状）。
   - `scripts/schema_contract.py` 生成 `database-manifest.json` 时追加 `schemaFingerprint`（目标状态的归一化指纹），并生成 `docs/database/baselines/manifest.json`（`release → 基线文件 → 期望历史前缀 → 目标指纹`）。
   - 文件一旦发布不可改；新增发布只追加新条目。

3. **删除正则变造夹具**
   `verify-mysql-isolated.py` 现在按 `INDEXES`/`CHECKS` 正则从当前 `schema.sql` 里删对象造「旧库」，这正是错误结论的来源。改为：逐个重放 `docs/database/baselines/*.sql` → 执行 `apply_migrations` → 断言指纹等于目标；保留其脏数据拒绝、重复升级幂等、误放 `schema.sql` 不登记、元数据等价性等既有检查。删除 `INDEXES`/`CHECKS` 变造逻辑与对应的 `assert count == 1` 假设。

4. **升级后只读指纹断言 + 漂移审计**
   `apply_migrations` 在成功执行全部待执行迁移后，计算实际指纹并与目标比较：

   - 一致：正常返回。
   - 不一致：抛 `SchemaDriftError`（含差异摘要），并向新增审计表 `sys_schema_migration_drift` 写一行（`detected_at`、`target_fingerprint`、`actual_fingerprint`、`detail`）。
   - 不自动回滚 DDL（MySQL DDL 隐式提交，回滚是假的），不自动删除已登记行（保留断点续跑语义）；由操作者按提示修复结构或使用显式准入。

   审计表由新迁移 `V20261105_02__migration_drift_audit.sql` 创建（`CREATE TABLE IF NOT EXISTS` + `information_schema` 守卫，风格与现有迁移一致）。

5. **显式人工准入**
   `scripts/migrate-database.py` 增加 `--accept-baseline <release|fingerprint>`：

   - 必须同时给出 `--reason "<文本>"`，且该值必须可由运维追溯到工单/评审，不能为空。
   - 执行前把 `(release, fingerprint, reason, operator, accepted_at)` 写入审计表后才继续；后续指纹断言仍执行，失败照常抛错。
   - 无 `--accept-baseline` 时不允许跳过拒绝路径；不接受环境变量隐式开启。

6. **指纹归一化算法（跨版本稳定）**
   指纹 = `sha256` over 四类信息的规范化文本：

   - `COLUMNS`：`TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE(小写), IS_NULLABLE, COLUMN_DEFAULT(规范化为 NULL/值), EXTRA(去掉自增序号)`
   - `STATISTICS`：`TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, 升降序`（不比较 `COLLATION` 字段本身）
   - `TABLE_CONSTRAINTS`：`TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE, ENFORCED`
   - `CHECK_CONSTRAINTS`：`CONSTRAINT_NAME, CHECK_CLAUSE`（大小写与空白折叠）

   显式忽略：`COLLATION_NAME`、字符集、`AUTO_INCREMENT` 当前值、行数、统计信息、`installed_at`。字符集/collation 作为独立软断言记录在报告里（期望 `utf8mb4_0900_ai_ci`），不参与指纹，避免在 MySQL 8.0.16 与 8.4 之间产生假失败。

7. **保留现有执行语义**
   逐条迁移执行后立即登记（支持中断续跑）、迁移内 `information_schema` 守卫、命名锁、`--check` 只读校验、应用启动 `SchemaVersionGuard` 均不变。新增的指纹断言是**追加**在成功路径末尾的只读校验。

## Alternatives rejected

- **硬编码基线表清单（旧 `R1_BASELINE_TABLES` / 新 33 表清单）**：探针显示两套清单都不等于任何真实发布形状（真实形状为 33/34/37 表），只是把一个阻塞条件换成另一个。
- **只保留「`iam_user` 存在」门禁**：实测删掉迁移不触及的业务表仍被 ACCEPTED 且历史校验 PASS，属于静默放行。
- **只做迁移前置条件 dry-run（无目标指纹）**：能提前报错，但无法发现「少了一张迁移不涉及的表」这种形态，而这是当前最危险的场景。
- **让应用启动时自动迁移**：违反只读启动约束，且多实例并发风险高。
- **升级失败自动回滚**：MySQL DDL 隐式提交，回滚会给操作者错误的安全感。
- **升级后自动删除已登记行重跑**：会让「部分完成」不可见，也破坏断点续跑。

## Risks / Trade-offs

- [指纹脆弱：MySQL 版本差异导致假失败] → 严格归一化（Decision 6）+ CI 在 8.0.16/8.0.31/8.4 上比对同一基线指纹；失败信息输出差异明细而非仅指纹值。
- [基线快照增加仓库体积] → 每个快照约 10KB，只保留有升级意义的历史发布；不保存每个提交。
- [`--accept-baseline` 被滥用成默认开关] → 必填 `--reason`、审计行、文档明确「仅在结构已人工核对后使用」，并在 PR 模板要求说明。
- [新增审计表需要一次发布窗口] → 审计表由普通迁移创建，可先发布代码与审计表、下一窗口再启用拒绝路径（见 Migration Plan）。
- [已发布库若曾被手工改过，指纹会不匹配] → 这是期望行为：给出差异摘要，由操作者决定修复或显式准入。
- [删除正则夹具会降低 `verify-mysql-isolated.py` 的检查数量] → 用基线重放 + 指纹等价替代，检查数量下降但证据可追溯性上升，报告需如实记录。

## Migration Plan

- **P1（证据与回归，不改判定行为）**：入库基线快照与 `baselines/manifest.json`；生成目标 `schemaFingerprint`；`verify-mysql-isolated.py` 改为基线重放 + 指纹等价；更正历史报告里基于猜测夹具的结论。
- **P2（判定改造）**：新增 `V20261105_02__migration_drift_audit.sql`；`apply_migrations` 双条件准入 + 升级后指纹断言；`migrate-database.py` 增加 `--accept-baseline/--reason`；`--check` 同时报告指纹差异。
- **P3（文档与登记）**：更新 `docs/database/migrations/README.md` 运行手册、SDD-12 升级章节引用、ADR（状态 Proposed，获接受后再标 Accepted）与测试报告。

回退：P2 的判定与断言集中在 `schema_contract.py` 与 CLI 参数，回退这两个文件即恢复当前行为；审计表保留不删（空表无副作用），已发布会话不受影响。

## Recorded Scope Decisions

1. **启动期不强制结构指纹**：本次继续沿用应用启动只读核验版本与校验和；结构指纹准入只属于显式迁移工具。后续若要增加启动核验，必须另立变更，先以告警模式证明 Java/Python 归一化一致，再决定是否阻断启动。
2. **责任人显式提供**：`--accept-baseline` 必须配合显式 `--reason` 和 `--operator`，不从数据库连接账号或环境变量推断责任人，避免审计责任被技术账号替代。
3. **教学版暂不纳入**：早于 `e5cd2c1` 的教学版没有当前可追溯的真实发布快照，因此不进入基线集合。取得真实 `schema.sql`、来源提交和历史前缀后，再通过独立变更新增不可变基线。
