# M3 流式体验最终阶段报告

日期：2026-11-07。对应 OpenSpec 4.7、4.8 的实现收口和 4.9 的适用范围检查。

已完成并推送：

- Python 受控供应商流、Java SSE 适配、轮次取消和下游连接关闭。
- 导购页 `progress/cancelled` 消费、取消按钮、真实会话 ID、断线状态轮询和原会话恢复。
- 生成 UI 静态副本与构建校验同步完成。

通过的定向检查：

```text
Java AiGatewayProtocolTest + AiConversationBoundaryTest: 24 passed
Python streaming/capacity/service tests: 58 passed
Frontend production build: PASS
Frontend typecheck: PASS
Frontend SSE parser smoke: PASS
UI bundle --check: PASS
API contract: 99 routes PASS
API schema: 75 checks PASS
schema_contract: PASS
verify-release: PASS
```

隔离验收范围：

- `verify-mysql-isolated.py --http-smoke` 已在全新临时 MySQL 8.0.31、两个本机 Redis 实例和真实 Java/FastAPI/Chromium 链路通过：393 Java（0 skipped）、291 HTTP、9 双 Redis、22 浏览器和 5 项 M2 履约；完整证据见 `docs/testing/evidence/productization-final-20261107/`。
- 本轮真实 HTTP 使用当前 OpenAPI 逐响应校验；检索模式为 `LOCAL_RETRIEVAL_DEMO`，未连接真实外部模型或向量服务。
- 真实浏览器已覆盖调试页请求，但尚未完成 AI 流式断网重连矩阵；CI 当前提交没有可读取的 check run。

当前结论：M3 流式代码、前端恢复链路、隔离数据库/Redis/HTTP/基础浏览器回归已通过；真实供应商效果、流式断网矩阵和该版本 CI 仍属于 4.9 的未完成范围。
