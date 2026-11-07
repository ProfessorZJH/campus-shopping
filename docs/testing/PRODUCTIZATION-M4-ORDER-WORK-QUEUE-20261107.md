# M4.1 商户订单待办与履约筛选实施记录

日期：2026-11-07。对应 OpenSpec 任务 5.1 的代码实施与定向验证；真实隔离后端联调不在本轮范围内。

## 已实现

- 商户订单分页接口新增可选 `pickupState` 查询参数，保留原有订单 `state`、`q`、分页参数。
- Java Case、领域查询服务、Repository、MyBatis 查询贯通该参数；列表 `items` 和 `total` 使用同一 `ful_pickup_task.status` 条件，避免页面局部过滤造成待办数量错误。
- 导购后台订单页增加全部、待备货、备货中、待核销、已核销筛选，并保留订单状态筛选、搜索和当前页；操作后按实际返回结果刷新，当前页失效时回到最后有效页。
- 订单行和详情展示付款临近/已超时、自提凭证过期等已有事实提醒，不推造履约历史。
- 同步 API 行为说明、交易领域文档、OpenAPI/路由契约和生成的 UI 静态副本。

## 定向验证

- `./mvnw -pl campus-shopping-app -am "-Dtest=OrderBatchQueryTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-Dfrontend.skip=true" test`：5 项通过。
- `./mvnw -pl campus-shopping-app -am "-DskipTests" "-Dfrontend.skip=true" compile`：编译通过。
- `npm run build --prefix frontend`、`npm run typecheck --prefix frontend`：通过。
- `npx prettier --config .prettierrc.json --check src/pages/MerchantOps.js`：通过。
- `python scripts/build-ui-bundle.py` 与 `--check`：通过。
- `python scripts/generate-api-contract.py`、`verify-api-contract.py`、`verify-api-schemas.py`：通过。
- 前端 Node 定向测试 28 项通过；`ui_r1_correctness.py` 13 项通过。

## 未在本轮宣称

未启动真实 MySQL/Redis、HTTP 或真实浏览器后端联调；M4.8 的隔离数据整体验收和 M3/M6 的整合门禁仍按任务表执行。已有 `ui_permission_correctness.py` 在当前基线的争议筛选断言失败（其默认 `DISPUTED` 筛选与现有页面默认空筛选不一致），与本次订单待办改动无关，未以跳过方式记为通过。
