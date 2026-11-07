# M6.7.1 源码与契约门禁定向验证（2026-11-07）

## 本轮修复

- 为 `CatalogQueryCaseImpl` 显式补齐库存查询兼容重载，满足源码接口实现门禁。
- 将订单待办查询读取 `ful_pickup_task` 登记为受控只读投影，并在交易领域使用本地状态白名单校验，保持领域依赖方向。

## 验证

| 命令 | 结果 |
|---|---|
| `./mvnw -q -pl campus-shopping-app -am '-DskipTests' '-Dfrontend.skip=true' compile` | 通过 |
| `python scripts/verify-release.py` | PASS，源码/接口/DDL/Mapper/DDD 边界门禁通过 |
| `python scripts/verify-api-contract.py` | PASS |
| `python scripts/verify-api-schemas.py` | PASS，75 项 |
| `python scripts/build-ui-bundle.py --check` | 通过 |
| `./mvnw -q -pl campus-shopping-app -am '-Dtest=OrderBatchQueryTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dfrontend.skip=true' test` | 通过 |

此项只覆盖源码与定向测试。随后隔离整合已完成 5.8、6.4；4.9、7.2、7.3 的最终证据见 [全链路产品化阶段状态](PRODUCTIZATION-FINAL-STATUS-20261107.md) 及 `evidence/frontend-live-final/results.json`。真实供应商效果、生产域名/数据/部署和性能结论仍未宣称通过。
