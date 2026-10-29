# 校园智能导购平台 · R1 文档索引

> 源码候选版，2026-10-28。规格、代码和实际验证三种状态分开；没有宣布全栈验收或部署成功。

| 阅读目标 | 文档 |
|---|---|
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
| **代码职责与并发修复（2026-10-30）** | [读模型、AI 租约、索引请求与 175 项 Java 验证](testing/CODE-QUALITY-20261030.md) |
| 数据库和升级 | [数据模型](database/logical-data-model.md) |
| 运行与验收 | [运行手册](operations/R1-runbook.md)、[验证证据](testing/R1-verification.md) |
| 需求追踪 | [FR追踪矩阵](TRACEABILITY.md)、[状态路线](ROADMAP.md) |
| AI模式与实际指标 | [检索设计](ai/rag-design.md)、[评测报告](testing/evidence/ai-retrieval-evaluation.json) |

七领域历史详细设计保留在`domains/`；与R1冲突时以R1规格、当前API和DDL为准。`tutorial/`和P1-01报告是历史教学/执行记录，不应被AI当成当前待开发清单。

项目根目录`AGENTS.md`负责开发约束，`xfg-ddd-skills`负责DDD工程习惯，用户上传的group-buy-market负责具体编码风格参考。代码正确性最终必须由真实构建、业务测试和验收证据支撑。
**开发接口以当前 `frontend/src/services/api.js` 与 Java Controller/DTO 为准。** 旧 `static/assets/app.js`、P1 教学草案、旧 SSE 描述只能作历史材料，禁止合并到当前 HTTP 契约中。接口契约代码变更后执行 `python scripts/generate-api-contract.py && python scripts/verify-api-contract.py`。
