# M3 轮次运行状态与取消契约报告

日期：2026-11-07。对应 OpenSpec `productize-campus-shopping-experience` 任务 4.6。

## 本轮完成

- 新增 `V20261107_03__conversation_turn_runtime.sql`，为 `ai_conversation` 增加 `turn_status` 和 `turn_cancel_requested_at`；同步新库 schema、Docker schema 和数据库清单。
- `claimTurn` 标记 `RUNNING`，取消请求以当前有效租约为条件标记 `CANCEL_REQUESTED`；`finishTurn` 只允许未过期且仍为 `RUNNING` 的 fencing token，迟到或取消轮次不能提交消息、引用或提案。
- 增加本人会话状态查询与取消请求接口。状态响应不返回 `turn_token`；取消入口沿用登录、CSRF、请求体限制和 AI 用户/全局限流。
- 增加独立 `POST /api/v1/ai/chat/stream` SSE 入口：当前供应商以 `FULL_RESPONSE` 模式发送 `started` 与 `completed`/`failed`，不切片伪造 `delta`；实际 Python 增量、下游停止和前端事件消费不在本轮宣称完成。

## 定向验证

| 命令 | 结果 |
|---|---|
| `./mvnw -pl campus-shopping-app -am "-Dtest=AiConversationBoundaryTest,ConversationActivityTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-Dfrontend.skip=true" test` | 13 tests passed, 0 failed/error/skipped |
| `python scripts/schema_contract.py` | 通过 |
| `python scripts/generate-api-contract.py` | 99 routes generated |
| `python scripts/verify-api-contract.py` | 通过 |
| `python scripts/verify-api-schemas.py` | 75 checks passed |

| `python -c "import xml.etree.ElementTree as ET; ET.parse('campus-shopping-app/src/main/resources/mybatis/mapper/iaidao_mapper.xml')"` | Mapper XML 解析通过 |

未执行全量 Maven、真实 MySQL/Redis、Python 真实供应商流式、HTTP SSE 或浏览器流式验收；这些属于 4.7–4.9 的适用范围。未运行环境不得记为通过。
