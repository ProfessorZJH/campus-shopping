# 校园智能导购及商品交易平台 · R1 交付候选版

> **本地真实 Spring/MySQL、真实 AI 导购与浏览器交易闭环已完成列明范围的验收。** Docker、Qdrant、生产部署与性能验收不在本次通过范围，具体证据见下文。

## 当前工程化流程（2026-10-29）

- JDK17 / Node22.16.0 / Python3.11；使用仓库 Maven Wrapper3.9.9、npm lock 和带哈希的 Python lock。`mvnw clean verify` 从 `frontend/src` 重新编译 UI，禁止手改生成静态副本。前端改动后运行 `python scripts/build-ui-bundle.py`，CI 用 `--check` 全量比对。
- 新增迁移后运行 `python scripts/schema_contract.py` 并审查生成文件。已有库先备份，在维护窗口显式运行 `scripts/migrate-database.py`；应用默认只读核对版本/校验和，不执行升级 DDL。此前已手工执行 SQL 也须登记迁移历史。
- `npm run format:check --prefix frontend` 检查 Java/前端格式；Maven verify 生成 `campus-shopping-app/target/release-manifest.json`，不再维护根目录静态清单。日志不得包含凭据、提示词或下游异常正文。
- 本轮工程化验证使用全新临时 MySQL/构建目录，不连接既有业务库或真实 AI。实际证据和 Docker NOT_RUN 边界见 [ENGINEERING-10](docs/testing/ENGINEERING-10.md)。以下历史验收记录保留当时范围，不能混记成本轮通过。

## 本地真实导购与页面验收（2026-10-29）

用户明确授权后，备份并只重建本机 `campus_shopping`，执行 schema/data 及最新增量 SQL；未配置隔离测试库。真实 HTTP 173 项、严格 AI 事务 19 项、浏览器商品 5 项、交易闭环 12 项、路由/权限/移动端 40 项（含 28 条路由）、基础浏览器 8 项、只读 MySQL 核对 8 项通过。最新 Maven `verify` 为 63 通过、29 跳过；Python 40 通过。原始模型超时、验收脚本误判与复测均保留。

- [实际范围、证据与复现](docs/testing/LOCAL-LIVE-20261029.md) · [数据库结果](docs/testing/evidence/local-live/database-readback.json) · [浏览器证据](docs/testing/evidence/local-live/browser/)
- Java 周期同步已将明确标记的验收商品写入现有 Milvus 商品集合；仅本地验收启动器显式允许用户指定的 HTTP 主机并绑定回环，正常应用仍拒绝公网 HTTP，默认同步配置不变。凭据、备份和验收账号仅在忽略目录。
- 本轮复测沿用重建后的数据，新增交易会带来实际库存消耗；报告保留原始失败。不要将本轮跳过的 MySQL JUnit 写为通过。

以下阶段记录保留当时的验证边界；后续本地端到端结果以上节报告为准。

## 前序真实 AI 子系统验收（2026-10-29）

NVIDIA 2048 维 Embedding、Milvus 2.5.4 和讯飞 `spark-x2.6` 已真实调用；121 件合成商品索引、语义召回、幂等/增量同步、真实 Uvicorn → 讯飞推荐及预算/库存/知识白名单等复测后 21 项有效检查通过。Maven `verify` 成功：48 通过、28 MySQL 测试跳过；Python 单测 40 通过。原始失败和复测均保留，不能误写为全栈通过。

- [真实验收范围、证据与复现](docs/testing/AI-LIVE-20261029.md) · [汇总](docs/testing/evidence/ai-live-summary.json) · [验收脚本](scripts/smoke-ai-live.py)
- 本轮在向用户说明 TLS 不可用后，按其指定的现有 HTTP Milvus 连接仅对验收脚本显式例外；报告记录 `encrypted=false`。正常应用仍拒绝公网 HTTP，正式同步默认关闭；此例外不视为后续部署授权。凭据仅在 Git 忽略的本地 `.env`。正式商品集合未写入，验收临时集合已清理。

