# 强一致事务、业务事件与失败恢复契约

> **R1 对齐说明（2026-10-28）**：本文保留需求来源与历史设计；当前冻结规则以 [R1 实施规格](../specs/RELEASE-01.md) 为准，实际实现/验证状态见 [R1 交付清单](../DELIVERY-R1.md)。历史“下一批/待开发/已通过”描述不作为本次执行证据。

> 版本 v1.1 · 2026-10-27 · **实施约束，不是已验证的事务代码**  
> 关联：[上下文映射](context-map.md) · [数据模型](../database/logical-data-model.md) · [测试计划](../testing/test-strategy.md)。

## 1. 一致性分类

- **强一致业务变更**：同一 MySQL 数据源、同一 Spring 事务管理器内完成，任何失败整体回滚。必要时通过唯一索引、条件更新、行锁以及明确锁顺序解决并发竞争。
- **最终一致通知**：商品搜索投影、非关键提醒、分析统计，允许异步，但要可靠投递、幂等和有恢复入口。
- **不事务化外部调用**：LLM、Qdrant、对象存储、第三方 HTTP；不应持有数据库行锁等待模型返回。

官方 Skill 中有跨聚合使用事件最终一致的通用示例，本项目的**库存预占/订单创建、核销/出库**基于单库业务不变量，明确采用强一致作为项目 ADR；这是针对本业务而不是宣称所有 DDD 都必须强一致。

## 2. 事务矩阵（规范性）

| 用例 | 同一事务内写入 | 决胜锁/唯一键 | 不可异步替代的操作 |
|---|---|---|---|
| 审核通过 | application, merchant, store, membership, audit | application status/version；merchant.source_application unique | Owner 授权 |
| 订单创建 | stock balances/reservations, order/items, idempotency | stock 条件更新；reservation(order,sku) unique | 全部 SKU 预占 |
| 模拟支付 | order, mock_payment, 必要 outbox | order status/version；payment.order unique | 支付与关单竞争 |
| 未付关闭 | order, reservation statuses, stock balance | order 状态锁；reservation 行锁 | 释放预占 |
| 自提核销 | pickup_task, verification, order, reservation, stock balances | pickup 一次性状态；order 状态；reservation | 实际出库和完结 |
| 未提货退款 | aftersale, refund, pickup cancel, order, reservation, stock balances | 同核销一致锁顺序；refund.order unique | 防止退款与交付双成功 |
| Proposal 确认加购 | proposal 状态, cart_item 写入, 幂等记录 | proposal 状态/版本；cart唯一键 | 用户确认与唯一加购 |

每条事务由 Case（跨域）或领域应用服务（单域）控制，Repository 实现不得自行开启新事务提前提交或屏蔽异常；失败要传播并触发整体回滚。

## 3. 锁顺序与竞争协议

- Checkout：按 `storeId, skuId` 固定排序锁定/更新库存余额，避免不同请求反向获得行锁。
- 支付 vs 关闭：只在 `PENDING_PAYMENT` 状态进行一次合法转换，超时条件取可信服务端时间，提交后检查受影响行数。
- Refund vs Pickup：双方必须争用同一订单/核销状态，并采用**相同数据库行锁顺序**（例如 Order → Pickup → Reservation/Balance，实际 SQL 分析后定稿）。不得由各自 Case 自由决定顺序。
- 售价变化 vs 结算：报价和正式创建应验证 `skuVersion`/最新价格，可因改价失败并提示用户确认新报价；不要静默按旧价成交。
- 只靠 Redis 锁、Controller `synchronized` 或先查后写，不是充分的库存安全保证。

## 4. 幂等矩阵

