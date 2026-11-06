# M4.2 低可售库存与流水定位实施记录

日期：2026-11-07。对应 OpenSpec 任务 5.2；本轮按开发阶段执行定向验证，未宣称真实 MySQL/HTTP 整体验收。

## 已实现

- 商户库存分页接口增加可选 `availableBelow`，服务端按 `onHand-reserved <= threshold` 过滤，`items` 与 `total` 共用同一条件；阈值允许 0，拒绝负数和过大输入。
- 库存流水分页接口增加 `q`，仅在当前商户范围内匹配 `skuId` 或 `bizKey`，按 `created_at DESC,id ASC` 稳定分页并保持列表/COUNT 条件一致。
- 商户后台增加“全部库存/低可售”筛选、阈值输入、流水搜索和独立流水翻页，展示实物、预占、可售三量及业务单据键；补货仍复用既有幂等写入口。
- 同步 OpenAPI、路由清单、HTTP 行为说明、库存领域文档和生成静态 UI 副本。

## 定向验证

- `./mvnw -pl campus-shopping-app -am "-Dtest=CatalogCartReadModelTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-Dfrontend.skip=true" test`：14 项通过，包含阈值透传与总数条件测试。
- `./mvnw -pl campus-shopping-app -am "-DskipTests" "-Dfrontend.skip=true" compile`：通过。
- `npm run build --prefix frontend`、`npm run typecheck --prefix frontend`：通过。
- `npx prettier --config .prettierrc.json --check src/pages/MerchantOps.js`：通过。
- `python scripts/build-ui-bundle.py` 与 `--check`：通过。
- `python scripts/generate-api-contract.py`、`verify-api-contract.py`、`verify-api-schemas.py`：通过。

## 未在本轮宣称

真实 MySQL 数据下的跨商户隔离、阈值边界和多页稳定性仍留待 M4.8 隔离验收；本轮没有执行全量 Maven 或 Redis 验收。
