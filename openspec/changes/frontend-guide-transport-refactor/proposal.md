# Proposal

## Why

`Guide.js` 同时维护导购界面状态和会话 API、SSE 事件解析、断线轮询。页面切换身份或会话时，代次检查必须继续留在页面状态层，但传输细节应有独立边界，避免后续 UI 拆分重复实现请求生命周期。

## What Changes

- 新增 `guide-conversation.js`，封装历史会话、会话快照、轮次取消、SSE 事件归一化和断线恢复请求。
- `Guide.js` 保留 Vue 状态、代次校验、消息和提案展示，只通过传输模块访问导购会话 API。
- 添加不依赖浏览器或后端的传输协议测试。

## Capabilities

无新增或修改业务能力。本次是前端内部结构重构，使用 `skip_specs: true`。

## Impact

只影响 `frontend/src/pages/Guide.js`、新增 `frontend/src/services/guide-conversation.js` 和对应测试/OpenSpec 记录；不改变 HTTP、SSE、提案确认、权限或交易规则。

