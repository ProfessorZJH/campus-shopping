# M3 流式供应商桥接阶段报告

日期：2026-11-07。对应 4.7 的 Python 受控桥接子阶段，Java 流句柄接入仍在进行。

已完成：

- Python Provider 支持 OpenAI 兼容 `stream=true`，逐行解析 SSE、限制单行 64 KiB、累计输出 20,000 字节并在生成器关闭时释放 HTTP 连接。
- 新增 `/v1/query/stream`，保持 `ExecutionGate` 到实际 worker 结束；客户端断开会让后续供应商读取停止，不能提前释放执行容量。
- 无真实模型时明确返回 `FULL_RESPONSE`；真实模型当前只暴露供应商分块计数 `progress`，不把 JSON 片段冒充用户可见 `delta`。

定向验证：

```text
python -m pytest -q tests/test_streaming.py tests/test_capacity.py tests/test_service.py
58 passed, 0 failed/error/skipped
```

未完成项：Java `AiGatewayService` 尚未接收 Python 流句柄，当前 Java SSE 仍走完整 `shopping.chat()`；真实文本增量、Java 取消下游连接和前端增量显示留在 4.7 后续子阶段。真实供应商与网络断开验收未运行。
