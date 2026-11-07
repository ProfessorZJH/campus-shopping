# 分支实跑复验：全量 Java 298 项与静态门禁（2026-11-05）

本轮在分支 `codex/shoppingai-rag-corrections` 当前 HEAD `471a202`（工作区干净）上重跑门禁，目的是确认两件事：

1. 上一轮遗留的 `RedisServerFaultIsolationTest` 2 个 `NOT_RUN`（Windows Redis 3.2 的 RST 关闭语义）在断言修复后是否真实通过；
2. 最近三次提交（`451a8aa` 撤回迁移基线强化、`8d3fa24`/`471a202` 修正历史文档引用）是否让 `verify-release.py` 恢复 PASS。

结论：两项均已收口。Java 全量 **298 项 0 失败 0 错误 0 跳过**，上一轮「2 errors / 88 或 9 skipped」在本次真实 MySQL/Redis 环境下不再出现；`verify-mysql-isolated.py` 的 9 项迁移检查 PASS。**未做业务效果验收**：真实 LLM / Embedding / Milvus 与 `--http-smoke` 真实 HTTP+浏览器链路仍未执行，迁移基线强化仍按 B2 另行设计。

## 1. 环境

| 组件 | 版本/位置 | 说明 |
|---|---|---|
| JDK | 17.0.12 | 通过 `cmd.exe` 调用 Windows JVM，env 由 `.cmd` 批处理注入 |
| Maven | `D:\develop\Maven\apache-maven-3.8.8` | WSL 内 `mvn` 不在 PATH |
| Python | 3.11.9 | WSL 内无 `python`，统一走 `cmd.exe /c python` |
| Node | 22.16.0（Windows） | WSL 自带 Node 18 无法加载仓库 prettier 配置，前端格式检查必须走 Windows |
| MySQL | 8.0.31，127.0.0.1:3306 | 复用既有测试库（`MYSQL_TEST_URL`），未读写业务库 |
| Redis | 6379 安全实例（随机 namespace）+ 16380 隔离缓存实例 | 16380 本轮前已在运行（PID 29772），本轮未新建也未关闭 |
| mysqld | `D:\develop\mysql-8.0.31-winx64\bin` | 供 `verify-mysql-isolated.py` 起临时实例 |

## 2. 执行结果

| # | 命令 | 结果 |
|---|---|---|
| 1 | `python scripts/verify-release.py` | **PASS**，`javaSyntaxFiles=408`、`internalInterfaceImplementations=61`、`schemaTables=39`、`mybatisMapperFiles=11`、`mavenPomFiles=8`，`errors=[]`。上一轮的 FAIL 由文档链接指向已重命名迁移导致，已在 `471a202` 修复 |
| 2 | `python scripts/verify-domain.py` | 56 项领域规则检查，0 FAIL |
| 3 | `verify-api-contract.py` / `verify-api-schemas.py` / `schema_contract.py --check` | PASS / PASS / `PASS 61 schema checks` + `Schema version/checksum contract verified` |
| 4 | `npm run format:check`（Windows Node 22.16.0） | PASS（`All matched files use Prettier code style!`，含 Java 源） |
| 5 | `python scripts/build-ui-bundle.py --check` | PASS（`UI source/artifacts verified`） |
| 6 | `python -m pytest -q`（`ai-service/`） | **226 passed**，1 warning，71.02s |
| 7 | `var\verify\integration.cmd`（真实 MySQL + 双 Redis + `EVALUATION_INPUT_PATH`） | **298 tests, 0 failures, 0 errors, 0 skipped, BUILD SUCCESS** |
| 8 | `python scripts/verify-mysql-isolated.py --mysql-bin D:\develop\mysql-8.0.31-winx64\bin --skip-maven` | **PASS**，9 项检查，`mysqlVersion=8.0.31`、`existingDatabaseUsed=false`、`temporaryDatabaseCleaned=true`，`maven=NOT_RUN(--skip-maven)` |
| 9 | `mvn -B -ntp -DskipTests verify` | BUILD SUCCESS，生成 `campus-shopping-app/target/release-manifest.json` |

第 7 项中关键套件确认为真实执行：`CommerceMySqlIntegrationTest` 84 项（285.6s）、`ShoppingEvaluationMySqlTest` 1 项（67.1s）、`ShoppingEvaluationSafetyMySqlTest`、`MerchantRbacMySqlIntegrationTest`、`MySqlIdentityIntegrationTest` 全部 `Skipped: 0`。

## 3. 对上一轮 NOT_RUN 的收口

| 用例 | 2026-11-04 | 2026-11-05 |
|---|---|---|
| `RedisServerFaultIsolationTest`（2 项） | 2 errors：`java.net.SocketException: Connection reset` | **2 项通过**（单独定向运行 1.7s，全量中 0.735s） |

原因确认：用例在 `SHUTDOWN NOSAVE` 后对 Linux 的干净 EOF 与 Windows 的 RST 都接受，同时仍要求子进程在 5 秒内真实退出，因此没有用「放宽断言」换绿。该用例覆盖的「安全实例故障不影响缓存 / 缓存实例故障不影响限额」两条行为现已在本机 Windows 环境实测通过，不再需要记为 `NOT_RUN`。

## 4. 未执行范围（NOT_RUN）

- 真实外部 LLM / Embedding / Milvus 调用；`EVALUATION_*` 只使用本地既有输入，不代表真实模型效果。
- `verify-mysql-isolated.py` 的 maven 阶段（本轮 `--skip-maven`）与 `--http-smoke` 真实 Java+FastAPI+浏览器链路。
- 旧 Redis 分支库升级路径：B2 已将基线强化撤出本批次，`schema_contract.py` 的旧库判定仍为撤回后的版本，该问题维持「另行设计并验证」，本轮不声明通过。

## 5. 副作用与隔离

- 证据文件：`verify-release.py`、`verify-domain.py` 会重写 `docs/testing/evidence/**`。本轮这些改动只有时间戳/统计变化，且 `verify-mysql-isolated.py --skip-maven` 会用无 maven 的结果覆盖 `evidence/audit-20261029/mysql.json` 里已提交的完整 JUnit 记录，故执行后统一 `git checkout -- docs/testing/evidence` 还原；本报告记录的是当次输出，未把覆盖后的证据提交。
- MySQL：`verify-mysql-isolated.py` 起临时 mysqld，临时库清理完成；测试库仅由用例按 `schema.sql` 建表使用，未触碰既有业务库。
- Redis：未执行 `FLUSHDB/FLUSHALL`；6379 使用随机 namespace，16380 为本轮开始前既有的隔离缓存实例，本轮保持原状未关闭。
- 运行日志与批处理保留在 `var/verify/`（已 gitignore）：`integration-4.log`、`redis-fault.cmd` 等；批处理内含本机测试库密码，不得提交。
