# 分支实跑验证：Python / Java / 迁移基线（2026-11-04）

本轮在原「ShoppingAI / RAG 批次 A+B」变更（分支 `codex/shoppingai-rag-corrections`，基于当时的 `3bf1f11` 与工作区修改）上补齐**真实工具链**执行：此前该变更报告只记录了静态契约与部分回归，明确写着「未在本机启动隔离 MySQL/Redis」。本轮用本机 JDK17 / Maven 3.8.8 / MySQL 8.0.31 / Redis 实跑，并对 `scripts/schema_contract.py` 的基线改动做了独立探针。

结论口径：

- **测试通过**：Python 226 项、Java 279 项（0 失败）已在本机真实执行；其中 2 项因 Redis 版本/平台语义差异无法在本机判定，记 `NOT_RUN` 而非通过。
- **未做业务验收**：未调用真实外部模型/Embedding/Milvus，未执行 `--http-smoke` 的真实 Java+FastAPI+浏览器链路。
- **审计发现**：迁移基线改动在真实旧库上会被拒绝，现有隔离脚本因「整份重放 schema.sql」而看不到该问题（见第 5 节）。

## 1. 环境

| 组件 | 版本/位置 | 说明 |
|---|---|---|
| JDK | `C:\Program Files\Java\jdk-17`（17.0.12） | `java`/`javac` 在 WSL 中需带 `.exe`，Maven 通过 `cmd.exe` 调用 |
| Maven | `D:\develop\Maven\apache-maven-3.8.8\bin\mvn.cmd` | Windows 上 `mvn` 不在 PATH，必须显式路径 |
| Python | `C:\Users\Profe\AppData\Local\Programs\Python\Python311`（3.11.9） | 已具备 `ai-service/requirements-dev.lock` 所需依赖，无需安装 |
| MySQL | 8.0.31，127.0.0.1:3306 | 新建空库 `campus_shopping_it`（执行前不存在）；既有 `campus_shopping` 等业务库未被读写 |
| Redis | `F:\software\Redis-x64-3.2.100` | 既有实例 6379 只读复用（随机 namespace）；另起临时隔离实例 **16380** 满足「安全/缓存必须独立实例」断言 |
| 源码 | 当时工作区含未提交修改 | 该报告记录的是当时的验证快照，不代表当前工作区状态 |

环境变量必须通过 `.cmd` 批处理 `set` 注入：从 WSL 导出的变量**不会**传给 `cmd.exe` 启动的 Windows JVM，第一轮因此出现 88 项被 `@EnabledIfEnvironmentVariable` 跳过（见 3.3）。

## 2. 执行结果

| # | 命令（要点） | 结果 |
|---|---|---|
| 1 | `python -m pytest -q`（`ai-service/`） | **226 passed**，1 warning，78.61s |
| 2 | `mvn -B -ntp -Dfrontend.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest=DddRulesTest,SkuConstraintPolicyTest,PurchaseConstraintTest,AiGatewayProductIndexTest,AiGatewayProtocolTest,ProductVectorSyncJobTest,AiConversationBoundaryTest test` | **51 tests，0 失败，BUILD SUCCESS**（27s） |
| 3 | `mvn -B -ntp -Dfrontend.skip=true test`（`MYSQL_TEST_URL=campus_shopping_it`、`REDIS_TEST_ADDRESS=6379`、`REDIS_TEST_CACHE_ADDRESS=16380`、`EVALUATION_*`） | **279 tests，0 failures，2 errors，0 skipped**（8m21s；Windows Redis 3.2 RST，详见第 4 节） |
| 4 | `mvn -B -ntp clean verify`（含 `npm ci` + UI 构建 + schema 契约 + build-source） | `npm ci` 成功（29 包 4s）、UI 构建成功；测试阶段同 #3，故 `verify` 阶段未执行 |
| 5 | `mvn -B -ntp -DskipTests verify` | **BUILD SUCCESS**（14.5s），生成 `campus-shopping-app.jar` 与 `release-manifest.json` |
| 6 | `python scripts/verify-mysql-isolated.py --mysql-bin D:\develop\mysql-8.0.31-winx64\bin --skip-maven` | **PASS**，8 项检查全通过，`mysqlVersion=8.0.31`、`existingDatabaseUsed=false`、`temporaryDatabaseCleaned=true` |
| 7 | `python scripts/verify-release.py` | **当时报告为 PASS**（`javaSyntaxFiles=404`、`internalInterfaceImplementations=61`、`schemaTables=37`）；当前在合并树中因历史文档链接指向已重命名迁移而 FAIL，见交付说明 |
| 8 | `verify-api-contract.py` / `verify-api-schemas.py` / `schema_contract.py --check` | 58 项 PASS / PASS / PASS |

