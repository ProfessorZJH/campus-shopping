# Design

## Context

See `proposal.md` for motivation. 当前 Provider 的远程 HTTP 调用、流式 SSE 解析、本地 embedding 降级和供应商审计逻辑集中在 retrieval 模块；测试和本地验收还会替换 `app.retrieval.bounded_json` 或 `store.provider.complete`。

## Goals / Non-Goals

**Goals:**

- 以明确对象边界区分 Chat 与 Embedding 调用。
- 保持旧 Provider 属性和方法可用，减少迁移面。
- 保留安全、限流、审计、可观测性和流式完成条件。

**Non-Goals:**

- 不改 `main.py`、SSE worker、KnowledgeStore 检索排序或供应商配置。
- 不引入新的远程密码 Port，不改变外部模型响应格式。

## Decisions

1. 使用 `ChatProvider` 和 `EmbeddingProvider` 包装同一套受控 HTTP 核心逻辑；`Provider` 只负责兼容转发。这样避免复制认证、审计和响应限制代码。
2. 保留 `app.retrieval.bounded_json` 作为替换接缝，Provider 内部运行时回调该入口，确保现有测试与本地验收的传输隔离方式继续有效。
3. `KnowledgeStore` 和 `ProductIndex` 暂时继续接收 `Provider`，后续可按真实调用方逐步改为窄类型，不在本批次扩大迁移。

## Risks / Trade-offs

- [Risk] 兼容外观使旧代码继续依赖宽接口 → 新代码优先使用 `chat`/`embedding` 属性，后续按调用方单独迁移。
- [Risk] 传输替换接缝被误删 → 定向 egress、streaming 和供应商协议测试必须通过。
- [Risk] Provider 核心仍位于新模块但名称相对内部 → 不暴露凭据或原文，保持现有日志脱敏规则。

## Migration Plan

1. 将 Provider 实现移动到 `app/provider.py`，建立两个窄对象和兼容 facade。
2. 保留 retrieval 导出路径和所有现有调用方，运行定向 Python 回归。
3. 回滚只需回退本次 Python 提交，不涉及数据或部署迁移。

## Open Questions

无。
