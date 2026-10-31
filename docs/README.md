# 校园智能导购平台 · R1 文档索引

> 当前维护状态：2026-10-31。最新Redis共享会话及主线整合见[SDD-12验收](testing/REDIS-MAIN-INTEGRATION-20261031.md)，前序领域、契约整改见[2026-10-30报告](testing/DDD-DOC-CLOSURE-20261030.md)。Java/MySQL、真实Redis、HTTP和浏览器已有隔离验收，整合提交的[远端CI与实际镜像验收](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41161066987)通过；真实模型有独立历史证据，生产部署与性能尚未验收。历史阶段的NOT_RUN仅代表当时范围，新修改须以对应提交验收为准。

| 阅读目标 | 文档 |
|---|---|
| **开发操作入口与AI流程** | [AGENTS](../AGENTS.md)、[AI开发流程](development/AI-WORKFLOW.md)、[Java/DDD规范](development/JAVA-STYLE.md) |
| **PR与主线质量门禁** | [PR模板](../.github/pull_request_template.md)、[main保护与核验](development/REPOSITORY-GATES.md) |
| **R1 六批审查整改** | [增量约束](specs/SDD-R1-REMEDIATION-13.md)、[逐批状态与实际验证](testing/R1-REMEDIATION-20261031.md)、[容量与外发操作](operations/R1-capacity-egress.md) |
| **OpenSpec需求变更试用** | [安装、资料归属与使用](development/OPENSPEC.md)、[试点实际记录](testing/OPENSPEC-PILOT-20261031.md) |
| **FR-023 智能导购评测** | [工具/指标/实验/复现](../ai-service/evaluation/README.md)、[120例草稿与人工标注](../ai-service/evaluation/datasets/campus-shopping-v1/README.md)、[最新审查修复与完整验收](testing/AI-SKU-REVIEW-20261031.md)、[前轮防御补强](testing/AI-SKU-DEFENSE-20261031.md)、[前轮规格过滤修复](testing/AI-SKU-CONSTRAINTS-20261031.md)、[前轮审查与原始失败](testing/AI-EVALUATION-REVIEW-20261031.md)、[历史实现验证](testing/AI-EVALUATION-20261031.md) |
| **当前 SDD-12 Redis 交付** | [规格与验收矩阵](specs/SDD-REDIS-12.md)、[主线整合实际验收](testing/REDIS-MAIN-INTEGRATION-20261031.md)、[配置、升级与回退](operations/REDIS-12-runbook.md) |
| **PR #11 审查收口** | [文档状态与Python资源容量修复、复现及65项回归](testing/REDIS-REVIEW-FOLLOWUP-20261031.md) |
| 前序代码与文档整改 | [DDD 对照结论](architecture/DDD-REFERENCE-DOC-AUDIT-20261030.md)、[最终修复与复验](testing/DDD-DOC-CLOSURE-20261030.md) |
| 本次交付什么、还缺什么 | [交付清单](DELIVERY-R1.md) |
| 当前冻结业务规则 | [R1实施规格](specs/RELEASE-01.md) |
| 原始产品需求 | [PRD](requirements/PRD.md) |
| 决策如何收敛 | [决策清单](requirements/open-questions.md)、[ADR](architecture/decisions.md) |
| 领域边界 | [业务架构](architecture/business-architecture.md)、[上下文映射](architecture/context-map.md) |
| **当前权威 HTTP 契约** | [93 条路由与字段](api/http-api.md)、[OpenAPI JSON](api/openapi.json)、[行为约定](api/behavior-v1.1.md)、[错误码](api/error-codes.md) |
| **SDD-03 代码契约修复** | [实施规格](specs/SDD-API-CONTRACT-03.md)、[验证记录](testing/SDD-API-CONTRACT-03-VERIFICATION.md) |
| **SDD-04 本批缺陷修复（F01–F10）** | [修复规格](specs/SDD-REPAIR-04.md)、[验证记录](testing/SDD-REPAIR-04-VERIFICATION.md) |
| **SDD-05 商户自定义 RBAC + 全局排序** | [设计/权限矩阵](specs/SDD-RBAC-05.md)、[验证记录](testing/SDD-RBAC-05-VERIFICATION.md) |
| **SDD-07 AI 商品召回 + 讯飞兼容模型** | [召回规格与调用链](specs/SDD-AI-RECALL-07.md)、[验证计划](testing/SDD-AI-RECALL-07-VERIFICATION.md) |
| **UI-06 页面文案与移动端权限导航** | [前端设计约束](specs/UI-POLISH-06.md)、[实际浏览器验证](testing/UI-POLISH-06-VERIFICATION.md) |
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
