# SDD-13 · AI 流式协议与会话轮次运行状态

日期：2026-11-07。本文是 M3 4.6 的协议与状态基线；Java/Python 的实际增量执行、下游停止信号和前端事件消费分别在 4.7、4.8 交付。

## 入口与事件

- 现有 `POST /api/v1/ai/chat` 完整 JSON 入口保持不变。
- 流式入口使用同源 `POST /api/v1/ai/chat/stream`，沿用 Session Cookie、动态 CSRF 头、请求体上限和 AI 入口限流。流式入口属于独立协议，不混入 `Response<T>` JSON 生成器。
- 事件名冻结为 `started`、`progress`、`delta`、`completed`、`failed`、`cancel_requested`、`cancelled`。当前完整响应实现只发 `started` 与 `completed`/`failed`；只有下游实际产生的文本增量才能发 `delta`；完整响应模式必须标明 `mode=FULL_RESPONSE`，不能把已完成文本切片冒充实时输出。
- HTTP 鉴权、CSRF、限流、媒体类型和请求体错误在事件流开始前继续使用现有安全 JSON。事件流开始后只发安全错误码和终态，不回显下游异常正文、提示词或凭据。

## 轮次状态与取消

- `ai_conversation.turn_token` 仍是服务端 fencing token，租约保持 600 秒；新增 `turn_status`（`IDLE`、`RUNNING`、`CANCEL_REQUESTED`）和 `turn_cancel_requested_at`。
- `claimTurn` 以单条条件更新把状态置为 `RUNNING`；取消以当前用户、会话和仍有效的当前租约为条件，把状态置为 `CANCEL_REQUESTED`。状态查询只返回状态和取消时间，绝不返回租约令牌。
- `finishTurn` 只接受仍为 `RUNNING` 且令牌未过期的轮次；取消请求或旧轮次的迟到结果不能写消息、提案或成功终态。实际执行未结束前不能释放下游许可；执行器确认结束后再由后续版本清理租约。
- 跨 Java 实例通过 MySQL 读取同一状态。页面断线只表示客户端停止等待，不自动重发；恢复时读取原会话结果和当前状态。

## 事务与资源

远程模型调用期间不持有数据库事务或行锁。最终消息、引用和提案仍在短事务内一次性提交；部分输出没有交易执行权。事件发射使用有界缓冲和超时，慢客户端不能无限占用内存。

迁移 `V20261107_03__conversation_turn_runtime.sql` 只增列，必须在维护窗口经显式迁移工具执行，应用启动只读核验版本和校验和。
