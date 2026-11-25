# Tasks

## 1. Provider 边界

- [x] 1.1 将聊天生成、流式生成和 JSON 解析放入 `ChatProvider`，并保留响应限制、审计和失败观测；通过 streaming 与 service 定向测试验证。
- [x] 1.2 将向量嵌入、本地降级和模型标识放入 `EmbeddingProvider`；通过 product vector 与 egress 定向测试验证。
- [x] 1.3 保留 `Provider` 兼容 facade、`app.retrieval.Provider` 导出和旧传输替换接缝；通过供应商 payload、脱敏日志和现有调用方测试验证。

## 2. 回归交付

- [x] 2.1 运行 Python 定向测试并确认 FastAPI/SSE、Milvus/Qdrant 接缝没有 API 或配置变化。
- [x] 2.2 运行 `openspec validate ai-provider-boundary-refactor --strict` 和 `git diff --check`，提交单独 Python 结构重构 commit。
