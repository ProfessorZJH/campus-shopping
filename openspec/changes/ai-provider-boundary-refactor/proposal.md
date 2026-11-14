# Proposal

## Why

`ai-service/app/retrieval.py` 中的 `Provider` 同时负责 embedding、一次性聊天、流式聊天和 JSON 解析，`KnowledgeStore`、商品向量索引和回答引擎因此共享一个宽调用边界。现在拆出聊天与向量供应商对象，可以让后续检索或生成重构按能力演进，同时保留当前 HTTP、SSE、降级和安全审计行为。

## What Changes

- 新增 `ChatProvider` 和 `EmbeddingProvider`，分别承载聊天生成/流式输出与向量嵌入。
- 保留 `Provider` 兼容外观，旧的 `complete`、`stream_complete`、`embed`、`model_tag` 和 `vector_mode` 调用继续可用。
- 保留供应商 URL 校验、请求最小化、审计日志、响应限制、JSON 解析和错误降级语义。
- 不改变 FastAPI 路由、SSE 生命周期、知识库 SQLite/Qdrant 结构、Milvus 商品索引或 Java 交易事实复验。

## Capabilities

### New Capabilities

无。本次是内部结构重构，`.openspec.yaml` 使用 `skip_specs: true`。

### Modified Capabilities

无。外部行为和供应商协议保持不变。

## Impact

- 影响 `ai-service/app/retrieval.py` 的 Provider 定义，并新增 `ai-service/app/provider.py`。
- `KnowledgeStore`、`ProductIndex`、`engine`、`main` 继续通过兼容外观工作；不新增依赖、不改配置键和 HTTP 契约。
