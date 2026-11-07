# M3 流式导购界面阶段报告

日期：2026-11-07。对应 4.8 的前端事件消费与断线恢复子阶段。

已完成：

- 前端新增受控 SSE 客户端，解析 `started`、`progress`、`completed`、`failed`、`cancelled`，保留 CSRF、身份代次和响应大小限制。
- 导购页显示供应商已读取字节数，支持发起取消并显示停止状态；取消只调用已有轮次取消 API，不重新发起生成。
- 连接断开后按会话状态轮询；轮次完成时读取原会话消息和提案恢复页面，未完成生成不会重复提交。
- Java `started` 事件在轮次租约成功后携带真实 `conversationId`，新会话也可以取消和恢复。

定向验证：

```text
npm run build --prefix frontend                         PASS
npm run typecheck --prefix frontend                    PASS
npx prettier --config .prettierrc.json --check \
  src/pages/Guide.js src/services/api.js                PASS
python scripts/build-ui-bundle.py --check              PASS
Node SSE parser smoke                                  PASS
```

限制：当前供应商协议仍然只返回完整 JSON，前端不会把 JSON 分块显示成伪文本增量；真实浏览器断网重连和隔离后端联调留在 4.9。
