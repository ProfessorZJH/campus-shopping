# R1 六批整改记录

输入为用户提供的完整整改方案。起点重新核对 `origin/main@ba735fa`（PR #15 已合并，已包含 `589826a`），旧报告的未修复状态不能直接视为当前状态。

| 批次 | 范围 | 状态 |
|---|---|---|
| A | CI 密钥边界、地址安全、context-path、生产配置、旧部署模板 | 完整远端验收通过（下述范围） |
| B | AI 预算/数量最终复核、无报价文案、评测阶段/来源/cleanup、HTML XSS | 完整远端验收通过（下述范围） |
| C | 知识索引 claim/lease/完成、发布并发、商户配额 | 完整远端验收通过（下述范围） |
| D | 身份/请求隔离、幂等、表单/图片上下文、路由、分页、无障碍/窄屏 | 完整远端验收通过（下述范围） |
| E | 订单/商品同步扫描、恢复、readiness、响应上限、外发与指标 | 完整远端验收通过（下述范围） |
| F | 镜像固定、SBOM、最终真实联调、容量/故障与发布边界 | 完整远端验收通过（下述范围） |

## A 实际验证

- Python 全量 `python -m pytest -q`：188 PASS；包含公网明文、URL 凭据、错误端口/片段、未列入名单的内网对端及合法 HTTPS/回环/显式内网。
- Maven 定向 `ContextPathQuotaTest,ProductionSecurityGuardTest,ProtocolBoundaryTest`：6 PASS，0 skipped。验证根路径及 `/campus` 下四类额度、商户身份、不安全生产参数拒绝。
- `verify-release.py`、`verify-java-readability.py`：PASS（静态检查）。首次 Maven 参数被 PowerShell 拆分后未执行测试，修正参数引用后上述结果通过。
- Docker Engine 本机不可用：本地镜像链路 NOT_RUN，交由对应提交的远端 CI 验收。
- 首次远端完整运行 `41197651139`：快速、完整 Maven/MySQL/FastAPI/浏览器及两个 Chromium 契约任务通过；镜像链路失败。日志确认本地覆盖使用 dev profile 后仅监听容器内回环地址，宿主映射端口请求被重置，0项HTTP执行。修复为容器内 `SERVER_ADDRESS=0.0.0.0`，宿主仍只映射127.0.0.1。须以修复后的完整运行替代首次失败，不能计为全部通过。
- 修复后 `f341fe2` 的[完整远端验收](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41198074538)五个普通任务全部成功：快速、Maven/MySQL/FastAPI/Redis/HTTP/浏览器、current/legacy Chromium 契约、真实交付镜像。可选真实 AI 跳过。对应 [PR #16](https://github.com/ProfessorZJH/campus-shopping/pull/16) 仍为 Draft，未自动合并。
- 已创建 GitHub Environment `external-ai` 并设置唯一部署分支 `main`。新名 `LIVE_NVIDIA_API_KEY/LIVE_XFYUN_API_KEY/LIVE_MILVUS_URI/LIVE_MILVUS_TOKEN` 尚未配置，不执行真实供应商请求。现有仓库密钥未读取、未删除或轮换，迁移仍需维护者操作。
- 生产可信 CA、反向代理及公网部署 NOT_RUN；本次不修改现有服务和业务数据库。

原始诊断在忽略目录 `var/r1/`；历史测试报告不覆写成当前证据。最终验收只统计对应提交且真实执行的结果。

## B 实际验证

- Java `SkuConstraintPolicyTest,PurchaseConstraintTest,AiConversationBoundaryTest`：9 PASS，0 skipped；含共享预算/数量22例、SKU30例、累计预算与数量不符/溢出拒绝。首次回归发现数量前缀处理将“要两支考试黑色签字笔”误当规格，已修复并保留原正常搜索回归。
- Python 全量200 PASS：含模型无报价伪称交易完成、阶段缺失/错误类型、虚假成功来源、清理失败、DRAFT 严格发布拒绝与复核 HTML 恶意 ID。
- 未执行真实外部模型，不代表语义质量或生产容量验收。
- `ae12e22` 的[完整远端运行](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41198423134)五个普通任务全部成功，可选真实 AI 跳过。[PR #17](https://github.com/ProfessorZJH/campus-shopping/pull/17)依赖 PR #16，未合并。

## C 实际验证

- `verify-mysql-isolated.py --mysql-bin D:\develop\mysql-8.0.31-winx64\bin --maven .\mvnw.cmd` 在全新临时 MySQL8.0.31 完成升级、重放、历史数据保留、校验和拒绝及新旧元数据等价；Maven clean verify 退出0，JUnit206成功、2个Redis测试类未配置依赖而跳过，因此脚本按零跳过要求最终报告FAIL，不能写成完整验收通过。
- 其中真实 `CommerceMySqlIntegrationTest`44项全部成功，含新索引claim竞争、过期重试、晚到完成、版本不符、计数/字节预占回滚、索引并发与频率上限。随后增加的“缓存PENDING后并发READY再发布”专项由最终远端验收验证。
- 本机 Redis 未确认为测试专用，没有复用现有实例；远端使用独立Redis补齐验证。不放宽脚本零跳过门槛。
- API/schema/DDD静态检查通过；无HTTP契约变化。迁移仅在临时库执行。

- C最终 `d6d6146` 的[完整远端运行](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41198880441)五个普通任务全部成功，含新增缓存发布专项；可选真实AI跳过。[PR #18](https://github.com/ProfessorZJH/campus-shopping/pull/18)依赖PR #17，未合并。

## D 实际验证

- `node --test frontend/tests/identity-races.test.mjs`：4 PASS，覆盖旧CSRF晚到、新旧请求并存、旧身份401及403不得重试新身份。
- `python frontend/tests/ui_fix_regression.py`：10 PASS；`ui_r1_correctness.py`：11 PASS。真实Chromium/Vue，后端为明确接口替身，覆盖幂等键同体重试/变更、慢购物车、旧订单令牌、知识库版本/文件、图片跨商户响应、错误编码、首页基础数据、键盘及320/360/390/768宽度。
- 首次专项暴露退出时旧首页卸载使新公开请求失效，已修正；320px实测工具栏溢出已调整为换行，表格保留内部滚动。失败结果不计通过。
- Java定向ProtocolBoundaryTest通过；全新临时MySQL运行中，低库存跨页和总数回归已加入。完整真实后端/Redis/镜像验收以最终提交远端结果为准。

- D首次隔离MySQL：210项，207成功、1失败、2个Redis类跳过。失败仅为新增非法筛选负例误写错误码A0001（实际既有ILLEGAL_PARAMETER=0002）；改为枚举契约后重跑。低库存真实跨页/total及其余业务断言通过，原始报告保留在var/r1/frontend-mysql.json。修正后及零跳过门槛结果单独记录。

- D修正后的隔离MySQL：Maven clean verify成功，210项中208成功、2个Redis类跳过，低库存全部断言通过。脚本仍因零跳过门槛返回FAIL。首个远端完整运行41200129341真实后端/Redis/镜像/legacy均通过；current新增专项依赖未锁定Pillow而失败，已改为内嵌固定PNG，无新增依赖，待最终HEAD重验。

- D最终`0f8f46a`的[完整远端运行](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41200669093)五个普通任务全部成功；可选真实AI跳过。[PR #19](https://github.com/ProfessorZJH/campus-shopping/pull/19)依赖PR #18，未合并。

## E 实际验证

- 新增Python容量/外发专项11 PASS：分块超限/声明长度/压缩拒绝、流关闭、readiness故障恢复、容量拒绝释放、默认内部文档无外发、批准撤回、模型证据与历史最小化、脱敏及无原文审计。外部HTTP为明确替身，不冒充供应商验收。
- Java任务测试覆盖2105订单跨轮及失败恢复，40001商品跨11个任务实例与远端失败checkpoint重放。持久化事实、并发交易和全量验证结果待下列记录。
- 首次隔离MySQL在迁移重放阶段发现新表CREATE缺IF NOT EXISTS，已修新迁移后重验，未触碰既有业务库或发布迁移。

- Python全量210 PASS，随后补配置Qdrant时内部索引/查询零外发专项，11项专项全部PASS；最终远端覆盖211项。Java确定性11项PASS（任务恢复6项、会话边界5项）。
- 真实MySQL48项已通过（205笔分页、checkpoint读写、20轮改价/checkout/提案确认并发，InnoDB lock_deadlocks无增加）。首次计数器名称错误和旧夹具缺新增依赖已修；不把这些夹具失败算作业务故障。最终整轮结果和远端独立Redis另记。

- E最终本地全量：Maven clean verify退出0，215项中213成功、2个Redis测试类跳过；脚本严格按零跳过门槛报告FAIL。迁移升级/重放/历史保留/校验和拒绝/元数据等价通过。对应源码提交ebe2903，远端使用独立Redis补齐。

- E最终`ebe2903`的[完整远端运行](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41201961843)五个普通任务全部成功，补齐独立Redis；可选真实AI跳过。[PR #20](https://github.com/ProfessorZJH/campus-shopping/pull/20)依赖PR #19，未合并。
- 远端ruleset 26259492已核对：必需Quick quality gates，审批数0，不要求CODEOWNER；未改动用户决定。

## F 实际验证

- 官方Registry获取7种镜像manifest，逐一验证内容SHA-256匹配Docker-Content-Digest且含Linux amd64；固定Dockerfile/Compose/CI引用，verify-supply-chain.py检查11处引用PASS。内容一致性不冒充签名/漏洞验证。
- 实际打包JAR及npm/Python/镜像锁生成197组件CycloneDX 1.5，官方GitHub specification/1.5 JSON Schema校验PASS（官网schema地址403，使用官方仓库版本）。本地为生成清单执行package -DskipTests，不将该命令算作测试通过。
- verify-ai-load-isolated.py：独立FastAPI/SQLite真实HTTP，12客户端80请求、容量2；19次200、61次429、0次5xx，active回零，接受请求P50=48.23ms、P95=61.30ms（仅本次本机合成小样本，不是生产性能结论）。进程重启后持久化检索通过。
- 本机Docker Engine不可用，Qdrant和固定digest后的实际交付镜像本地NOT_RUN，最终远端补齐。真实供应商/Milvus、生产TLS/代理、公网、持续负载和灾备恢复NOT_RUN，不扩大现有服务替换或数据库迁移授权。


- F代码提交`e0cc6b1`的[完整远端运行](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41202459672)五个普通任务全部成功。新增隔离Qdrant认证/写入/过滤/幂等/停止重启/本地检索/重试/删除、真实HTTP容量重启、实际测试JAR及镜像内JAR清单生成全部通过，可选真实AI跳过。[PR #21](https://github.com/ProfessorZJH/campus-shopping/pull/21)依赖PR #20。
- 收尾复核将SBOM根组件改为实际输入JAR的SHA-256，另记扫描工作区提交，避免将当前HEAD误当任意JAR的构建来源；附SBOM及JAR哈希摘要。重新生成197组件并通过官方1.5 schema校验。最终收尾提交会再次执行同一完整工作流，结果以PR #21最新HEAD Actions为准，不用旧提交代替。

## 交付状态与未执行范围

六批代码分别提交、推送并建立Draft PR #16–#21，保持前后依赖；未合并、未部署、未更改既有业务库。主分支仍要求快速门禁、审批数0。依赖合并后须重新对main核差异和集成验收。

已验证范围为单Python、多Java共享隔离MySQL/Redis的业务、HTTP/浏览器、实际镜像、Qdrant及本地小规模容量/恢复。内部知识默认外发拒绝及故障边界已覆盖；这不代表全部生产验收完成。生产CA/TLS/代理、公网、真实LLM/Embedding/Milvus、持续生产负载、灾备恢复和旧仓库secret迁移/轮换仍未执行。原始报告及SBOM保留CI artifact，正式发布须保存对应版本证据。
