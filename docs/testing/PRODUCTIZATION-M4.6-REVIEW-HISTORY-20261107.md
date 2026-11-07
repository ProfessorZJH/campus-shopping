# M4.6 审核与监管历史定向验证（2026-11-07）

## 已确认范围

- 入驻审核、商户监管和平台退款裁决均通过同库事务写入 `sys_audit`，动作成功后才产生历史。
- 重复审批、重复裁决和并发裁决沿用现有状态机与幂等约束，不重复开通、退款或写入同一决定。
- 商户、平台和消费者读取历史时继续经过对象关系与当前角色复验；缺失历史字段不由当前用户或读取时间补造。
- 平台争议详情复用订单、履约和售后事件，前序商户决定与平台最终裁决分别保留。

## 定向验证

| 命令 | 结果 |
|---|---|
| `./mvnw -q -pl campus-shopping-app -am '-Dtest=MerchantApplicationServiceTest,MerchantApplicationApiContractTest,AfterSaleAggregateTest,DddRulesTest,RolePermissionContractTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dfrontend.skip=true' test` | 44 tests / 0 failures / 0 errors / 0 skipped |

本轮未执行真实 MySQL/Redis；已有隔离数据库用例覆盖更完整的审计回滚矩阵，留待 M4.8/M6 整合验收。