在已有小傅哥 DDD 工程上持续实现，保留 Java17 / Spring Boot3.4.3 / MyBatis3.0.4；因真实跨域事务增加 Case 模块。前端为同源 Vue3，AI 为独立 Python FastAPI。

## 前端 UI 改造（2026-10-28）

根据高保真原型实现的 **消费者首页、AI 导购、商户商品管理** 三个 Vue 3 页面，默认新界面为 `/#/`、`/#/ai`、`/#/merchant/products`；原 R1 其他功能仍可以访问 `/legacy.html`。纯视觉预览访问 `/?demo=1#/`，标识演示数据且不执行写入。

- [前端运行说明](frontend/README.md) · [三页实施规格](docs/specs/UI-THREE-PAGES.md) · [浏览器验证报告](docs/testing/UI-THREE-PAGES-VERIFICATION.md)
- 真实浏览器截图在 `docs/testing/evidence/ui-three-pages/`；本批 23 项浏览器检查通过，Java/MySQL 全栈仍待本地验收。

## 前端全页面扩展（2026-10-28）

在前三页高保真设计基础上补齐消费者购物/订单/自提/账号、商户订单库存店员售后及平台商户审核监管知识库等页面。共覆盖 26 个页面路由，延续一致的清爽浅色设计。使用真实 Java Controller 路径与 DTO 发送请求；只验证了浏览器与接口契约替身，尚未通过 Spring/MySQL 端到端联调。

- [完整页面规格与路由](docs/specs/UI-REMAINING-PAGES.md)
- [浏览器与契约测试记录](docs/testing/UI-REMAINING-PAGES-VERIFICATION.md)
- [前端预览与联调说明](frontend/README.md)

## SDD-05：商户自定义角色与权限（2026-10-28）

在商户工作台新增 **角色权限**（`/#/merchant/roles`），Owner 可以新建、修改、删除本商户自定义角色，并在 **店员管理**（`/#/merchant/team`）把成员分配到自定义角色。默认 Owner/CLERK 不可删除或修改，平台管理员不能通过商户接口授予。角色权限包含商品、库存、订单、自提、售后、知识库等 15 个权限码；敏感的角色治理、成员管理、门店设置仍由 Owner 独占，所有受控接口由 Java 按当前登录人和商户实时复权，前端菜单/操作以同一份工作台权限码渲染。

商品列表新增 `NEWEST`、`PRICE_ASC`、`STOCK_DESC` 三种 **服务端全局排序**，先排序再分页。现有数据库升级须先备份并执行 `docs/database/migrations/V20261028_02__merchant_rbac.sql`，旧库若尚未应用 SDD-02 图片字段，还需先执行 `V20261028_01`。**这属于源码与浏览器替身验证完成的候选版，真实 Maven/MySQL 及多角色登录的端到端测试仍未完成。**

- [SDD-05 领域、接口与权限矩阵](docs/specs/SDD-RBAC-05.md) · [真实执行结果和未跑测试](docs/testing/SDD-RBAC-05-VERIFICATION.md)
- [角色管理桌面/移动截图](docs/testing/evidence/rbac/) · [新增 SQL](docs/database/migrations/V20261028_02__merchant_rbac.sql)

## UI-06：前端界面收敛（2026-10-29）

基于 v1.2 RBAC，对消费者、商户、平台页面进行展示精简：移除重复中文教程、装饰性英文副标题、页面上的权限技术码和不可用通知入口；保留真实交易状态、必填校验及权限错误。商户/平台窄屏现有导航不再消失，改为权限一致的可滚动菜单，并自动定位当前页面。角色设计预览现在有只读示例数据，正式版角色 CRUD 与服务端鉴权逻辑不变。

- [界面规范](docs/specs/UI-POLISH-06.md) · [验证记录](docs/testing/UI-POLISH-06-VERIFICATION.md) · [前端运行说明](frontend/README.md)
- 仅源码、预编译静态资源与受控浏览器回归完成，**真实 Spring/MySQL 端到端联调仍需执行**。

## SDD-07：商品按需求召回与讯飞 MaaS 模型接入（2026-10-29）

