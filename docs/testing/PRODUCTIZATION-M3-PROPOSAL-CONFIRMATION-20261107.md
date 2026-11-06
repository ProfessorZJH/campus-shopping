# M3 提案确认与失败恢复实施记录

日期：2026-11-07

## 本批范围

本批落实 OpenSpec 任务 4.5 的提案确认体验，继续使用现有完整 JSON 接口，不引入 SSE、数据库迁移或新的确认接口。

- `Guide.js` 将确认请求绑定到当前账号、会话代次和提案 ID。迟到的确认或放弃响应不能写入新会话、新账号或另一份提案。
- 价格/版本变化、下架、缺货、过期、状态冲突和确认结果未知均有明确的恢复文案。失败时保留用户的勾选，不把失败请求显示为已确认；网络结果未知时提示沿用相同选择重试。
- 确认进行中按钮显示“确认中…”，继续阻止重复确认；服务端既有事务、价格版本复验、库存复验和同选择幂等逻辑未改动。
- 领域单测覆盖重复选择、提案外 SKU、过期、同选择重放和不同选择冲突。

## 实际验证

以下均在当前分支 `codex/productization-m3-conversations` 执行：

| 检查 | 结果 |
| --- | --- |
| `mvnw -pl campus-shopping-app -am "-Dtest=AiConversationBoundaryTest,ProposalProductIdentityTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-Dfrontend.skip=true" test` | 12 tests，0 failures，0 errors，0 skipped |
| `npm run format:check --prefix frontend` | 通过 |
| `npm run typecheck --prefix frontend` | 通过 |
| `python scripts/build-ui-bundle.py` + `--check` | 通过，源码与静态副本一致 |
| `python frontend/tests/ui_guide_conversation.py` | 8 项通过，包含变价拒绝后保留勾选、允许重试，以及放弃提案后恢复新对话 |
| `python frontend/tests/ui_three_pages.py` | 23 项通过 |
| `git diff --check` | 通过 |

本轮没有配置 `MYSQL_TEST_URL`，未重复启动真实 MySQL/Redis 或全量 Maven/浏览器验收；事务原子性继续由现有 `ShoppingEvaluationSafetyMySqlTest` 代码路径约束，完整真实环境复验归入 M3 的 4.9 整合验收。未执行推送、合并或部署。
