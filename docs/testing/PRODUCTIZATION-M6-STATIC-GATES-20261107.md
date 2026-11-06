# M6.7.1 源码与契约门禁定向验证（2026-11-07）

## 本轮修复

- 为 `CatalogQueryCaseImpl` 显式补齐库存查询兼容重载，满足源码接口实现门禁。
- 将订单待办查询读取 `ful_pickup_task` 登记为受控只读投影，并在交易领域使用本地状态白名单校验，保持领域依赖方向。

## 验证

| 命令 | 结果 |
|---|---|
| `./mvnw -q -pl campus-shopping-app -am '-DskipTests' '-Dfrontend.skip=true' compile` | 通过 |
| `python scripts/verify-release.py` | PASS，源码/接口/DDL/Mapper 门禁通过 |
| `python scripts/verify-api-contract.py` | PASS |
| `python scripts/verify-api-schemas.py` | PASS，75 项 |
| `python scripts/build-ui-bundle.py --check` | 通过 |
| `./mvnw -q -pl campus-shopping-app -am '-Dtest=OrderBatchQueryTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dfrontend.skip=true' test` | 通过 |

此项只覆盖源码与定向测试。随后隔离整合已完成 5.8、6.4，证据见 [M4/M5 真实隔离整合验收](PRODUCTIZATION-M4-M5-INTEGRATION-20261107.md)；4.9 仍缺该版本 CI、真实供应商效果和流式断网矩阵，7.2/7.3/7.4 仍待最终收口。
