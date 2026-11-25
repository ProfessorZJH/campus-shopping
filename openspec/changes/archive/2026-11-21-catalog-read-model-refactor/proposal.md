# Proposal

## Why

Catalog 查询返回的 `ProductReadModel` 当前直接持有可变的 `ProductAggregate`，使查询响应、ShoppingAI 展示和交易写入对象共享同一边界，后续任何查询适配都容易误触领域状态。现在将读模型收窄为不可变商品/SKU 展示快照，可以在不改变 HTTP/DTO 和交易事实校验的前提下明确读写责任。

## What Changes

- 为 Catalog 读模型增加不可变的商品与 SKU 快照类型，快照只包含展示所需的商品、SKU 和版本字段。
- 为 Catalog 查询用例引入只读服务端口，隔离商品写入、AI 召回和锁定报价能力；现有实现继续复用同一个 Catalog 服务 Bean。
- 在 `ProductAggregate` 到 `ProductReadModel` 的转换边界复制商品和 SKU 数据，并复制库存展示映射与图片列表，避免向查询调用方泄漏可变聚合。
- 修改 API 视图适配和相关测试，使查询响应继续保持现有字段、排序、库存展示和报价版本语义。
- 保留 Catalog 写用例内部对 `ProductAggregate` 的使用、同库事务、权限检查、库存读取和幂等语义；本次不改 HTTP 契约、数据库表、迁移或 Repository 查询接口。
- **不新增**通用 CQRS 框架或全量 Repository 重写；本批次只收窄 Case 依赖，后续只有在测量证明需要时才继续下沉查询行快照。

## Capabilities

### New Capabilities

无。本次为不改变外部行为的内部边界重构，`.openspec.yaml` 使用 `skip_specs: true`。

### Modified Capabilities

无。现有 Catalog/API 行为契约保持不变。

## Impact

- 影响 `campus-shopping-case` 的 Catalog 读模型、查询用例和 API 视图适配，以及 `campus-shopping-app` 中依赖读模型的单元测试。
- 不新增依赖，不修改 API/DTO、MySQL/Redis/Milvus、权限规则或数据库迁移。
- 运行时仍由 Java/MySQL 负责价格、库存、权限和成交事实；快照只用于查询展示和建议输入。
