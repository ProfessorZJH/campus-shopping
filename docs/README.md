# 校园智能导购平台 · R1 文档索引

> 当前维护状态：2026-11-09。产品化 M0～M6 与结构重构均已在主线完成（100%）；PR #63 对应的远端 `Campus Shopping - Real Acceptance` workflow #325 已通过。Java/MySQL、真实Redis、HTTP和浏览器已有分阶段隔离验收；真实供应商效果、生产部署与性能仍按对应报告单独验收。历史阶段的NOT_RUN仅代表当时范围，新修改须以对应提交验收为准。

| 阅读目标 | 文档 |
|---|---|
| **前端统一第一批（2026-11-14）** | [基础视觉与公共交互验证](testing/FRONTEND-UNIFICATION-BATCH1-20261114.md)：设计变量、分页、状态反馈与隔离全栈结果 |
| **Git 整理与工作区复核（2026-11-14）** | [整理和验证记录](testing/GIT-INTEGRATION-20261114.md)：主线基线、遗留目录备份、工程改动与验证范围 |
| **工程门禁地基 Wave 0（2026-11-12）** | [实施与验证记录](testing/ENGINEERING-WAVE0-20261112.md)：门禁插件声明、domain 单测依赖、mapper 去重与扫描脚本；后附 WSL 恢复后的补充验证与剩余未验证范围 |
| **前端统一第二批（2026-11-14）** | [后台业务视图验证](testing/FRONTEND-UNIFICATION-BATCH2-20261114.md)：商户订单、库存、商品表单与平台审核 |
| **交互式代码地图** | [项目全景](code-map/project-overview/README.md) · [下单到模拟支付专题](code-map/order-payment/README.md)：源码基线、交互地图与更新方法 |
| **开发操作入口与AI流程** | [AGENTS](../AGENTS.md)、[AI开发流程](development/AI-WORKFLOW.md)、[前端开发与构建入口](development/FRONTEND.md)、[Java/DDD规范](development/JAVA-STYLE.md) |
| **PR与主线质量门禁** | [PR模板](../.github/pull_request_template.md)、[main保护与核验](development/REPOSITORY-GATES.md) |
| **Git cleanup and category icons (2026-11-11)** | [Branch/worktree cleanup and recovery](testing/GIT-CLEANUP-20261111.md), [Category icon verification](testing/CATEGORY-ICONS-20261111.md) |
| **R1 六批审查整改** | [增量约束](specs/SDD-R1-REMEDIATION-13.md)、[逐批状态与实际验证](testing/R1-REMEDIATION-20261031.md)、[容量与外发操作](operations/R1-capacity-egress.md)、[供应链与发布边界](operations/R1-release-governance.md) |
| **OpenSpec需求变更试用** | [安装、资料归属与使用](development/OPENSPEC.md)、[试点实际记录](testing/OPENSPEC-PILOT-20261031.md) |
| **全链路产品化与结构重构（2026-11-08）** | [沉淀版架构路线](architecture/PRODUCTIZATION-REFACTOR-BASELINE-20261108.md)、[最终状态](testing/PRODUCTIZATION-FINAL-STATUS-20261107.md)、[远端真实验收记录](testing/STRUCTURAL-REFACTOR-REMOTE-ACCEPTANCE-20261109.md)、[整体方案与阶段](../openspec/changes/productize-campus-shopping-experience/proposal.md)、[技术设计与审查追踪](../openspec/changes/productize-campus-shopping-experience/design.md)、[实施任务与验收](../openspec/changes/productize-campus-shopping-experience/tasks.md)、[M1 实施与验证记录](testing/PRODUCTIZATION-M1-20261105.md)、[M2 实施与验证记录](testing/PRODUCTIZATION-M2-20261106.md)、[M3 提案商品身份与 PR #49 衔接](testing/PRODUCTIZATION-M3-PR49-RECONCILIATION-20261107.md)、[M3 会话活动与稳定分页](testing/PRODUCTIZATION-M3-CONVERSATION-ACTIVITY-20261107.md)、[M3 历史消息最小引用快照](testing/PRODUCTIZATION-M3-HISTORICAL-CITATIONS-20261107.md)、[M3 提案确认与失败恢复](testing/PRODUCTIZATION-M3-PROPOSAL-CONFIRMATION-20261107.md)、[M3 轮次运行状态与取消契约](testing/PRODUCTIZATION-M3-TURN-RUNTIME-20261107.md)、[M3 流式供应商桥接阶段](testing/PRODUCTIZATION-M3-STREAMING-BRIDGE-20261107.md)、[M3 流式导购界面阶段](testing/PRODUCTIZATION-M3-STREAMING-UI-20261107.md)、[M3 流式体验最终阶段](testing/PRODUCTIZATION-M3-STREAMING-FINAL-20261107.md)、[M4.1 商户订单待办与履约筛选](testing/PRODUCTIZATION-M4-ORDER-WORK-QUEUE-20261107.md)、[M4.2 低可售库存与流水定位](testing/PRODUCTIZATION-M4-INVENTORY-20261107.md)、[M4.3 商品、SKU 与多图编辑](testing/PRODUCTIZATION-M4-CATALOG-20261107.md)；M0～M6 与结构重构均已完成（100%），远端隔离验收 workflow #325 已通过；保留 Vue 3 + Vite，逐步采用 `.vue` 并试点 TypeScript，覆盖消费者、AI、商户、平台及知识库 |
| **结构重构分支实施与验证（2026-11-08）** | [分支记录](testing/STRUCTURAL-REFACTOR-20261108.md)、[远端验收](testing/STRUCTURAL-REFACTOR-REMOTE-ACCEPTANCE-20261109.md)；ShoppingAI、Catalog、后台 Shell、Guide transport、Python Provider 和检索融合已整体完成（100%），已通过 PR #63 合入 `main`（`89e2981`） |
| **Agent v1.1 M0/M1（2026-11-09）** | [OpenSpec 提案](../openspec/changes/agent-v1-1/proposal.md)、[M0 契约矩阵](testing/AGENT-V1.1-M0-CONTRACT-MATRIX-20261109.md)、[M1 验收矩阵](testing/AGENT-V1.1-M1-ACCEPTANCE-MATRIX-20261109.md)、[实施与验证记录](testing/AGENT-V1.1-M1-20261109.md)；真实讯飞/NVIDIA 样本已记录，流式首轮故障、Milvus TLS 门禁和 Java 事实复验按报告保留为 `DEGRADED`/`NOT_RUN` |
| **Agent v1.1 M1 Milvus ProductIndex (2026-11-10)** | [ProductIndex acceptance](testing/AGENT-V1.1-M1-MILVUS-PRODUCT-INDEX-20261110.md); isolated real REST v2 collection lifecycle passed through the application path, while Java facts and full E2E remain open |
| **Agent v1.1 Milvus REST probe (2026-11-10)** | [REST lifecycle report](testing/AGENT-V1.1-MILVUS-REST-PROBE-20261110.md); isolated REST CRUD/search and cleanup passed, while gRPC/TLS 443 and full M1 acceptance remain blocked |
| **Agent v1.1 M1 follow-up (2026-11-10)** | [M1 follow-up](testing/AGENT-V1.1-M1-FOLLOWUP-20261110.md); real NVIDIA/XFYUN, Milvus-to-Java fact revalidation and the isolated Java/MySQL→Milvus→Uvicorn→LLM sample passed; quality/cost Gold baseline remains separate |
| **Agent v1.1 M1.4.4 real E2E (2026-11-10)** | [M1.4.4 report](testing/AGENT-V1.1-M1-4.4-20261110.md); temporary Java/MySQL, random Milvus collection and Uvicorn were cleaned up, with no cart/order/stock/payment writes |
| **Agent v1.1 M2 HTTP integration audit (2026-11-10)** | [HTTP audit](testing/AGENT-V1.1-M2-HTTP-INTEGRATION-AUDIT-20261110.md); the harness is read-only and remains `NOT_RUN` until a loopback Java service is available |
| **Agent v1.1 M2 Runtime Bridge (2026-11-10)** | [Runtime Bridge harness](testing/AGENT-V1.1-M2-RUNTIME-BRIDGE-20261110.md); protocol harness and sanitized evidence are recorded, current environment is `NOT_RUN` without an explicit test service key |
| **Agent v1.1 M3 消费者只读工具（2026-11-10）** | [M3 验收记录](testing/AGENT-V1.1-M3-CONSUMER-READONLY-20261110.md); Java/Python 合约与隔离测试通过，新工具默认关闭，真实 Java/MySQL/Runtime 外部链路按报告保持 `NOT_RUN` |
| **Agent v1.1 M2 Gateway（2026-11-09）** | [OpenSpec](../openspec/changes/agent-v1-1-m2-gateway/proposal.md)、[Java Gateway 实施与自动验证](testing/AGENT-V1.1-M2-GATEWAY-20261109.md)；真实 Python/Milvus/HTTP 联调仍待后续验收 |
| **Agent v1.1 Java/MySQL fact revalidation (2026-11-10)** | [Isolated verification](testing/AGENT-V1.1-JAVA-MYSQL-FACT-REVALIDATION-20261110.md); 406 Maven tests passed with 0 failures and 0 errors; Redis-only tests skipped without an explicit test instance |
| **FR-023 真实评测组合验收（2026-11-10）** | [本轮真实评测与隔离组合记录](testing/AI-EVALUATION-REAL-20261110.md)；自动化和真实依赖证据已补齐，120 条人工 Gold 与稳定真实 LLM 评测仍待收口 |
| **FR-023 智能导购评测** | [工具/指标/实验/复现](../ai-service/evaluation/README.md)、[120例草稿与人工标注](../ai-service/evaluation/datasets/campus-shopping-v1/README.md)、[最新审查修复与完整验收](testing/AI-SKU-REVIEW-20261031.md)、[前轮防御补强](testing/AI-SKU-DEFENSE-20261031.md)、[前轮规格过滤修复](testing/AI-SKU-CONSTRAINTS-20261031.md)、[前轮审查与原始失败](testing/AI-EVALUATION-REVIEW-20261031.md)、[历史实现验证](testing/AI-EVALUATION-20261031.md) |
| **当前 SDD-12 Redis 交付** | [规格与验收矩阵](specs/SDD-REDIS-12.md)、[主线整合实际验收](testing/REDIS-MAIN-INTEGRATION-20261031.md)、[配置、升级与回退](operations/REDIS-12-runbook.md) |
| **旧库升级基线与漂移审计（2026-11-10完整验收）** | [OpenSpec方案与任务](../openspec/changes/legacy-db-upgrade-baseline/proposal.md)、[真实历史库探针](testing/LEGACY-DB-UPGRADE-PROBE-20261105.md)、[P2复验报告](testing/LEGACY-DB-UPGRADE-BASELINE-20261106.md)、[完整验收报告](testing/LEGACY-DB-UPGRADE-BASELINE-20261110.md)、[完整隔离证据](testing/evidence/legacy-db-upgrade-baseline-final-20261110.json)；MySQL 8.0.31 与 Redis 双实例通过，8.0.16/8.4 未在本机执行 |
| **PR #11 审查收口** | [文档状态与Python资源容量修复、复现及65项回归](testing/REDIS-REVIEW-FOLLOWUP-20261031.md) |
| 前序代码与文档整改 | [DDD 对照结论](architecture/DDD-REFERENCE-DOC-AUDIT-20261030.md)、[最终修复与复验](testing/DDD-DOC-CLOSURE-20261030.md) |
| 本次交付什么、还缺什么 | [交付清单](DELIVERY-R1.md) |
| 当前冻结业务规则 | [R1实施规格](specs/RELEASE-01.md) |
| 原始产品需求 | [PRD](requirements/PRD.md) |
| 决策如何收敛 | [决策清单](requirements/open-questions.md)、[ADR](architecture/decisions.md) |
| 领域边界 | [业务架构](architecture/business-architecture.md)、[上下文映射](architecture/context-map.md) |
| **当前权威 HTTP 契约** | [99 条 JSON 路由与字段](api/http-api.md)、[OpenAPI JSON](api/openapi.json)、[行为约定](api/behavior-v1.1.md)、[错误码](api/error-codes.md)、[独立 AI SSE 协议](api/streaming.md) |
| **SDD-03 代码契约修复** | [实施规格](specs/SDD-API-CONTRACT-03.md)、[验证记录](testing/SDD-API-CONTRACT-03-VERIFICATION.md) |
| **SDD-04 本批缺陷修复（F01–F10）** | [修复规格](specs/SDD-REPAIR-04.md)、[验证记录](testing/SDD-REPAIR-04-VERIFICATION.md) |
| **SDD-05 商户自定义 RBAC + 全局排序** | [设计/权限矩阵](specs/SDD-RBAC-05.md)、[验证记录](testing/SDD-RBAC-05-VERIFICATION.md) |
| **SDD-07 AI 商品召回 + 讯飞兼容模型** | [召回规格与调用链](specs/SDD-AI-RECALL-07.md)、[验证计划](testing/SDD-AI-RECALL-07-VERIFICATION.md) |
| **UI-06 页面文案与移动端权限导航** | [前端设计约束](specs/UI-POLISH-06.md)、[实际浏览器验证](testing/UI-POLISH-06-VERIFICATION.md) |
| **商品图片与多图增量** | [第一阶段收尾（编辑兼容与逐文件失败）](testing/PRODUCT-IMAGES-PHASE1-COMPLETION-20261105.md)、[第二阶段 QINIU 实施与本地验证](testing/QINIU-IMAGES-PHASE2-20261105.md)、[第一轮真实联调（含本机 HTTP 测试例外）](testing/QINIU-IMAGES-LIVE-ROUND1-20261105.md)、[七牛图片配置](operations/QINIU-IMAGES.md)、[ADR-018 / ADR-019](architecture/decisions.md)、[修复前只读审计（历史）](testing/PRODUCT-IMAGES-PHASE-AUDIT-20261105.md)、[上传、权限、兼容及验收规则](specs/UI-PRODUCT-IMAGES.md)、[HTTP 行为契约](api/behavior-v1.1.md)、[两线整合与 `ab31f89` 前历史](testing/UI-PRODUCT-IMAGES-VERIFICATION.md)、[PR #50 局部验证与合并阻塞（历史）](testing/PR50-MULTI-IMAGE-REVIEW-20261103.md) |
| **SDD-09 契约、数据库、API 与异常专项审查** | [审查与修正记录](testing/CONTRACT-DATABASE-API-AUDIT-09.md)、[旧库升级说明](database/migrations/README.md) |
| **工程化收敛** | [八项修复、构建流程及实际验证](testing/ENGINEERING-10.md) |
| **DDD 枚举、异常及领域边界审查** | [问题、代码依据与实施顺序](architecture/DDD-REVIEW-20261029.md)、[隔离行为探针](testing/evidence/ddd-review-20261029.json) |
| **SDD-11 DDD 专项整改** | [领域与契约设计](specs/SDD-DDD-11.md)、[116 项 Java 及真实全栈验证](testing/DDD-REFACTOR-20261029.md) |
| **代码职责与并发修复（2026-10-30）** | [读模型、AI 租约、索引请求与 175 项 Java 验证](testing/CODE-QUALITY-20261030.md)、[跨平台 UI 构建与 CI 收尾](testing/CI-FOLLOWUP-20261030.md) |
| 数据库和升级 | [数据模型](database/logical-data-model.md) |
| 运行与验收 | [运行手册](operations/R1-runbook.md)、[验证证据](testing/R1-verification.md) |
| 需求追踪 | [FR追踪矩阵](TRACEABILITY.md)、[状态路线](ROADMAP.md) |
| AI模式与实际指标 | [检索设计](ai/rag-design.md)、[当前评测入口](../ai-service/evaluation/README.md)、[历史8例演示](testing/evidence/ai-retrieval-evaluation.json) |

七领域历史详细设计保留在`domains/`；与R1冲突时以R1规格、当前API和DDL为准。`tutorial/`和P1-01报告是历史教学/执行记录，不应被AI当成当前待开发清单。

项目根目录`AGENTS.md`负责开发约束，`xfg-ddd-skills`负责DDD工程习惯，用户上传的group-buy-market负责具体编码风格参考。代码正确性最终必须由真实构建、业务测试和验收证据支撑。
**开发接口以当前 `frontend/src/services/api.js` 与 Java Controller/DTO 为准。** 旧 `static/assets/app.js`、P1 教学草案、旧 SSE 描述只能作历史材料，禁止合并到当前 HTTP 契约中。接口契约代码变更后执行 `python scripts/generate-api-contract.py && python scripts/verify-api-contract.py`。

- [PR-A：退款裁决与商户状态幂等](testing/BUSINESS-FIXES-A-20261031.md)
- [PR-B：边界输入与异常契约](testing/BUSINESS-FIXES-B-20261031.md)

- [PR-C：查询职责收敛](testing/QUERY-C-20261101.md)
- [PR-D：角色批量查询与只读适配器](testing/QUERY-D-20261101.md)

- [购物车库存、SKU 独立上下架与并发整改](testing/CART-SKU-REMEDIATION-20261101.md)

- [PR #45 审查收尾：确定锁序与服务端增量加购](testing/PR45-LOCK-ADD-REVIEW-20261101.md)

- [Redis 缓存自愈、版本隔离与双实例专项整改](testing/REDIS-REMEDIATION-20261101.md)

- [前端正确性、知识库授权与成员撤销整改](testing/UI-PERMISSION-CORRECTIONS-20261101.md)
- [前端业务正确性、请求生命周期与页面状态整改](testing/UI-REMEDIATION-20261101.md)
- [MySQL 数据模型与 SQL 专项检查（2026-11-02）](testing/MYSQL-DATA-MODEL-SQL-AUDIT-20261102.md)
- [前端整改真实后端联调（用户指定单 Redis）](testing/UI-REMEDIATION-LIVE-20261101.md)
- [PR #48 审查修复：匿名后台登录与首页加载边界](testing/PR48-REVIEW-FOLLOWUP-20261101.md)
- [ShoppingAI / RAG 批次 A+B 实施记录](testing/SHOPPINGAI-RAG-CORRECTIONS-20261101.md)
- [分支实跑验证：Python / Java / 迁移基线（2026-11-04）](testing/BRANCH-VERIFY-20261104.md)
- [分支实跑复验：全量 Java 298 项与静态门禁（2026-11-05）](testing/BRANCH-VERIFY-20261105.md)
- [旧库升级形状探针：猜测夹具 vs git 固定发布（2026-11-05）](testing/LEGACY-DB-UPGRADE-PROBE-20261105.md)
- [M4.2 低可售库存与流水定位实施记录](testing/PRODUCTIZATION-M4-INVENTORY-20261107.md)
- [M4.4 账号、入驻、成员与角色工作区实施记录](testing/PRODUCTIZATION-M4-IDENTITY-20261107.md)
- [M4/M5 真实隔离整合验收](testing/PRODUCTIZATION-M4-M5-INTEGRATION-20261107.md)
- [全链路产品化阶段状态](testing/PRODUCTIZATION-FINAL-STATUS-20261107.md)
