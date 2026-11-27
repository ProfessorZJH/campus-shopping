# 校园智能导购及商品交易平台（Campus Shopping）

> 基于 **DDD 六边形模块化单体 + 受控混合 RAG 智能导购** 构建的校园商品交易与智能导购全栈系统。交易事实（价格、库存、权限、订单、核销、退款）由 Java/MySQL 强一致裁决；Python 智能服务仅承担意图解析、混合检索与加购提案建议，不拥有任何交易写权限。

## 在线前端交互演示（GitHub Pages · 零后端直开）

正式版默认锁定为 **淘宝 2025 PC 消费端 + 阿里 Ant Design Pro / 千牛商家工作台**；其余 3 套消费端与 2 套后台大厂 1:1 复刻已完整归档并发布至 `gh-pages` 演示分支（在 GitHub 仓库 `Settings -> Pages` 选择 `gh-pages / (root)` 即可开启）：

- **交互演示画廊（4 套消费端 × 3 套后台总览）**：`https://professorzjh.github.io/campus-shopping/gallery.html`
- **默认正式视觉（淘宝 2025 PC + 阿里千牛）**：`https://professorzjh.github.io/campus-shopping/`
- **其他大厂复刻直达**：[京东 PC 版](https://professorzjh.github.io/campus-shopping/?ct=jd#/) · [小米有品 PC](https://professorzjh.github.io/campus-shopping/?ct=youpin#/) · [小红书 Web](https://professorzjh.github.io/campus-shopping/?ct=xiaohongshu#/) · [字节 Arco Pro 后台](https://professorzjh.github.io/campus-shopping/?at=arco#/merchant) · [美团商家版后台](https://professorzjh.github.io/campus-shopping/?at=meituan#/merchant)
- **本地重新生成演示站**：`python scripts/build-demo-pages.py --out var/verify/gh-pages-site`

## 1. 核心架构与工程规模

- **后端（Java 17 / Spring Boot 3.4.3 / MyBatis 3.0.4 / Redisson 4.8.0）**：
  - 遵循小傅哥 DDD 七模块分层：`campus-shopping-types`（公共类型与错误码）、`api`（契约接口与 DTO）、`domain`（7 大限界上下文业务规则、聚合、仓储与窄 Port）、`case`（跨领域事务编排与锁序控制）、`infrastructure`（MyBatis 数据访问、Redis 协调与外部 HTTP/七牛适配）、`trigger`（HTTP Controller、独立 SSE 端点与定时任务）、`app`（启动装配与生产安全守卫）。
  - **数据与接口规模**：`44` 张 MySQL 业务与治理表、`20` 个不可变版本迁移脚本（启动只读校验结构指纹与校验和，显式维护窗口迁移）、`102` 条自动生成并双向校验的 JSON HTTP 路由 + 独立 AI SSE 流式路由（`/api/v1/ai/chat/stream`）。
- **智能导购与检索服务（`ai-service/` · Python 3.11 / FastAPI）**：
  - **全量公开商品混合召回**：MySQL 全表上架商品词面加权召回（Top 200） + 可选 Milvus 全目录语义向量召回（Top 80，经 Java MySQL 实时复验状态） + 两级 RRF（$k=60$）融合 + 跨商品 SKU 轮询采样与规格/预算/数量硬约束过滤。
  - **四重知识安全护栏**：知识库可见性/外发双白名单（内部资料默认本地 256 维哈希向量入 SQLite，不外发外部模型）、PII 自动脱敏、Java 侧调用前后三次权限快照指纹复核（防 TOCTOU 越权泄漏）、基于 `turn_token` 600 秒会话租约与 `Propagation.NEVER` 的零数据库锁长调用。
- **同源三端前端（`frontend/` · Vue 3 + Vite + TypeScript 渐进类型）**：
  - 零第三方运行时 UI/路由重依赖，内置五维身份与商户代次隔离（Epoch Fencing）防异步串号、带内存上限的 SSE 流式解析与断线轮询恢复，完整覆盖**消费者端、商户工作台（含自定义角色 RBAC）、平台管理端及 RAG 检索调试台**共 13 个核心视图（另保留早期 `/legacy.html` 兼容入口与 `/?demo=1#/` 纯前端视觉预览模式）。

## 2. 已实现的核心业务闭环

| 端侧 / 领域 | 核心能力 |
|---|---|
| **消费者端** | 注册/会话登录（CSRF 保护）、公开商品多维搜索与全局排序、多规格详情与多图展示、按商户购物车、幂等结算锁库、15 分钟超时关单、模拟支付、自提动态令牌签发、未提货整单退款与争议申诉、AI 流式导购问答与提案勾选确认加购 |
| **商户工作台** | 入驻资料提交与幂等开通、门店设置、商品/多 SKU/多图（LOCAL 或七牛云）管理、补货与低可售库存预警、库存流水追踪、订单备货与自提令牌核销、售后审核、店员邀请撤销与 15 项细粒度自定义角色 RBAC、商户公开/内部知识库管理 |
| **平台监管端** | 受控管理员引导、商户入驻审核（同事务开通商户/首店/Owner）、商户启停监管、违规商品强制下架、全局类目维护、争议退款平台裁决、全站经营数据与趋势统计、平台知识库与只读 RAG 命中调试 |

> **明确边界说明**：当前所有支付、退款均为校内交易状态模拟，不涉及真实资金清结算；支持多 Java 实例共享同一 MySQL/Redis 连接单 Python 服务；120 例评测数据集仍待最终人工复核冻结（`DRAFT`），外部云模型连通性、生产高可用与极限容量压测按独立验收报告管理。

## 3. 快速导航入口

- **毕业设计与答辩专区**：[毕设全周期总控台](docs/thesis/README.md) · [开题答辩攻略与讲稿](docs/thesis/01-OPENING-DEFENSE-GUIDE.md) · [论文六章写作蓝图](docs/thesis/02-THESIS-CHAPTER-BLUEPRINT.md) · [系统图表与44表/102路由速查手册](docs/thesis/03-ARCHITECTURE-AND-DATA-MANUAL.md) · [评测实验SOP与终期答辩Q&A](docs/thesis/04-EXPERIMENT-AND-FINAL-DEFENSE-QA.md)
- **权威工程与规格索引**：[当前文档入口](docs/README.md) · [当前状态与剩余工作](docs/ROADMAP.md) · [AI 协作与工程约束](AGENTS.md) · [开发与门禁流程](docs/development/AI-WORKFLOW.md) · [架构决策记录 ADR](docs/architecture/decisions.md)
- **接口、数据与运维手册**：[HTTP 接口文档](docs/api/http-api.md) · [OpenAPI 规范](docs/api/openapi.json) · [行为契约](docs/api/behavior-v1.1.md) · [AI 流式协议](docs/api/streaming.md) · [数据库模型](docs/database/logical-data-model.md) · [R1 运行手册](docs/operations/R1-runbook.md) · [Redis 运行手册](docs/operations/REDIS-12-runbook.md) · [智能导购评测说明](ai-service/evaluation/README.md)

## 4. 本地构建、启动与验证

### 4.1 容器化一键体验（需 Docker Engine + Compose）

```bash
python scripts/dev-up.py
# 待容器健康检查就绪后，可执行真实跨服务 HTTP 验收
python scripts/smoke-full.py
```

首次运行自动在本地未追踪的 `.env` 中生成随机数据库、Redis、服务间密钥与初始管理员凭据（请勿提交或截图 `.env`），默认仅绑定本机 `http://127.0.0.1:8091/#/`。

### 4.2 源码构建与常用质量门禁（JDK 17 / Node 22.16.0 / Python 3.11）

```bash
# 前端与 Java 格式、TS 类型、前端单测与 UI 产物一致性检查
npm run format:check --prefix frontend
npm run typecheck --prefix frontend
npm test --prefix frontend
python scripts/build-ui-bundle.py --check

# 数据库迁移契约、API 契约、Mapper 全表扫描与 DDD 边界静态门禁
python scripts/schema_contract.py --check
python scripts/verify-api-contract.py
python scripts/verify-api-schemas.py
python scripts/verify-mapper-scan.py
python scripts/verify-release.py
python scripts/verify-domain.py

# Python 智能导购服务测试与离线评测
cd ai-service && python -m pytest -q
python ai-service/evaluate.py --dataset campus-shopping-v1 --split smoke --profile local

# Java 全模块构建与测试（完整集成测试需按开发流程配置隔离 MySQL/Redis）
./mvnw clean verify
```
