# M4.5 统计看板定向验证（2026-11-07）

## 已实现范围

- 新增 `/api/v1/merchants/{merchantId}/statistics/operations` 与 `/api/v1/admin/statistics/operations`，旧 `statistics` 接口保持兼容。
- `periodDays` 仅接受 7/30；`to` 可选，服务端按 `Asia/Shanghai` 计算左闭右开区间，并返回 `periodStart`、`periodEnd`、`timezone`、`asOf`。
- 统计结果由只读 DAO/Repository/Case 聚合：创建日趋势、查询时状态分布、已完成订单商品表现、成功模拟支付订单口径的整单退款率；零分母返回 null。
- MerchantOps 看板改用专用接口，展示期间、截至时间、趋势、状态、商品、成功支付/退款及退款率。

## 定向验证

| 命令 | 结果 |
|---|---|
| `./mvnw -pl campus-shopping-app -am -Dtest=OperationsStatisticsCaseTest -Dsurefire.failIfNoSpecifiedTests=false -Dfrontend.skip=true test` | 通过，2 tests / 0 failures / 0 errors / 0 skipped |
| `./mvnw -pl campus-shopping-app -am -DskipTests -Dfrontend.skip=true compile` | 通过，8 模块编译成功 |

本轮未执行真实 MySQL/Redis 联调；SQL 仅完成静态编译与映射检查，退款跨期和执行计划需在隔离数据环境按任务 5.5 的验收范围补测。