导购不再截取最新 100 个商品后才排序：先用 Python 规则/可选 LLM 生成有上限的检索词，Java Catalog 通过 MySQL 在全部已上架商品中进行关键词召回，最多取 200 商品/300 SKU，再由 Python BM25 与可选模型推荐。价格、库存、权限和加购仍由 Java 复核；不声称商品向量索引已建立。

可在**本地未提交的 `.env`** 中配置 `LLM_BASE_URL=https://maas-api.cn-huabei-1.xf-yun.com/v2`、`LLM_MODEL=spark-x2.6`（若控制台授权的模型 ID 不同则替换），并配置私有 `LLM_API_KEY`。本次未将 API Key 写进工程，也未完成真实讯飞与 MySQL 联调。

- [召回与安全设计](docs/specs/SDD-AI-RECALL-07.md) · [验收记录](docs/testing/SDD-AI-RECALL-07-VERIFICATION.md)

## 商品图片闭环（IMG-01 · 2026-10-28）

商户商品管理已补上传/预览/换图/移除主图交互：使用已存在的 Java 上传接口获取 `/media/*.png`，创建/编辑商品时提交 `imageUrl`；消费者首页、详情、AI、购物车等页面统一显示图片和缺图占位。浏览器与 API 契约测试已通过，**真实 Spring/MySQL 图片联调仍未验收**。

- [完整图片规格](docs/specs/UI-PRODUCT-IMAGES.md) · [实际验证](docs/testing/UI-PRODUCT-IMAGES-VERIFICATION.md)

## SDD-02 前后端契约与历史商品图片修复（2026-10-28）

在完整前端和 IMG-01 基础上补齐商户公开详情、多 SKU、新版本文档、后台商户名、服务端分页、购物车与 AI 推荐主图、**订单历史图片快照**。新增订单字段的旧库迁移文件：`docs/database/migrations/V20261028_01__order_item_image_snapshot.sql`；**升级旧库前先备份并执行该 SQL，再启动新 Java 代码**。

- [实施规格](docs/specs/SDD-INTEGRATION-02.md) · [真实验证层级](docs/testing/SDD-INTEGRATION-02-VERIFICATION.md) · [纯 Java 检查](scripts/verify-sdd-model.py)
- 设计预览与模拟 HTTP 不代表 Java/MySQL 已联调；商户、审核等部分自由文本列表筛选仍是“当前页过滤”，不声明跨页搜索能力。

## 已写入的业务能力

- 消费者：注册、会话登录、公开商品搜索、多规格选择、按商户购物车、下单、模拟支付、取消、自提凭证、未提货整单退款、导购与提案确认。
- 商户：完整入驻申请、门店资料、商品/规格/售价、图片上传、补货、备货/核销、售后、员工邀请与撤销、公开或内部知识库。
- 平台：受控管理员初始化、审核开通、暂停/恢复商户、商品监管、类目管理、争议退款裁决、订单与经营统计。
- AI：文本/Markdown/文本 PDF 入库与版本发布、权限白名单、混合检索、引用、会话、10分钟提案、确认后幂等加购；无模型时明显标记本地检索演示。

所有真实资金行为均为模拟；没有实际扣款、分账或商户提现。首版每商户一个门店、一订单一个商户。

## 交付入口

[交付范围与限制](docs/DELIVERY-R1.md) · [运行手册](docs/operations/R1-runbook.md) · [实际验证报告](docs/testing/R1-verification.md) · [实施规格](docs/specs/RELEASE-01.md) · [需求追踪](docs/TRACEABILITY.md) · [接口清单](docs/api/http-api.md)

## 本地构建与启动

具备 Docker Engine + Compose 且能下载镜像/依赖的机器：

```bash
python scripts/dev-up.py
# 健康检查成功后，再运行完整真实业务验收；不能把启动等同验收。
python scripts/smoke-full.py
```

首次启动生成 `.env` 中的随机数据库/服务/管理员凭据，不覆盖已有配置。管理员用户名/密码查看本地 `.env`；不要提交、截图或分享该文件。默认只开放 `http://127.0.0.1:8091`。生产必须增加 HTTPS、Secure Cookie、备份和安全验收，不能直接公网部署默认演示配置。

