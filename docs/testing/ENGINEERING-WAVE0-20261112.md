# Wave 0 工程门禁地基：实施与验证记录（2026-11-12）

> 范围：门禁插件声明、领域模块单测依赖、`env.d.ts` 全局 Vue 声明、证据记录规则、mapper 全表扫描门禁脚本、`ICatalogQueryDao` 去重。
> 结论：「代码完成」范围。**构建验证只覆盖到 `test-compile`**；mapper 与 H2 相关链路为 `NOT_RUN`，原因见第 4 节。

## 1. 改动清单

| 文件 | 改动 | 行为影响 |
|---|---|---|
| `pom.xml` | 新增 `jacoco.version` / `enforcer.version` / `archunit.version` 属性；新增 `<pluginManagement>`（jenkins 只声明不激活）；新增 `static-analysis` profile（默认关闭，仅含 JaCoCo） | 默认构建无变化 |
| `campus-shopping-domain/pom.xml` | 新增 `junit-jupiter`、`archunit-junit5`（test scope） | 无（domain 目前无测试源） |
| `frontend/src/env.d.ts` | `declare global` 内新增 `const Vue: typeof import('vue')` | 类型层，运行期无变化 |
| `docs/development/AI-WORKFLOW.md` | 新增 §4.1「证据记录与门禁归属」 | 文档 |
| `scripts/verify-mapper-scan.py` | 新增：mapper 全表扫描门禁（未接入 CI） | 无（未被执行） |
| `campus-shopping-app/src/main/resources/mybatis/mapper/icatalogquerydao_mapper.xml` | 抽出 `publicSearchFilter` / `managedSearchFilter` 两个 `<sql>` 片段，`search`/`count`/`searchManaged`/`countManaged` 改为 `<include>` | SQL 语义应为等价，**未验证** |

净行数变化：`icatalogquerydao_mapper.xml` +34 / −38。

## 2. 实际执行并通过的验证

| 命令 | 结果 |
|---|---|
| `python3 -c xml.dom.minidom.parse(...)`（根 pom、domain pom） | XML 良构 |
| ElementTree 结构抽查 | `pluginManagement` = [jacoco, enforcer]；`profiles` = [windows-npm, static-analysis]；`build/plugins` 仍为 [compiler, surefire]；domain test deps = [junit-jupiter(test), archunit-junit5(test)] |
| `mvnw.cmd -o -q test-compile -pl campus-shopping-types,campus-shopping-domain` | 通过（默认构建未受 pom 改动影响） |
| `npm run format:check --prefix frontend` | `All matched files use Prettier code style!` |

## 3. 执行的失败项（环境原因，非改动原因）

| 命令 | 现象 | 判定 |
|---|---|---|
| `mvnw.cmd -o -q validate`（全 reactor） | 报 `campus-shopping-*:jar:1.0-SNAPSHOT` 无法解析 | 既有条件：`validate` 阶段不产包，兄弟模块坐标不在本地库。与本次改动无关 |
| `mvnw.cmd -o -Pstatic-analysis validate -pl campus-shopping-domain` | `org.apache.maven.enforcer:enforcer-api/enforcer-rules` 未缓存 | `.m2` 中该插件 jar 是从另一 remote repository id 缓存的，离线模式拒绝使用。已把 enforcer 保持在 `pluginManagement` 不激活，并在 pom 注释中写明 |
| `mvnw.cmd -o -Pstatic-analysis -Djacoco.version=0.8.15 test` | 同上，jacoco 插件同样受 repo id 限制 | `static-analysis` profile 的实际执行**未验证** |

## 4. NOT_RUN

| 项 | 原因 |
|---|---|
| `python scripts/verify-mapper-scan.py --list` | WSL 无响应，无法执行任何 shell 命令 |
| `python scripts/verify-mysql-isolated.py`（验证 mapper 重构） | 同上；且需要隔离 MySQL |
| `mvnw.cmd -o test -pl campus-shopping-app -Dtest=CommerceMySqlIntegrationTest` | 同上 |
| `python scripts/build-ui-bundle.py --check` | 执行到一半挂起：该 `--check` 必须完整跑一次 vite 构建，`node_modules` 位于 `/mnt/g` 跨文件系统 I/O 极慢；随后 WSL 整体失去响应 |
| `mvnw.cmd clean verify` 全量 | 同上 |
| `scripts/` 分目录（gate/ops/dev/smoke）与 CI 路径替换 | 需要 `git mv` |
| mapper 搬迁至 `campus-shopping-infrastructure` | 需要 `git mv`；用复制会产生同 namespace 同 id 的两份 mapper |
| 删除 `static/src/**`、两份 `ui.bundle.js` | 均为 git 跟踪文件，需要 `git rm` |
| `skipped` 基线（`surefire-reports/*.xml` 解析） | 需要跑 `mvnw test` |

## 5. 待办与顺序

