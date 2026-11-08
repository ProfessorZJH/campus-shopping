# Proposal

## Why

产品化 M0～M6 已完成，ShoppingAI 的验收边界和交易不变量已经稳定；现在适合在真实行为基线仍清晰时收敛内部职责。`ShoppingAiCaseImpl` 同时承担会话编排、候选召回、商品/库存过滤和证据校验，修改成本与回归风险随之上升。

## What Changes

- 提取候选解析职责，集中处理词面/语义候选合并、SKU 采样、报价与库存读取、既有约束过滤，并复用现有领域策略。
- 提取证据组装职责，集中处理知识引用的授权、版本、区块、哈希和安全展示校验。
- 保留 `ShoppingAiCaseImpl` 的会话入口、600 秒轮次租约、SSE/取消竞态、知识指纹复验、短事务完成和幂等提交职责。
- 补充聚焦的 Java 回归测试与重构边界说明，确保 JSON、SSE、权限、价格、库存、提案和引用行为保持不变。
- 不修改 HTTP/DTO、数据库迁移、前端、Python AI 服务、Agent、交易规则或权限模型；不引入新的外部依赖。

## Capabilities

### New Capabilities

无。本次是行为保持型内部重构，不新增用户或下游可观察能力。

### Modified Capabilities

无。既有 API、SSE、会话、引用、提案、交易和权限要求继续由当前已接受规格约束。

本变更在 `.openspec.yaml` 中声明 `skip_specs: true`，因为实现只改变内部组织，不改变规格层行为。

## Impact

影响 `campus-shopping-case` 的 Java 内部实现、相关单元/契约回归测试及重构路线文档。接口契约、数据库结构、运行时配置、前端、Python 服务和部署拓扑不变；代码必须继续通过现有 API、DDD、静态和安全门禁。