第 3、4 步的 2 个 error 全部来自 `RedisServerFaultIsolationTest`，见第 4 节。

### 3. 与前一版本的差异（同一提交）

1. 「单 Redis」时 `RedisCacheConcurrencyTest` 4 项因 `validateSeparateInstances` 直接报 `IllegalArgumentException: 安全 Redis 与缓存 Redis 必须使用独立实例`；改为 6379(security)+16380(cache) 后 4 项全部通过，`RedisSessionCrossInstanceTest`（双 JVM 跨实例会话，54s）亦通过。
2. 首轮全量因环境变量未注入而 88 项跳过；用批处理注入后 **skipped=0**，`CommerceMySqlIntegrationTest`、`ShoppingEvaluationMySqlTest`、`ShoppingEvaluationSafetyMySqlTest` 均为**真实 MySQL** 执行。
3. 报告 `SHOPPINGAI-RAG-CORRECTIONS-20261101.md` 里「未在本机启动隔离 MySQL/Redis」的表述已被本轮覆盖，该文件已追加复验小节。

## 4. 平台受限未执行项（NOT_RUN）

`RedisServerFaultIsolationTest` 2 项（`cacheServerOutageDoesNotBreakSecurityQuota`、`securityServerOutageDoesNotBreakDisplayCache`）：

```
java.net.SocketException: Connection reset
    at RedisServerFaultIsolationTest$TestServer.close(RedisServerFaultIsolationTest.java:104)
```

- 原因：该用例用 Redis 子进程模拟依赖故障，关闭时发 `SHUTDOWN NOSAVE` 后断言 `read() == -1`（期望干净 EOF）。本机是 **Windows + Redis 3.2.100**，服务端关闭连接发 RST → 读操作抛 `ConnectionReset`；CI 使用 `redis:7.4.2-alpine`（Linux）时返回 EOF，断言成立。
- 处理：**未修改测试**（不通过放宽断言换绿）。该用例在本机记 `NOT_RUN`，其覆盖的「安全实例故障不影响缓存 / 缓存故障不影响限额」行为需在 CI 或具备 Redis 7 的环境确认。
- 待办：见下一轮计划 H 项（提升用例对不同关闭语义的健壮性，或明确声明所需 Redis 主版本）。

未执行的其他范围：

- 真实 LLM / Embedding / Milvus 调用（属正式 AI 效果验收，需独立凭据与网络）。
- `verify-mysql-isolated.py` 的 maven 阶段与 `--http-smoke`（真实 Java+FastAPI+浏览器）。第 3~5 步已在真实 MySQL 上覆盖等价的测试与打包，但未在「临时 mysqld + 独立 Redis + 双 JVM」组合下重跑，也未启动真实 HTTP 链路。

## 5. 迁移基线探针（审计发现，需决策）

当时工作区的 `scripts/schema_contract.py` 把 `R1_BASELINE_TABLES` 从「`CORE_BASELINE_TABLES[:31]`」改为「排除 `ai_knowledge_quota`/`ai_knowledge_usage`/`ai_sync_checkpoint`」。用独立探针（`var/verify/p13_baseline_probe.py`、`var/verify/p13_lists.py`）在新建临时库上验证：

| 场景 | 结果 |
|---|---|
| A：真实旧 Redis 分支形状（31 表，无 `iam_merchant_role*`、无 V31_02 列），**不重放** `schema.sql` | **REJECTED：目标库不是完整 R1 基线，拒绝把部分数据库当作可迁移数据库** |
| B：同一夹具 + 整份重放 `schema.sql`（`verify-mysql-isolated.py:114-117` 的现有做法） | **ACCEPTED** |

基线列表与实际夹具的差异：

