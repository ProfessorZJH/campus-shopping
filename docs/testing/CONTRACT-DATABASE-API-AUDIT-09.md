# SDD-09：契约、数据库、API 与异常专项审查

日期：2026-10-29。范围为当前源码及隔离运行环境；本轮执行了修正、构建、真实数据库升级、真实 HTTP 和浏览器回归。不能把本报告等同于生产发布或全部业务的穷尽证明。

## 审查结论与修正

发现了实际缺陷，不能沿用“这些基础层都没问题”的判断。现有 Java17 / Spring Boot 3.4.3 / MyBatis 3.0.4 与 DDD 分层保持原有方向；领域校验和同库 Case 事务仍作为事实边界。修正记录如下：

| 编号 | 等级 | 原问题及影响 | 本次修正 |
|---|---|---|---|
| A01 | P1 | Java 默认 h2c 升级被本机 Uvicorn 拒绝，真实知识上传返回 AI0001；单独 Python 测试发现不了 | AI 网关固定 HTTP/1.1；真实 JDK TCP 回归，并以完整 Java→Python 上传/索引/导购链路复验 |
| A02 | P1 | Jackson 默认会把数量/价格小数截成整数，可能改变用户提交的交易数据 | 关闭 ACCEPT_FLOAT_AS_INT，拒绝尾随 JSON；测试小数、整数溢出、残缺/空/null JSON |
| A03 | P2 | MVC 进入 Controller 前的解析、参数绑定、405/415 等错误与业务响应格式不一致；超限分块正文可能误报 400 | 新增仅处理协议错误的 ApiProtocolExceptionResolver；已知长度和分块正文均以 413/G0004 返回 JSON |
| A04 | P2 | 同商户角色重名被归为 0001 系统错误 | 仅翻译 uk_merchant_role_name 冲突为 M0006，保留原始 cause；其他主键/SQL 冲突继续系统失败；真实 MySQL 验证创建/改名失败完整回滚 |
| A05 | P2 | 缺失 SKU、空可见性、权限集合含 null 等会触发 NPE | 在 Case/Domain 显式校验，返回 0002；不再依赖不可变集合对 null 的异常行为 |
| A06 | P2 | 用户名、昵称、联系人、类目编码/名称的前端长度与 API/数据库不一致 | 对齐为 32/50/50/32/50；重编译 Vue 并同步 Spring static；真实浏览器检查实际表单限制 |
| A07 | P2 | OpenAPI 仅提取类型，没有完整必填/范围；共享 DTO 创建与编辑条件未表达；200 业务失败/null 字段套成功结构 | 显式请求规则表标注领域来源，区分 SKU/版本/审核原因/知识范围；成功与失败 oneOf，响应引用字段允许 null；错误码表从枚举生成并检查漂移 |
| A08 | P2 | 订单行单价/数量、支付/退款金额缺数据库 CHECK 防线 | 新库增加 3 个约束；旧库提供独立增量迁移和脏数据前置检查，拒绝自动修改历史行 |
| A09 | P2 | 批量库存、最近消息序列、文档/提案/流水/申请分页及角色成员统计缺匹配索引 | 增加 7 个索引，应用/Docker DDL 同步；不宣称已做生产规模性能压测 |
| A10 | P2 | Python 明确拒绝的无效文件被统一报为服务不可用 | 文件提取 400/413/415/422 转 AI0004，500/503 保留 AI0001；不回显上游正文 |
| A11 | P3 | 注册限流为 300 秒窗口，但 Retry-After 固定 60 秒 | 返回各入口窗口真实剩余秒数，补登录/注册边界回归 |
| A12 | P3 | 新 UI 编译器硬编码 Linux Chromium；部分验证脚本在 Windows 中文编码或路径分隔符下失败 | 浏览器路径从 CHROMIUM_PATH/PATH/Playwright 发现；Java/Python 子进程显式 UTF-8；源码索引统一路径分隔符，实际解析 273 个 Java 文件 |

未引入全局业务异常处理器。AppException 仍穿过事务代理后在 Controller 内部捕获；Security 的登录、CSRF、账号状态响应仍由其过滤器负责。协议解析器不吞普通运行异常。对外 93 条业务路由保持，新增的是约束、错误码和明确的失败响应。

## 实际验证

| 层级 | 结果及边界 | 证据 |
|---|---|---|
| 完整 Maven clean verify | **92 通过，0 失败，0 错误，0 跳过**；含 29 项真实 MySQL 测试（交易 23、RBAC 3、身份 3） | [汇总与逐套件计数](evidence/audit-20261029/mysql.json) |
| MySQL 8.0.31 升级 | 全新临时实例；旧库经图片/RBAC/本轮迁移后，与新库字段、索引和约束一致；迁移重放两次，历史快照不变，5 类非法写入被拒绝，脏金额会阻止升级 | [数据库证据](evidence/audit-20261029/mysql.json) |
| HTTP 协议边界 | 6 项 Spring MVC/Security 检查，包含真实 Tomcat 的 Content-Length 和 chunked 两种超限上传；相关纯输入/限流/仓储/网关回归纳入 92 项 | 同上，ApiProtocolIntegrationTest 等套件 |
| 真实 Spring/MySQL/FastAPI | **173 项检查通过**；包括登录/入驻、权限、库存、单商户下单、模拟支付、自提、退款、并发最后库存、知识发布/撤回、白名单、导购提案及确认幂等；AI 明确为 LOCAL_RETRIEVAL_DEMO | [逐项真实 HTTP 证据](evidence/audit-20261029/full-http.json) |
| 真实浏览器与真实 Java | **8 项通过**，没有 API 替身；覆盖匿名公开接口、管理员 Session、退出、真实注册、普通用户管理端拒绝、移动端与 JS 错误检查 | [结果](evidence/audit-20261029/frontend-live/results.json)、[管理员现场](evidence/audit-20261029/frontend-live/admin-real.png)、[移动端现场](evidence/audit-20261029/frontend-live/consumer-real-mobile.png) |
| 前端字段回归 | **4 项通过**，真实 Chromium + Vue 预编译产物；后端为明确接口替身，不计作全栈证明 | [字段与静态产物一致性](evidence/audit-20261029/frontend.json) |
| JSON Schema | **23 项通过**；组件结构、字段边界、创建/编辑、条件审核、知识范围、失败 data=null 和响应可空字段 | [机器契约样例](evidence/audit-20261029/api-schemas.json) |
| 静态契约 | 93 条路由、DTO、错误码、分页/COUNT、公开白名单、应用与 Docker DDL、文档一致性校验；发布检查核对源码语法、Mapper 和文档链接 | `scripts/verify-api-contract.py`、[发布静态检查](evidence/static-release.json) |
| Python 检索服务 | 40 项通过；外部服务场景使用测试内显式替身 | 本轮实际运行 `python -B -m pytest -q -p no:cacheprovider` |
| 纯 Java 规则 | 56 项规则与 5000 步库存序列通过；JDK HTTP 正文 6 项通过；读模型 8 项与 SQL 映射 9 项通过 | [领域规则](evidence/domain-rules.json)、[HTTP 正文](evidence/java-http-body.json)，`scripts/verify-sdd-model.py` |

