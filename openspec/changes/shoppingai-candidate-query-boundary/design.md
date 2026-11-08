# Design

## Context

See `proposal.md` for the motivation. 当前 `CandidateResolver` 使用 `ICatalogService.recall(...)`、`recallByIds(...)` 和 `availableOffers(...)`，其中前两项返回 `ProductAggregate`，但候选融合只需要商品 ID 和 ACTIVE SKU ID；报价和库存仍需分别由 Catalog/Inventory 事实服务取得。

## Goals / Non-Goals

**Goals:**

- 让候选解析依赖只读、窄能力，不持有商品写入和事务锁定接口。
- 用不可变商品候选快照承载 RRF 融合和 SKU 采样所需事实。
- 保持公开状态、商户 ACTIVE、ACTIVE SKU、报价版本、库存过滤、语义降级和候选顺序。

**Non-Goals:**

- 不把库存余额或商品完整展示字段塞入候选端口；报价继续复用现有只读 `SkuOfferVO`。
- 不修改 `ICatalogQueryRepository` SQL、向量索引同步、提案历史恢复或交易确认。
- 不改变 `ShoppingAiCaseImpl` 的租约、取消/SSE、知识指纹和 `turns.complete` 生命周期。

## Decisions

1. **新增 `ICatalogCandidateQuery` 与 `ProductCandidateSnapshot`。**
   端口提供候选召回、按 ID 公开复验和当前公开报价读取；前两项返回不可变快照，报价仍为已有 `SkuOfferVO`。快照包含 `productId` 与 ACTIVE SKU ID 列表。Catalog 实现内部可暂时复用现有 Repository 查询再映射，确保公开状态和商户状态复验仍在同一事实路径。备选方案是让 CandidateResolver 继续接收聚合，无法真正收窄边界；或把报价/库存也合入快照，会把候选端口变成宽查询。

2. **保留 `ICatalogService` 的兼容实现关系。**
   `CatalogServiceImpl` 同时实现现有服务和候选端口，避免新增 Spring Bean 或重复查询实现；候选端口只在 `CandidateResolver` 注入。其他需要商品标题、描述、规格或历史关联的链路继续使用原端口。

3. **在 Case 层完成候选融合，事实数据仍单独读取。**
   `CandidateResolver` 从快照取得商品 ID、ACTIVE SKU ID，继续调用 `availableOffers` 和 `inventory.stocks` 取得报价/库存，并按当前顺序过滤无库存、换一个和更便宜约束。候选快照不参与写入或确认交易。

## Risks / Trade-offs

- [Risk] 端口映射遗漏公开状态或商户状态 → 复用现有 `recall/recallByIds` 查询路径，并保留 semantic 撤回/停业集成回归。
- [Risk] 快照 SKU 顺序变化导致语义采样变化 → 使用领域返回顺序的 `List.copyOf`，并增加候选顺序表征测试。
- [Risk] 模拟服务/Mock 未实现新端口 → 让 `ICatalogService` 继承候选端口或在测试中显式提供同一 Mock，确保无新增 Bean。
- [Risk] 未来为索引同步复用候选端口而扩大字段 → 明确索引投影另立接口，不把标题/描述等字段加入候选快照。

## Migration Plan

1. 新增端口和快照，令 `CatalogServiceImpl` 实现并映射现有召回结果。
2. 修改 `CandidateResolver` 构造器、融合和 SKU 采样；补纯单测与 ShoppingAI 边界回归。
3. 如需回滚，回退本次 Java 提交；无数据库、缓存、索引迁移。

## Open Questions

无。索引投影和历史提案查询的窄接口留待独立变更，不影响本次边界。
