# AI SSE 独立协议

`POST /api/v1/ai/chat/stream` 是独立的 `text/event-stream` 入口，不纳入普通 `Response<T>` 路由生成。它仍要求登录、同源 Session Cookie、CSRF 头和 `ChatRequestDTO` JSON，并共享 AI 用户/全局限流。Java 到 Python 的受控桥接入口为 `POST /v1/query/stream`，只接受 Java 服务密钥。

当前 Java 入口支持完整响应模式，并可转发供应商处理进度：

- `started`：表示已接受轮次，`mode` 为 `FULL_RESPONSE`。
- `completed`：`data` 为现有 `ChatResponseDTO`；不会把完整文本拆成伪 `delta`。
- `progress`：`data` 为 `{ "bytes": number }`，只表示供应商已读取的受控字节数，不包含模型正文。
- `failed`：只返回安全的 `errorCode`，不回显下游正文、提示词或凭据。

当前 Python 桥接会读取供应商真实 SSE 分块并发送 `progress.bytes`，但模型协议仍要求完整 JSON；这些分块不直接展示为用户文本，也不冒充 `delta`。`delta`、`cancel_requested`、`cancelled` 事件待 Java 流句柄接入和前端消费完成后启用。取消请求通过 `/api/v1/ai/conversations/{conversationId}/turn/cancel` 写入跨实例状态；断线不自动重发，恢复使用状态查询和历史结果。