真实 HTTP 的契约校验开关为 `--check-contract`：本轮 **117 份真实响应**逐条通过 OpenAPI 校验，规格 SHA-256 见 `full-http.json.contractValidation`。173 项包含 HTTP 请求和业务断言，不等同于 173 条路由；JSON Schema 23 项是静态样例检查。CI 已增加 Schema 和字段表单门禁，并在真实 HTTP 验收中开启响应校验。

构建使用当前源码的临时副本，避免共享目录中运行的 JAR 被 Windows 锁住。数据库使用全新数据目录、随机回环端口与临时凭据；HTTP 测试另建专属测试库。未使用现有业务数据库，也未读取或输出项目 `.env`。本轮创建的 Java、Python、MySQL 进程和临时数据库已关闭清理，未重启已有服务。

本机版本：JDK 17.0.12、MySQL 8.0.31、Maven 3.8.8、Python 3.11、FastAPI 0.111.0、Uvicorn 0.30.0、httpx 0.27.0、Pydantic 2.8.2、Playwright 1.52.0。它们与仓库部分固定 Python 依赖版本不同，因此不把这次结果写为固定依赖镜像验收。

## 失败证据与复测

- 初次真实 HTTP 在 144 项检查后，于知识文档上传失败；保留 [原始失败](evidence/audit-20261029/full-http-initial-h2c-failure.json)。独立对同一个真实 Uvicorn 发送 HTTP/1.1 与默认 HTTP/2 升级请求，分别得到 200 与 400；修复后完整链路通过。不能用此前单测通过来否定这个联调缺陷。
- 开发过程中一次原目录 clean 因运行中 JAR 占用失败，改用临时构建副本；新增测试的一次编译错误修正后再执行。保留 [占用失败](evidence/audit-20261029/mysql-initial-locked-jar.json)、[测试编译失败](evidence/audit-20261029/mysql-test-compilation.json)、[网关修复前](evidence/audit-20261029/mysql-before-gateway-fix.json)，最终依据 `mysql.json`。
- [Java 服务日志](evidence/audit-20261029/java-http.txt)与 [Uvicorn 日志](evidence/audit-20261029/ai-http.txt)记录真实联调；不包含共享密钥或请求正文。证据采用 `.txt`，避免被工程的 `*.log` 忽略规则排除。

## 升级与剩余边界

已有 R1 数据库须先备份，按 [迁移说明](../database/migrations/README.md) 做数据核查并执行 `V20261029_01`，再构建部署。没有直接在当前运行的数据库执行这些更改。MySQL DDL 会隐式提交，脚本可能部分成功后中断；同名但定义不同的历史索引不会被脚本自动替换。`sys_schema_version` 尚无自动迁移执行器或启动版本门禁。

本次通过的是隔离环境中的核心 HTTP/数据库/浏览器链路，不代表 26 个页面每种角色每个状态均已穷尽测试，也不包含生产数据迁移演练、长期运行、容量/死锁压力、网关与 HTTPS 配置验收、Docker 固定镜像或真实资金行为。远程模型、Milvus、Qdrant 不在本轮隔离验证中；此前独立真实 AI 记录仍见 [AI 子系统报告](AI-LIVE-20261029.md)。

请求未知字段继续按既有 Jackson 策略忽略，可转换的整数字符串仍兼容；文档要求客户端发送规范 JSON 数字。导购 UI 的 500 字限制是主动产品限制，API 上限为 2000。协议错误信封只覆盖进入应用过滤器/MVC 的错误，容器或外部网关提前拒绝的请求可能使用其自身格式。

## 复现

```powershell
python -X utf8 scripts/generate-api-contract.py --check
python -X utf8 scripts/verify-api-contract.py
python -X utf8 scripts/verify-api-schemas.py
python -X utf8 scripts/verify-release.py
$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
python -X utf8 frontend/tests/ui_audit_contract.py
python -X utf8 scripts/verify-mysql-isolated.py --mysql-bin D:\develop\mysql-8.0.31-winx64\bin --maven D:\develop\Maven\apache-maven-3.8.8\bin\mvn.cmd --offline --http-smoke
```

按本机调整工具路径；依赖说明见迁移 README。缺少本机 mysqld、Maven、依赖缓存或浏览器时，相关结果必须记为 NOT_RUN，不能只看静态门禁通过。
