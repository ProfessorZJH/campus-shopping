# M3 流式供应商桥接阶段报告

日期：2026-11-07。对应 4.7 的 Python 受控桥接与 Java 适配子阶段。

已完成：

- Python Provider 支持 OpenAI 兼容 `stream=true`，逐行解析 SSE、限制单行 64 KiB、累计输出 20,000 字节并在生成器关闭时释放 HTTP 连接。
- 新增 `/v1/query/stream`，保持 `ExecutionGate` 到实际 worker 结束；客户端断开会让后续供应商读取停止，不能提前释放执行容量。
- 无真实模型时明确返回 `FULL_RESPONSE`；真实模型当前只暴露供应商分块计数 `progress`，不把 JSON 片段冒充用户可见 `delta`。
- Java `AiGatewayService` 已接收 `/v1/query/stream`，对 SSE 行、单行和累计数据设置上限，并在完整响应读取期间保持共享 AI 准入。
- `IAiEnginePort`、`ShoppingAiCase` 和 Java `/api/v1/ai/chat/stream` 已贯通 `progress.bytes`；最终答案仍经过原有知识授权、商品事实和提案复核。
- 取消状态已接入流式进度回调和提交前复核；命中 `CANCEL_REQUESTED` 时关闭 Java 响应流、释放 Python 侧执行许可并发送 `cancelled`，不提交消息或提案。

定向验证：

```text
python -m pytest -q tests/test_streaming.py tests/test_capacity.py tests/test_service.py
58 passed, 0 failed/error/skipped
```

未完成项：当前供应商协议仍输出完整 JSON，故没有伪造用户可见 `delta`；如果下游完全不产生进度，取消只能在返回或提交前复核；前端事件消费和真实供应商网络断开验收留在 4.8/4.9。

Java 定向验证：

```text
./mvnw -pl campus-shopping-app -am "-Dtest=AiGatewayProtocolTest,AiConversationBoundaryTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-Dfrontend.skip=true" test
24 passed, 0 failed/error/skipped
```
