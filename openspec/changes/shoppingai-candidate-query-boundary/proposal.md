# Proposal

## Why

ShoppingAI 的 `CandidateResolver` 仍直接依赖包含商品写入、公开目录查询和交易锁定能力的 `ICatalogService`，导致 AI 候选链路的依赖面大于实际需要，也容易把领域聚合误带入建议流程。当前已经完成候选和证据拆分，正适合把“公开候选召回”收口为独立的只读端口，同时继续由 Java/MySQL 复验商品状态。

## What Changes

- 新增只读候选查询端口，提供词面公开召回和按语义商品 ID 的公开复验。
- 新增不可变 `ProductCandidateSnapshot`，只携带商品 ID 与当前 ACTIVE SKU ID 顺序。
- 修改 `CandidateResolver` 使用候选端口和快照完成 RRF 融合、SKU 采样与报价/库存读取；不改变候选排序、去重、降级和库存过滤语义。
- 保留 `ICatalogService` 供 Catalog 写用例、历史提案恢复、索引同步和交易报价使用；本次不改 HTTP/DTO、数据库、索引或 AI 引擎协议。

## Capabilities

### New Capabilities

无。本次为不改变外部行为的内部边界重构，`.openspec.yaml` 使用 `skip_specs: true`。

### Modified Capabilities

无。候选召回与 Java 事实复验行为保持不变。

## Impact

- 影响 `campus-shopping-domain` 的 Catalog 查询端口、`campus-shopping-case` 的 `CandidateResolver` 及其测试 Mock。
- 不新增依赖，不修改数据库/Redis/Milvus，不改变 600 秒会话租约、短事务提交、权限、库存和报价复验。
- 语义召回失败仍按当前 AI 不可用降级处理；候选端口不得绕过公开状态、商户 ACTIVE 和 ACTIVE SKU 复验。