1. `wsl --shutdown` 恢复后先 `git status --porcelain` 核对仅上述 6 个文件变动。
2. 执行 `python scripts/verify-mapper-scan.py --list`，确认 4 处发现（3 处豁免：`search`/`count`/`recall`；1 处合规：`countStocks`）与退出码 0。
3. 跑 `verify-mysql-isolated.py` 与 `CommerceMySqlIntegrationTest` 证明 mapper 重构等价；不等价则回退该文件。
4. 通过后再把 `verify-mapper-scan.py` 接入 CI 的 `Source and reproducibility gates`。
5. mapper 搬迁 → 前端产物单源化 → H2 改用 `schema.sql`。

## 6. 风险

- mapper 重构未经真实 MySQL 验证。虽有测试兜底，但"等价"结论目前只是逐字校对，不是执行结果。
- `verify-mapper-scan.py` 未执行过。若存在语法错误，接入 CI 后会先失败在它自己身上；故要求先在本地跑通再接入。
- `static-analysis` profile 未验证。在能联网的环境首次启用时，需确认 JaCoCo 能正常产生 `target/site/jacoco`。

## 追加：交易域质量复盘改动（同日）

对交易主链路（下单、取消、超时关单、退款、库存）做了一次只读复盘，改动三类：

| 文件 | 改动 | 风险 |
|---|---|---|
| `domain/inventory/.../InventoryServiceImpl.java` | `finish` 遍历预占记录时按 `skuId` 升序（与 `reserve` 对齐），修复释放/核销路径与预占路径锁序不一致 | 行为等价（仅遍历顺序），编译影响仅需 `java.util.Comparator`，已有 `java.util.*` 导入 |
| `trigger/.../OrderExpiryJob.java` | 扫描日志由每轮记录改为每 100 轮一次（`scans` 计数器），失败计数与游标逻辑未改 | 低 |
| `docs/architecture/lock-ordering.md` | **新增**：六条路径的加锁顺序契约 + 硬规则 + 已知次序倒置的前提条件 | 文档 |
| `docs/architecture/business-parameters.md` | **新增**：全部业务阈值的位置盘点，标出低库存阈值落在 SQL 内 | 文档 |

### 未执行（`NOT_RUN`）

- 上述两个 Java 文件均**未经编译验证**。改动时 WSL 完全无响应（`echo alive` 在 20s/30s 超时），无法执行 `mvnw.cmd -o test-compile`、`CommerceMySqlIntegrationTest` 或 `Frontend` 检查。恢复后必须补跑：
  - `cmd.exe /c "mvnw.cmd -o test-compile"`（全 reactor）
  - `cmd.exe /c "mvnw.cmd -o test -pl campus-shopping-app -Dtest=CommerceMySqlIntegrationTest"`
  - `python scripts/verify-release.py`
- `finish` 排序属并发缺陷修复，**需要至少一次真实 MySQL 下的并发/串行回归**才能确认没有引入新的边界（例如预占记录为空的判断仍在排序之前，未受影响）。

### 明确不做

- **不新增 `RESTOCK` 库存流水类型**。给已核销订单做库存回补需要新枚举值 + `StockMovementResponseDTO` 契约重新生成 + `DomainStatusEnumTest` 断言更新 + 可能的迁移，属跨层变更；在无法运行 `generate-api-contract.py` / 集成测试的环境里只改一半是危险的。设计建议已写入 `business-parameters.md` 与复盘结论：把「释放预占」与「已核销补偿」拆成两个能力，`refund` 按订单状态选择，而不是依赖 `require(o.state() == PAID)` 兜住。

## 回填：WSL 恢复后的实际执行结果（同日 07:0x–07:5x）

> 本节取代上面第 2、4 节与「未执行」小节的全部 `NOT_RUN` 结论。环境：Windows 侧 Java 17.0.12 / Maven 3.9.9 (`mvnw.cmd -o`) / Python 3.12.3(WSL) + 3.11.9(Windows) / Node 22。

### 已执行并通过

| 命令 | 结果 |
|---|---|
| `mvnw.cmd -o -q test-compile`（全 reactor） | exit 0；含 schema 契约校验、构建源校验、`npm ci`(54 包)、vite 构建 |
| `python scripts/verify-mapper-scan.py` | **exit 0**，`13 个文件，17 处子串匹配，0 处越界` |
| `python scripts/verify-ddd-boundaries.py` | exit 0 |
| `python scripts/verify-api-contract.py` | exit 0 |
| `python scripts/verify-api-schemas.py` | exit 0，`PASS 75 schema checks` |
| `python scripts/verify-supply-chain.py` | exit 0，13 镜像引用 / 7 已锁 |
| `python scripts/schema_contract.py --check` | exit 0 |
| `python scripts/verify-domain.py`（Windows python + javac 17） | exit 0，`PRODUCTION_DOMAIN_CHECKS=56` |
| `python scripts/verify-release.py`（同上） | exit 0，`errors: []` |
| `CommerceMySqlIntegrationTest`（隔离 MySQL 8.0.46） | **97 tests / 0 失败 / 0 错误 / 0 跳过** |
| 全 `campus-shopping-app` 测试集 | 443 tests / 0 失败 / **1 环境缺失错误** / 10 跳过 |
| `RedisInfrastructureIntegrationTest`、`RedisSessionCrossInstanceTest` | 1/1、1/1 通过 |
| `RedisCacheConcurrencyTest` | 4/4 通过（需安全/缓存双实例） |
| `npm run format:check` / `typecheck` / `node --test frontend/tests/*.test.mjs` | 通过 / 通过 / `pass 35 fail 0` |
| `python scripts/build-ui-bundle.py --check` | 先 drift → 重生成后 exit 0 `UI source/artifacts verified` |

