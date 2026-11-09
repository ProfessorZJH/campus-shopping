# Tasks

## 1. 读模型边界

- [x] 1.1 新增不可变 `ProductSnapshot`，复制商品基础字段、版本和 SKU 列表，并提供只读访问器；通过编译检查确认快照字段和集合不依赖可变 `ProductAggregate`。
- [x] 1.2 将 `ProductReadModel` 首字段改为 `ProductSnapshot`，在 `from(ProductAggregate, ...)` 中复制商品/SKU、库存 Map 和图片列表；通过构造校验和不可变集合测试确认空值与库存覆盖规则保持不变。
- [x] 1.3 新增 `ICatalogReadService` 并让 `CatalogQueryCaseImpl` 只依赖该窄端口；通过编译和现有查询 Mock 确认 `ICatalogService` 仍可作为唯一实现注入。

## 2. 查询与响应适配

- [x] 2.1 修改 `ApiViews.product(...)` 使用快照生成现有 `ProductResponseDTO`；通过 API 视图测试确认字段、SKU 顺序、报价版本和可用库存值不变。
- [x] 2.2 保持 `CatalogQueryCaseImpl`、`CatalogCaseImpl` 的权限、事务和领域聚合职责不变，并更新受影响的测试辅助代码；通过源码检查确认写用例仍在原事务边界内。

## 3. 定向验证与交付

- [x] 3.1 运行 `CatalogCartReadModelTest`、`CatalogPageSkuBatchTest`、`DddRulesTest` 定向 Maven 测试，并运行 `campus-shopping-app` 编译；记录测试结果且不修改 API/数据库契约。
- [x] 3.2 运行 `openspec validate catalog-read-model-refactor --strict`、`git diff --check`，检查变更仅覆盖本次读模型边界并提交逻辑清晰的 Git commit。
