# Spec Delta

## Purpose

让旧库升级的准入、执行结果与验证夹具都可追溯到真实发布状态，使「这个库可以升级」不再依赖猜测的表名清单，也让残缺库不能被静默标记为已升级。

## ADDED Requirements

### Requirement: Upgrade admission is decided by registered history plus structure fingerprint
系统 MUST 只接受三类入口状态：空库、已登记历史的某个已发布前缀且结构指纹等于该状态目标、或结构指纹等于某个已发布基线但缺少登记历史。系统 MUST NOT 以硬编码表名清单或单一哨兵表（如 `iam_user`）的存在作为准入判据。

#### Scenario: Released legacy database upgrades
- **WHEN** 目标库由已发布 `schema.sql` 创建（例如 33/34/37 表的历史形状），且已登记历史是该发布的前缀或为空
- **THEN** 系统执行其后全部迁移，并在成功路径末尾断言结构指纹等于当前发布目标

#### Scenario: Empty database registers full baseline
- **WHEN** 目标库不含任何业务表
- **THEN** 系统建立完整基线并登记全部版本，不执行任何 `ALTER` 式升级

#### Scenario: Sentinel table is not sufficient
- **WHEN** 目标库含 `iam_user`，但结构指纹不等于任何已发布状态
- **THEN** 系统在任何 DDL 之前拒绝升级，并返回缺失/多余对象明细

### Requirement: Rejection happens before any DDL
系统 MUST 在写入任何结构变更之前完成准入判定；判定只允许只读查询。系统 MUST NOT 在判定失败时写入 `sys_schema_migration`、审计表或业务数据。

#### Scenario: Incomplete legacy database
- **WHEN** 目标库缺少既有发布中的业务表（例如 `trd_cart_item`、`ful_pickup_task`）
- **THEN** 系统拒绝升级，库内不产生新增迁移登记与结构变更

#### Scenario: Unknown drifted database
- **WHEN** 目标库存在手工改过的列或索引，导致指纹不匹配
- **THEN** 系统拒绝自动升级，并提示人工核对或显式准入

### Requirement: Structure verification fixtures come from released artifacts
验证 MUST 用从发布提交复制的不可变基线快照（`docs/database/baselines/<release>.sql`）重建旧库；MUST NOT 通过从当前 `schema.sql` 增删对象的方式合成旧库夹具。

#### Scenario: Baseline replay
- **WHEN** 对每个基线快照执行显式迁移
- **THEN** 迁移成功，且结果指纹等于由当前 `schema.sql` 创建的新空库指纹

#### Scenario: Fixture fidelity
- **WHEN** 有人新增一条基线
- **THEN** 该基线必须对应一个真实发布提交，并登记其期望历史前缀与目标指纹

### Requirement: Successful upgrade is verified by fingerprint, not by registration rows alone
系统 MUST 在迁移执行完成后计算实际结构指纹并与发布目标比较。不匹配时 MUST 报错并记录漂移审计，MUST NOT 仅凭 `sys_schema_migration` 内容判定升级成功。

#### Scenario: Missing table outside migration scope
- **WHEN** 目标库缺少一张不被任何迁移触及的业务表，全部迁移登记完成
- **THEN** 系统报告结构漂移并失败，不输出成功信息

#### Scenario: Drift audit record
- **WHEN** 指纹断言失败
- **THEN** 审计表记录检测时间、目标指纹、实际指纹与差异摘要，且不自动删除已登记行、不自动回滚 DDL

### Requirement: Explicit human admission is audited
系统 MUST 只允许通过显式 CLI 参数（`--accept-baseline <release|fingerprint>` 且带非空 `--reason`）跳过准入拒绝；MUST NOT 通过环境变量或配置隐式开启。准入事实 MUST 写入审计记录后才继续执行。

#### Scenario: Explicit adoption
- **WHEN** 运维在人工核对结构后使用 `--accept-baseline` 并提供原因
- **THEN** 系统记录准入审计、继续执行迁移，并在末尾仍执行指纹断言

#### Scenario: Silent bypass is rejected
- **WHEN** 未提供 `--accept-baseline` 或 `--reason` 为空
- **THEN** 系统拒绝升级，不产生任何结构变更

### Requirement: Fingerprint is normalized and stable across supported MySQL versions
结构指纹 MUST 只覆盖表/列/索引/约束的结构定义，并 MUST 忽略字符集与 collation、`AUTO_INCREMENT` 当前值、统计信息与迁移时间戳，使同一基线在 MySQL 8.0.16、8.0.31、8.4 上得到相同指纹。

#### Scenario: Collation-independent fingerprint
- **WHEN** 两个库结构相同但库级 collation 不同
- **THEN** 指纹相同，字符集差异作为独立软断言报告

#### Scenario: Column change is detected
- **WHEN** 某列类型、可空性或默认值被改动
- **THEN** 指纹不同，并输出该列的具体差异
