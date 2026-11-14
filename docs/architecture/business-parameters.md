# 业务参数清单

> 目的：把散落在配置、SQL、聚合常量里的阈值集中登记，改一条规则时不用全仓 grep。
> 状态：2026-11-12 首次盘点。「位置」均为实际源码位置；未能逐行核对代码的项标注为「规格」。

## 1. 交易与订单

| 参数 | 当前值 | 位置 | 归属 | 备注 |
|---|---|---|---|---|
| 支付截止时长 | 15 分钟 | `CheckoutCaseImpl` `@Value("${campus.order.payment-minutes:15}")` | 配置 | 默认值在注解与字段初始化重复一份 |
| 过期扫描间隔 | 15000 ms | `OrderExpiryJob` `@Scheduled(fixedDelayString=...)` | 配置 | 同时决定最大积压处理速度 |
| 单轮扫描批量 | 100 笔 × 20 批 | `OrderExpiryJob` 字面量 | 硬编码 | 单实例上限 2000 笔/轮 |
| 订单条目上限 | 20 | `CheckoutCaseImpl.checkout` `require(items.size() <= 20)` | 硬编码 | 与 `InventoryServiceImpl.reserve` 的 20 重复 |
| 单 SKU 购买数量上限 | 99 | `InventoryServiceImpl.reserveOne` | 硬编码 | 无注释说明来源 |
| 单次库存操作上限 | 1,000,000 | `StockBalanceAggregate.checkQuantity` | 硬编码 | 聚合内，无配置化 |
| 查询可售阈值上限 | 1,000,000 | `InventoryServiceImpl` `availableBelow` 校验 | 硬编码 | |
| 批量查库存上限 | 1000 个 SKU | `InventoryServiceImpl.stocks` | 硬编码 | |
| 商品写入/确认的 SKU 上限 | 20 | `stocksForProductWrite` / `stocksForConfirmation` | 硬编码 | |

## 2. 商品与库存

| 参数 | 当前值 | 位置 | 归属 | 备注 |
|---|---|---|---|---|
| 低库存判定阈值 | < 20 | `icatalogquerydao_mapper.xml` `<sql id="managedStatus">` | **SQL 内硬编码** | 业务规则落在持久层，改判定要改映射文件 |
| 可售库存公式 | `on_hand - reserved`（SQL 侧带 `GREATEST(...,0)` 钳位） | 同上 + `STOCK_DESC` 排序（同文件 3 处） + `StockBalanceAggregate.available()` | **三份实现** | 领域层不钳位、SQL 层钳位，口径不一致 |
| 库存不变量 | `0 <= reserved <= on_hand` | `StockBalanceAggregate` 构造器 + DB `CHECK` | 双份 | 领域与 DB 各一份，DB 是最后防线 |

## 3. AI 导购与知识库

| 参数 | 当前值 | 位置 | 归属 | 备注 |
|---|---|---|---|---|
| 召回商品上限 | 200 商品 / 300 SKU | `docs/specs/SDD-AI-RECALL-07.md` | 规格 | 本轮未逐行核对代码常量 |
| 会话轮次租约 | 600 秒 | `docs/specs/SDD-REDIS-12.md` | 规格 | `turn_token` / `turn_expires_at` |
| 文本字段通用上限 | 100 | `optional(q, 100)`、`text(reason, ..., 500)` 等 | 硬编码 | 审核意见 500，其余 100 |

## 4. 已知问题

1. **低库存阈值是最需要搬走的一项**：它既是业务规则，又在 SQL 里，且与另外两处可售库存实现并列。建议顺序：先集中到领域层常量/配置，再由查询入口作为参数传入 mapper。
2. **`20` 出现三次**（订单条目、库存确认、低库存），语义不同但数值相同，容易误改。
3. **`availableBelow` 与 `checkQuantity` 共用 1,000,000** 但一个是查询参数、一个是变更上限，同值不同义。
4. 本清单之外的阈值若被发现，应补入本文，而不是分散写进注释。