不用 Docker 时，按运行手册配置 MySQL 8、JDK17、Maven、Python环境，并执行 `mvn clean verify`。本包没有伪造已经构建的 JAR。

## 实际测试层级

- `python scripts/verify-domain.py`：编译原始生产纯领域代码，56项规则检查及5000步库存随机序列。
- `python scripts/verify-http-body.py`：真实JDK客户端/服务器验证HTTP正文大小和完整响应超时。
- `cd ai-service && python -m pytest -q`：真实Python应用/SQLite检索；外部LLM故障等使用标注清楚的测试替身。
- `python scripts/smoke-ai-local.py`：启动真实Uvicorn并通过本机TCP验证共享密钥、索引、白名单和删除。
- `python frontend/tests/contract_ui.py`：真实Vue/Chromium，**后端是接口替身**，不是Java数据库联调。
- `mvn clean verify`：SDD-11 在全新临时 MySQL 中 116 通过、0 失败、0 跳过，随后真实 HTTP 173 项、严格响应 117 份与浏览器 8 项通过，AI 使用本地检索；详情见 [本轮报告](docs/testing/DDD-REFACTOR-20261029.md)。此前本机真实模型验收的 63 通过、29 跳过及 `live_shopping.py` 等结果保留在上方历史报告，不能混记成本轮通过或将有限用例等同穷尽验证。

## 工程目录

`api` 定义接口/DTO；`trigger` 实现HTTP入口；`case` 编排跨域事务；`domain` 维护业务模型与仓储/远程Port接口；`infrastructure` 实现MyBatis和Python HTTP网关；`app` 启动与安全配置；`types` 公共业务错误。`frontend/` 为可编辑模板和浏览器测试，`ai-service/` 为Python服务。

保留中文业务注释、AppException/ResponseCode、Controller内捕获；不增加远程密码Port或全局业务异常处理器。历史教学代码和教程不再作为当前运行步骤，以上R1规格为准。
## SDD-07 商品召回和讯飞大模型（2026-10-29）

- 现行内部 Python 接口为 POST `/v1/recall`（返回 query/terms）和 POST `/v1/query`（增加可选 retrievalQuery）。对消费者的 93 条 HTTP 路由未变。
- Catalog.recall 先对全量公开商品按关键词匹配/加权再截断 200 件；SKU 跨商品均衡取样最多 300。严禁重新退回最新 100 件的无条件预截断。
- LLM 仅生成检索词/解释，不决定价格、库存、权限或购物车写操作；实际确认仍必须经过 Java Proposal 和同事务复验。
- 讯飞 MaaS 用服务端环境变量配置 /v2 与模型 ID，密钥不得放进源码、README 或前端。商品侧尚未实现语义向量索引/完整混合召回，不得在产品说明中声称已实现。
- 现行 SDD 详见 docs/specs/SDD-AI-RECALL-07.md；无 Maven、MySQL 或真实模型可用性时必须标记 NOT_RUN。

## SDD-08 商品混合召回（2026-10-29）

- 商品 Milvus 集合 `campus_products_v1` 仅是公开商品 ID + 文本指纹 + 语义向量索引，不是商品事实库。禁止信任向量库里的价格、库存、用户或权限。
- Java Case 合并 MySQL 词面与 Milvus 语义 ID 时，必须通过 `Catalog.recallByIds` 校验实时 PUBLISHED + 商户 ACTIVE + ACTIVE SKU，最终库存和加购继续 Java 事务内复核。
- Python `Provider.embed` 对 NVIDIA 使用 `input_type=passage/query`，Milvus 不可达降级词面，未索引不得假装语义命中。
- 商品索引同步默认关闭，只在安全私有 Milvus 连接已设置后开启；公网明文 HTTP 根密码一律拒绝。各项凭据仅存私有 .env / secrets。
- 精确设计与尚未验证项见 docs/specs/SDD-AI-HYBRID-08.md。

