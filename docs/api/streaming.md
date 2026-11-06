# AI SSE 独立协议

`POST /api/v1/ai/chat/stream` 是独立的 `text/event-stream` 入口，不纳入普通 `Response<T>` 路由生成。它仍要求登录、同源 Session Cookie、CSRF 头和 `ChatRequestDTO` JSON，并共享 AI 用户/全局限流。

当前 Java 入口支持完整响应模式：

- `started`：表示已接受轮次，`mode` 为 `FULL_RESPONSE`。
- `completed`：`data` 为现有 `ChatResponseDTO`；不会把完整文本拆成伪 `delta`。
- `failed`：只返回安全的 `errorCode`，不回显下游正文、提示词或凭据。

`progress`、`delta`、`cancel_requested`、`cancelled` 事件为后续真实增量/取消协作保留。取消请求通过 `/api/v1/ai/conversations/{conversationId}/turn/cancel` 写入跨实例状态；断线不自动重发，恢复使用状态查询和历史结果。