```
旧库夹具表数: 31
旧基线列表(31) 缺失: ['ai_knowledge_quota', 'ai_knowledge_usage']
新基线列表(33) 缺失: ['iam_merchant_role', 'iam_merchant_role_permission']
新列表相对旧列表: -ai_knowledge_quota/-ai_knowledge_usage
                  +sys_schema_version/+trd_cart_owner/+iam_merchant_role/+iam_merchant_role_permission
```

结论与影响：

1. 本分支的改动只是**把一个阻塞条件换成另一个**：旧列表因缺 V31 迁移创建的表而拒绝，新列表因要求 V20261028_02 迁移创建的 RBAC 表而拒绝。两套硬编码清单都不描述旧 Redis 分支的真实形状，`docs/specs/SDD-REDIS-12.md` 承诺的「旧 Redis 升级」路径仍然不可用。
2. `verify-mysql-isolated.py` 在旧库上重放整份 `schema.sql`（并断言未登记迁移）后才调用 `apply_migrations`，因此第 6 步的 `PASS` **不能**证明真实旧库可升级；这正是被掩盖的位置。
3. 旧库夹具仍保留 `index_expires_at`、`index_version`（V20261031_02 新增列），因此该迁移的 `ADD COLUMN` 分支在本脚本中从未被执行。
4. 后续已采用 B2 收口：本轮不把迁移基线强化并入 ShoppingAI 变更；该旧库兼容问题需另行设计和验证。
5. **更正（2026-11-05）**：本节结论基于一个用正则变造出来的「旧库夹具」，不代表任何真实发行形状。改用 git 固定的真实发布 `schema.sql` 复验后，v1.2.3 导入版（33 表）、pre-Redis 版（34 表）、pre-multi-image 版（37 表）均可在当前代码上升级成功，且升级后结构与新空库指纹一致；真实缺陷是残缺库被静默登记为已升级。证据与修正后的范围见 [旧库升级形状探针](LEGACY-DB-UPGRADE-PROBE-20261105.md)，后续设计见 `openspec/changes/legacy-db-upgrade-baseline/`。

复现方式（需本机 MySQL 凭据与 `scripts/` 依赖）：

```text
cmd> python var\verify\p13_baseline_probe.py
cmd> python var\verify\p13_lists.py
```

探针库均以 `p13_*` 命名、执行后 `DROP DATABASE`；不触碰既有业务库。

## 6. 副作用与隔离声明

- 新建库 `campus_shopping_it`（本轮前不存在，仅用于测试；测试自身按 `schema.sql` 建表并在用例前清理固定表）。
- Redis：既有 6379 只被随机 namespace 读写，未执行 `FLUSHDB/FLUSHALL`；临时实例 **16380 已关闭**（PID 10752）。复跑命令：
  `F:\software\Redis-x64-3.2.100\redis-server.exe --port 16380 --save "" --appendonly no`
- `scripts/verify-release.py` 会重写 `docs/testing/evidence/ddd-refactor-20261029/{api-schemas,boundaries}.json` 与 `static-release.json`；本轮已 `git checkout` 还原，避免把无关证据目录的改写夹带进本次变更。
- 运行日志与批处理保留在 `var/verify/`（已被 gitignore）：`integration-3.log`、`full-verify.log`、`package-verify.log`、`mysql-migration.json`、`p13_*.py`、`*.cmd`。批处理内含本机测试库密码，属本地临时文件，不应提交。

## 7. 对既有结论的更新（当时快照）

| 编号 | 原结论 | 现状 |
|---|---|---|
| P1-1 | 任务清单勾选「隔离 MySQL/HTTP 测试」，报告写「未启动隔离 MySQL/Redis」 | 集成部分已真实执行（skipped=0），文档需按第 2 节更新；HTTP/浏览器与真实模型仍为 NOT_RUN |
| P1-2 | 结构化 `attributes` 端到端不可达 | 仍成立；Java 侧无 attributes 契约测试 |
| P1-3 | 旧库夹具与基线表集合冲突 | **仍需单独设计**；B2 已将本次 ShoppingAI 提交中的基线强化撤出，原始探针结论仍有效 |
| P2-1/2/3/4/5 | 知识授权查询放大、permit 生命周期、词表重复、设计文档漂移、索引失败语义 | 均未触及，仍成立 |
