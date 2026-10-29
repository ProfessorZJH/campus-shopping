# 校园智能导购及商品交易平台 · R1 交付候选版

> **这是完整业务范围的源码候选版，不是“全栈已跑通”的验收版。** 本次已执行纯 Java 领域/HTTP、Python 检索服务和真实 Chromium 的接口替身测试；完整 Maven 构建、Spring/MySQL、Docker、真实模型及 Qdrant 尚未验证，具体证据见下文。

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
- `mvn clean verify`、`scripts/smoke-full.py`、`frontend/tests/live_ui.py`：真实全栈验收入口，**本次未执行成功**，需要依赖和MySQL环境。

## 工程目录

`api` 定义接口/DTO；`trigger` 实现HTTP入口；`case` 编排跨域事务；`domain` 维护业务模型与仓储/远程Port接口；`infrastructure` 实现MyBatis和Python HTTP网关；`app` 启动与安全配置；`types` 公共业务错误。`frontend/` 为可编辑模板和浏览器测试，`ai-service/` 为Python服务。

保留中文业务注释、AppException/ResponseCode、Controller内捕获；不增加远程密码Port或全局业务异常处理器。历史教学代码和教程不再作为当前运行步骤，以上R1规格为准。

## SDD-08：NVIDIA Embedding + Milvus 商品混合召回（2026-10-29）

增加可选独立 Milvus 商品索引（非取代 MySQL 商品事实源），采用 MySQL 词面召回 + Milvus 语义召回 + RRF 融合；Python 对候选同时做 BM25 与语义 RRF。Java 默认关闭的增量同步任务负责将公开商品及活动规格分批索引，不保存实时价格/库存至向量库。Milvus 故障降级关键词召回；跨商户和权限仍按 MySQL 验证。不得使用公网明文 HTTP 传送 root 凭据。

- [SDD-08 设计/内网契约/安全/验收](docs/specs/SDD-AI-HYBRID-08.md)
- [SDD-08 验证记录](docs/testing/SDD-AI-HYBRID-08-VERIFICATION.md)
- 需安全设置 `MILVUS_URI`、`MILVUS_TOKEN`、`EMBEDDING_BASE_URL`、`EMBEDDING_API_KEY`、`EMBEDDING_MODEL`；`AI_PRODUCT_VECTOR_SYNC_ENABLED=true` 才进行索引同步。
- 启动后可 `docker compose exec ai python -m app.smoke_vector` 进行只读连通测试。**本次未运行真实 Milvus 或模型。**
