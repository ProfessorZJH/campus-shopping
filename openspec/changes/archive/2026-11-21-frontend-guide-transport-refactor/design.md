# Design

## Context

导购页已有身份代次、流式取消、断线恢复和历史会话逻辑，但这些逻辑与 Vue 响应式状态混在同一个页面文件中。抽取传输层可以复用现有 `api`/`stream`，避免重新实现 CSRF、SSE 解析和 HTTP 错误语义。

## Goals / Non-Goals

**Goals:**

- 让会话 API、SSE 事件和断线恢复请求集中在一个无 UI 传输模块。
- 保留 `Guide.js` 的身份代次、旧响应隔离、取消、断线恢复和提案展示行为。
- 通过依赖注入测试传输协议的事件归一化和恢复顺序。

**Non-Goals:**

- 不引入 Vue Router、Pinia、全量 SFC 迁移或新的状态管理。
- 不改变 API 路径、请求体、SSE 事件名、错误码或后端租约语义。
- 不把提案确认、商品规则或权限判断迁移到前端传输模块。

## Decisions

- `createGuideConversationTransport` 默认复用现有 `api` 和 `stream`，测试可以注入等价的请求函数。
- 传输模块返回原始消息、提案和轮次结果；页面负责把它们映射到响应式状态，并继续执行 `conversationEpoch` 与当前用户检查。
- 断线恢复继续轮询最多 60 次；`CANCEL_REQUESTED`、`IDLE`、网络/超时重试和未完成时保留待处理消息的语义保持不变。

## Risks / Trade-offs

- [Risk] 事件回调顺序变化会影响页面状态 → 传输层按现有 started/progress/completed/cancelled/failed 顺序转发，并保留事件中的 conversationId 更新。
- [Risk] 快照恢复误接受旧回答 → 快照校验保留当前问题及已知最后消息的位置约束。

## Migration Plan

直接替换页面内部调用即可回滚；不涉及数据、API、构建产物或部署迁移。完成 Node 传输测试、Guide 浏览器回归和 JavaScript 语法检查后再生成 UI bundle。

