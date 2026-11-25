# Design

## Context

See `proposal.md` for the motivation. 当前 `ProductReadModel`、`CatalogQueryCaseImpl` 和 `CatalogCaseImpl` 都通过 `ProductReadModel.from(...)` 组装响应；查询用例原先直接依赖包含写入和 AI 能力的 `ICatalogService`。`ProductSkuEntity` 是不可变 record，适合直接复制到展示快照。

## Goals / Non-Goals

**Goals:**

- 让 Catalog 对外返回的商品数据不再暴露 `ProductAggregate`。
- 让 `CatalogQueryCaseImpl` 依赖只读 `ICatalogReadService`，避免查询用例静态依赖商品写入、AI 召回和锁定报价能力。
- 保持现有 `ProductReadModel`、HTTP DTO、库存展示、报价版本、权限和事务行为。
- 让转换边界集中负责深复制商品/SKU、库存映射和图片列表，便于 ShoppingAI 与查询端继续复用只读数据。

**Non-Goals:**

- 不改变 Catalog 的搜索算法、分页排序、Repository 接口或数据库结构。
- 不建立通用 CQRS、事件投影或新的缓存一致性机制。
- 不改变交易写入链路；写用例仍可在事务内使用领域聚合并完成现有权限和库存复验。

## Decisions

1. **使用 `ProductSnapshot` 作为 `ProductReadModel` 的首字段。**
   `ProductSnapshot` 采用不可变 record，保存商品基础字段、版本和 `List<ProductSkuEntity>` 的不可变副本，并提供与现有聚合读取方法一致的 `getXxx()` 只读访问器。这样既移除聚合类型依赖，又避免无关改动所有 DTO 和测试调用点。备选方案是直接在 `ProductReadModel` 中平铺字段，虽然更纯粹，但会扩大 API 视图和调用方改动面。

2. **保留 `ProductReadModel.from(ProductAggregate, ...)` 作为唯一转换入口。**
   查询和写用例可以继续在内部取得领域聚合，但离开 Case 边界前必须通过该工厂创建快照。工厂使用 `List.copyOf`、不可变 Map 和不可变图片列表，确保后续调用方无法改变源聚合或共享集合。备选方案是让 Repository 直接返回快照；这会同时重写宽接口和多个查询适配器，超出本批次边界。

3. **不修改公共 DTO 与 HTTP 契约。**
   `ApiViews.product(...)` 改为读取 `ProductSnapshot` 的只读访问器，生成的 JSON 字段、空值约束、SKU 顺序和 `quoteVersion` 继续沿用当前规则。这样可以将行为回归集中在现有 Catalog 测试，而无需重新生成 API 契约。

4. **交易写入仍以聚合为事实来源。**
   Catalog 写用例继续在同库事务中调用领域服务，完成权限、库存和状态复验；快照不参与写入或交易决策。这样不会改变锁顺序、幂等或撤权后的服务端复验。

5. **用继承兼容的 `ICatalogReadService` 收窄查询依赖。**
   `ICatalogService` 继承只读端口，`CatalogServiceImpl` 仍是唯一实现，因此现有 Spring 注入和测试 Mock 不需要新增 Bean。只读端口只包含查询用例实际调用的方法，不包含写入、AI 召回、索引扫描和锁定报价。备选方案是直接拆分实现类，会增加 Bean 选择与事务代理风险，当前没有必要。

## Risks / Trade-offs

- [Risk] 快照字段遗漏会造成 DTO 展示变化 → 以现有 `ApiViews` 字段和 Catalog 回归测试逐字段核对，并保留商品/SKU 版本字段。
- [Risk] 只复制顶层列表但仍共享可变集合 → 构造函数和工厂统一使用 `List.copyOf`、`Map.copyOf`，不返回聚合引用。
- [Risk] 兼容访问器掩盖了读写边界 → `ProductSnapshot` 只提供基础字段与不可变 SKU 列表，不提供任何聚合变更方法、仓储或领域服务引用。
- [Risk] 后续查询端继续依赖宽 `ICatalogService` → 本批次记录为后续测量项，不在没有收益证据时扩大为接口重写。
- [Risk] 只读端口与现有服务的继承关系被误解为新的业务能力 → 端口只收录 Catalog 查询用例实际调用的方法，继续由现有唯一 Catalog 服务实现。

## Migration Plan

1. 先新增 `ProductSnapshot` 和 `ICatalogReadService`，再改造 `ProductReadModel.from(...)`、查询 Case、`ApiViews` 和受影响测试。
2. 运行 Catalog 读模型和 SKU 批量查询的定向 Maven 测试及模块编译。
3. 若回滚，只需回退本次 Java 提交；不涉及数据库、缓存或外部接口迁移。

## Open Questions

无。查询端口是否继续细分可在后续有性能或依赖证据时单独立项，不影响本次实现。
