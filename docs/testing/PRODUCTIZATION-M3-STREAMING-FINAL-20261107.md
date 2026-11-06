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

- `verify-mysql-isolated.py --skip-maven` 已在全新临时 MySQL 8.0.31 实例通过，覆盖旧库升级、重复迁移、脏历史 CHECK 拒绝、缺失 V30 的旧 Redis 迁移历史、图片回填和新旧结构逻辑一致性；证据见 `docs/testing/evidence/productization-m3-mysql-migration.json`。验收指纹比较字段逻辑结构，不把可安全变化的 MySQL 物理字段顺序当成契约。
- 当前没有明确配置的隔离 Redis 测试实例，未运行 Redis 双实例验收。
- 当前未运行真实浏览器断网重连验收；前端逻辑已通过构建、类型和 Node SSE 解析 smoke。
- 未连接真实供应商，未宣称真实模型文本增量或性能通过。

当前结论：M3 流式代码、前端恢复链路和隔离 MySQL 升级路径已完成；隔离 Redis、真实 HTTP/浏览器回归、真实供应商效果仍属于 4.9 整合门禁项。
