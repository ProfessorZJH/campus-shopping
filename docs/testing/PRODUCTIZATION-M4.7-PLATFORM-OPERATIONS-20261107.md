# M4.7 平台运营工作区定向验证（2026-11-07）

## 已实现范围

- 平台工作区提供入驻申请筛选与审核、商户监管、商品监管、订单筛选、争议详情与裁决反馈。
- 争议页默认进入 `DISPUTED` 待裁决范围，详情先加载订单/售后事件历史，再执行平台决定；操作后刷新当前列表。
- 平台与商户页面继续使用服务端分页、权限和状态复验，前端只负责展示和请求编排。

## 定向验证

| 命令 | 结果 |
|---|---|
| `python frontend/tests/ui_permission_correctness.py` | PASS，10 个场景通过 |
| `./mvnw -q -pl campus-shopping-app -am '-Dtest=MerchantApplicationServiceTest,MerchantApplicationApiContractTest,AfterSaleAggregateTest,DddRulesTest,RolePermissionContractTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dfrontend.skip=true' test` | 44 tests / 0 failures / 0 errors / 0 skipped |
| `python scripts/build-ui-bundle.py` | 通过，离线静态副本同步 |

真实隔离后端、三端浏览器矩阵和跨商户数据仍属于 M4.8/M6，不在本轮宣称完成。