## SDD-11：枚举、异常与领域能力（2026-10-29）

- 状态与固定权限字典归本领域 EnumVO；聚合内部使用枚举，HTTP/数据库字符串值兼容；不得将未知状态放行到仓储。
- Trading 服务按购物车/订单/售后，ShoppingAI 按知识/会话/提案拆分；调用方依赖窄能力。跨域事务、锁顺序和实时事实复验继续由 Case 保证。
- AfterSaleAggregate、KnowledgePublicationAggregate、ProposalAggregate 维护状态规则；RecommendationPolicy 维护融合、配额和建议约束；不得重新放回 Controller 或远程模型。
- 响应字段必须同步 scripts/api_response_rules.py；禁止恢复所有响应字段可缺失/可空。业务异常仍由 Controller 内捕获，ApiResponses 仅构造信封，ControllerFailures/FailureDiagnostics 记录安全诊断。
- Catalog/Inventory 跨域读取只允许 QueryRepository/QueryDao 白名单；禁止查询适配器写入/锁定或跨域写表。scripts/verify-release.py 已调用 verify-ddd-boundaries.py。
- 本轮全新隔离 MySQL/Maven 116 项零失败零跳过、真实 HTTP 173 项、严格响应 117 份、真实浏览器 8 项通过；AI 本轮为本地检索，远程模型/Milvus、Docker 与性能未重新验收。详情见 docs/testing/DDD-REFACTOR-20261029.md。

## 远端与本地整合（2026-10-29）

- 角色治理归 IRoleService/IRoleRepository，图片文件归 IProductImageRepository；交易与 AI 的各窄仓储有独立适配器，组合仓储接口已移除。
- 保留 SDD-11 的查询能力、批量读模型与严格契约；知识发布聚合调用 KnowledgePublicationPolicy，仓储继续在根行锁下装载并保存。
- 商品索引写入必须校验 MILVUS 模式与完整数量；删除拒绝 DISABLED，允许 EMPTY_INDEX/幂等删除。同步失败不得更新成功时间。
- Java 自动格式化为 4 空格/160 列，前端维持单独规则。
- 本次隔离 clean verify 140 通过、0 跳过；HTTP 173、严格响应 117、真实浏览器 8、Python 42 通过。Docker、远程模型/Milvus与性能本次未验收。见 docs/testing/INTEGRATION-20261029.md。

## 代码职责与并发修复（2026-10-30）

- Catalog/Cart Controller 只依赖 Case；跨域查询返回完整读模型，商户批量查询，必填响应字段在 ApiViews 一次组装。商品新增响应事实在事务内完成。
- AI 长调用入口使用 NEVER；会话按完整 ID 领取数据库时间裁决的 10 分钟租约，完成和失败释放均校验 token。消息、提案与租约完成由短事务原子提交；提案确认保持独立事务实时复验。
- 知识索引完成必须匹配当前 index_attempt；知识权限列表不加载正文，仅按实际引用批量查询。权限授予规则统一归 MerchantPermissionEnumVO。
- 新增 V20261030_01，已有库须备份并显式迁移；旧进程锁版本与新版不能混跑。此次只操作临时测试库，没有升级业务库或替换运行服务。
- Maven Wrapper 3.9.9 隔离 clean verify 175 通过、0 跳过；HTTP 173、严格响应 117、真实浏览器 8、Python 42 通过。Docker NOT_RUN，远程模型/Milvus、性能与生产集群本次未验收。详见 [本轮报告](docs/testing/CODE-QUALITY-20261030.md)。

## CI 跨平台构建收尾（2026-10-30）

- UI 文本输入摘要与输出统一 LF，二进制保持原字节，路径使用规范相对路径排序。新增 `node --test frontend/tests/build-reproducibility.test.mjs` 已接入 CI，仍须运行 UI 快照完整比对。
- `a3fa07c` 远端生成检查失败，已从干净 Git 检出复现并修复；同轮独立 Docker/Compose 交易链路通过。后续远端结果与本地验收分开记录，见 [CI 收尾报告](docs/testing/CI-FOLLOWUP-20261030.md)。
