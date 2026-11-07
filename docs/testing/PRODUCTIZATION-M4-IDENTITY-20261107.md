# M4.4 账号、入驻、成员与角色工作区实施记录

日期：2026-11-07。对应 OpenSpec 任务 5.4；本轮针对现有能力执行定向回归。

## 已确认

- 账号登录、禁用账户拒绝和会话失效由服务端处理；入驻申请与邀请接受使用幂等写入和当前身份快照。
- 商户成员列表、邀请、撤权和自定义角色均以商户范围授权，Owner 独占角色管理与成员变更；前端按权限展示工作区，但服务端仍是最终授权点。
- 角色权限依赖和受保护权限由领域枚举与 RoleService 校验，跨商户同名角色不会串租户。

## 定向验证

- `./mvnw -pl campus-shopping-app -am "-Dtest=RoleListBatchTest,RolePermissionContractTest,UserAccountAuthenticationTest,SessionAuthenticationIntegrationTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-Dfrontend.skip=true" test`：37 项通过。
- `node --test frontend/tests/identity-races.test.mjs frontend/tests/api-timeout.test.mjs`：5 项通过。

## 未在本轮宣称

`frontend/tests/ui_permission_correctness.py` 仍在既有平台争议筛选断言处失败（当前页面请求未带 `state`）；真实多商户浏览器联调和撤权后的全链路访问留待 5.8/M6。