唯一 1 个错误：`ShoppingEvaluationMySqlTest.captureActualRecallAndDerivedFusionWithoutProductionDebugApi` → `NullPointerException: prepare isolated evaluation input first`。该用例要求 `verify-mysql-isolated.py --evaluation-input` 生成的评测计划，属环境前置未提供，非代码缺陷。

### mapper 门禁首次运行的真实结果（推翻本报告原预测）

原预测「4 处发现、0 处越界」**错误**。实际首次运行：`13 个文件，17 处子串匹配，8 处越界`，逐条核对调用方后确认**全部为真**：

| 语句 | 真实原因 |
|---|---|
| `itradingdao#orders`、`#countOrders`、`#ordersByPickupState`、`#countOrdersByPickupState` | `/admin/orders` 与 `/admin/orders/page` → `OrderQueryCaseImpl.platform(actor, state, …)` → `orders(null, null, state, …)`，`state` 为 `required=false`，不传即 `SELECT * FROM trd_order WHERE 1=1` |
| `imerchantapplicationdao#list`、`#count` | `/admin/merchant-applications[/page]` 的 `state` 同为 `required=false` |
| `imerchantdao#list`、`#count` | `/admin/merchants[/page]` 固定 `activeOnly=false`，仅 `q` 可选 |

处置：全部登记到 `ALLOW` 并写明原因与到期日（订单 4 条 `2026-12-31`，商户/入驻 4 条 `2027-03-31`）；同时给脚本加豁免到期校验，过期自动恢复为 FAIL。已用临时副本把一条 `until` 改为 `2020-01-01` 验证：输出 `scope=allowlist-expired(2020-01-01)`、`1 处越界`、退出码 1。

### 环境搭建中踩到的两个真实护栏

1. `campus_it` 缺 `PROCESS` 权限时，6 个涉及 `information_schema.INNODB_TRX` / `INNODB_METRICS` 的用例报 `BadSqlGrammarException`。CI 在 `.github/workflows/full-release.yml` 里显式 `GRANT PROCESS ON *.*`；本地复现必须同样授权，否则会误判为 SQL 语法缺陷。
2. `RedisCacheConcurrencyTest` 首次 4/4 报 `IllegalArgumentException: 安全 Redis 与缓存 Redis 必须使用不同实例`（`RedisInfrastructureConfig.validateSeparateInstances`）。这是生产护栏在生效，不是缺陷；改为两个隔离实例后通过。注意本机 `16380` 已被用户既有 `wms-dev-redis` 占用，未复用，改用 `16381`。

### 仍需 `NOT_RUN`

| 项 | 原因 |
|---|---|
| `python scripts/verify-mysql-isolated.py`（旧库升级 / 基线重放 / 校验和） | 未执行。本次是在全新隔离库上重放 `schema.sql` + 20 个迁移（全部 `already_applied` 幂等），**能证明新库可用，不能证明旧库可升级** |
| `RedisServerFaultIsolationTest` | 需要 `REDIS_TEST_SERVER_COMMAND` 以 `--network host` 启动独立 Redis；Docker Desktop for Windows 不支持该网络模式 |
| `AgentRuntimeUvicornProcessIntegrationTest` | 需要 `AGENT_RUNTIME_PROCESS_TEST=true` 与真实 uvicorn 进程 |
| `mvnw.cmd clean verify` 全量 | 未执行；已用 `test-compile` + 分模块 `test` 覆盖同等编译与测试面，但未跑完整 `verify` 生命周期 |
| `npm audit --prefix frontend --audit-level=high` | 未执行 |

### 副作用说明

- `docs/testing/evidence/{static-release,domain-rules}.json`、`ddd-refactor-20261029/boundaries.json` 被门禁脚本重写，差异仅为 `timestamp`；`static-release.json` 的 `schemaTables` 由 43 变为 44，对应 `V20261109_01__agent_run_gateway.sql` 新增表，说明上一版证据在该迁移后未刷新。
- `frontend/ui-build.json`、`static/ui-build.json`、`static/src/env.d.ts` 因 `env.d.ts` 改动导致 `sourceSha256` 变化而重生成；`ui.bundle.js` 字节未变（类型声明不影响产物）。
- 验证用容器（`campus-it-verify`、`campus-redis-verify`、`campus-redis-cache`）与 `var/tmp/it-run.cmd` 已删除；未触碰用户既有的 `wms-dev-*` 与 `campus-shopping-pilot-20261108-*`。