| 操作 | 幂等业务键 | 重试语义 | 不同载荷同键 |
|---|---|---|---|
| 提交商户申请 | userId + requestKey | 返回原申请 | 业务冲突码 |
| 通过审核 | applicationId + 决定结果 | 返回既有 merchantId | 对抗决定返回冲突业务码 |
| 补货 | storeId + skuId + requestKey | 返回既有 movement | 业务冲突码 |
| 下单 | buyerId + Idempotency-Key | 返回原 orderId | 业务冲突码 |
| 库存预占 | orderId + skuId | 不重复增加 reserved | 数量不同返回冲突业务码 |
| 付款 | orderId | 已付款同结果重放 | 金额不同返回冲突业务码 |
| 释放 | orderId + skuId | 不重复释放 | 已 CONSUMED 返回冲突业务码 |
| 核销 | pickupId | 不重复扣实物；可提示已核销 | 他人/异请求不可泄漏 |
| 模拟退款 | orderId | 不重复退款 | 不同金额返回冲突业务码 |
| AI 确认提议 | proposalId + buyerId + requestKey | 不重复加购 | 不同选择返回冲突业务码 |

**上表“冲突业务码”描述的是业务语义，不表示 HTTP 状态固定为 409。当前商户申请练习返回 HTTP 200 + `M0001`，未来其他领域编码按 [错误码文档](../api/error-codes.md) 设计与实现时冻结。**

**Idempotency-Key 只有结合请求指纹、调用者范围和成功响应引用才有意义。** 数据库唯一约束是最终保护，不能仅依赖 Redis 缓存。

## 5. 领域事件与集成事件

| 领域事实 | 要不要发布为集成事件？ | 消费者/用途 |
|---|---|---|
| `MerchantOpened` | 可以 | 站内通知/统计，不替代 Owner 授权事务 |
| `ProductPublished` / `SkuPriceChanged` | 是（启用检索时） | 更新搜索索引、异步投影 |
| `StockReserved` | 通常无需 | 下单事务内部事实，不让异步事件负责预占 |
| `OrderCreated` | 可选 | 通知/统计；订单已拥有预占 |
| `OrderPaid` | 是（若任务异步创建） | 幂等创建自提任务，失败可靠重试 |
| `PickupCompleted` | 可选 | 通知与统计；交易/库存已经提交 |
| `KnowledgeVersionPublished` | 视索引机制 | 清理旧检索投影/发布可见性 |

事件风暴黄色便签代表业务事实，并不自动成为需要发 MQ 的技术消息。内部计算结果（如 ShoppingIntent、Rerank 结果）通常为普通返回值。

## 6. Outbox 设计（按需启用）

表候选：`sys_outbox(id,event_type,aggregate_id,event_version,payload,created_at,published_at,attempts,next_retry_at,last_error)`；随源业务事务写入。Worker 定时捞取未投递消息，按指数退避和最大重试数处理，超限进入可观测失败状态。消费者使用 `eventId` 去重，并用业务版本抵御乱序。

示例事件：

```json
{
  "eventId": "generated-event-id",
  "eventType": "ProductPublished",
  "schemaVersion": 1,
  "aggregateId": "product-id",
  "merchantId": "merchant-id",
  "occurredAt": "2026-10-26T00:00:00Z",
  "correlationId": "request-id",
  "payload": {"productId": "product-id", "productVersion": 3}
}
```

示例不代表已经发送或存储了这条消息。

## 7. 故障恢复

- `OrderPaid` 后创建 PickupTask 失败：已付订单不回滚，利用 Outbox 可靠重试、按 orderId 唯一和补偿扫描确保最终补齐。
- 搜索索引失败：商品 CRUD 正常可用，索引状态可查询、重试；AI 侧不能将过时价格视为权威。
- LLM 超时：本次推荐失败/降级，不改变订单、库存、购物车。
- 退款或核销途中 DB 异常：事务回滚并允许幂等重试；日志必须保留 requestId。
- 客户端重试：按幂等键和请求指纹恢复结果，不能简单地再次执行全部写操作。

## 8. 验收场景

至少用真实 MySQL 8 验证：超卖竞争、批量预占中途失败、支付与到期关闭、退款与核销、重复审核、重复核销、重复事件投递、Outbox 投递与业务提交之间进程崩溃、断线重试与请求指纹冲突。未实现前本节均为**测试计划**。
