# M3：历史消息最小引用快照与读取复验（2026-11-07）

## 范围

本记录对应 `productize-campus-shopping-experience` 的任务 4.4。实现位于本地分支 `codex/productization-m3-conversations`，基于 `origin/main` 提交 `6f47a6c` 和 M3 提案商品身份检查点 `a3c9982`。未修改 Claude 正在使用的 `G:/develop/campus-shopping` 工作树，未执行合并、推送、迁移或部署。

## 实现结果

- 新增不可变迁移 `V20261107_02__message_citations.sql`：`ai_message.citation_recorded` 明确区分旧消息与新消息，`ai_message_citation` 按消息顺序保存文档 ID、根/版本、chunk 定位、标题和允许公开的片段。快照不保存受保护正文。
- AI 轮次在同一短事务中完成租约、用户/助手消息、最小引用快照和提案写入。引用先由 Java 按当前授权、发布/索引状态和正文片段复验；内部资料只保存固定安全标记，不能把模型原文写入历史。
- 历史读取按消息引用 ID 批量加载当前文档，再复验主体授权、撤稿、索引状态、根/版本及公开片段一致性。撤权或撤稿会遮蔽回答，版本或片段变化会隐藏来源；旧消息明确返回 `MISSING`，不会重新检索或拼接内部文档地址。
- HTTP 历史消息增加 `citations` 和 `citationStatus`（`AVAILABLE`、`NONE`、`MISSING`、`HIDDEN`），导购页面展示可核验片段及缺失/隐藏提示；生成副本与离线快照已同步。

## 定向验证

| 检查 | 结果 |
|---|---|
| `mvnw -pl campus-shopping-app -am -Dtest=ConversationActivityTest,AiConversationBoundaryTest,DddRulesTest,ProposalProductIdentityTest -Dsurefire.failIfNoSpecifiedTests=false -Dfrontend.skip=true test` | PASS，30 项，0 失败、0 错误、0 跳过；覆盖租约、批量引用复验、撤权/撤稿、版本变化、受保护片段、旧消息缺失和无快照拒绝落库 |
| `python scripts/verify-api-contract.py` | PASS，97 路由契约 |
| `python scripts/verify-api-schemas.py` | PASS，75 项 |
| `python scripts/schema_contract.py` 与 `python scripts/schema_contract.py --check` | PASS，迁移校验和与基线一致 |
| `python scripts/verify-release.py` | PASS，静态边界及拒绝样例 |
| `npm run format:check --prefix frontend` | PASS |
| `npm run typecheck --prefix frontend` | PASS |
| `python scripts/build-ui-bundle.py` 与 `python scripts/build-ui-bundle.py --check` | PASS，源码与生成副本一致 |
| `python frontend/tests/ui_list_pagination.py` | PASS，会话分页与摘要/时间 |
| `python frontend/tests/ui_guide_conversation.py` | PASS，6 项，含历史引用缺失提示 |
| `python frontend/tests/ui_three_pages.py` | PASS，23 项 |
| `python frontend/tests/contract_ui.py` | PASS，20 项 |
| `python frontend/tests/ui_rbac_regression.py` | PASS，14 项，含历史会话主体隔离 |

浏览器脚本产生的截图和结果文件均已恢复，不作为本批源码证据提交。

## 范围边界

本批未执行全量 Maven/CI、真实 MySQL/Redis、真实迁移升级或生产数据操作；迁移仅完成静态契约和单测验证。真实权限数据下的撤稿/撤权并发窗口、数据库执行计划和多实例验收留待后续整合批次。
