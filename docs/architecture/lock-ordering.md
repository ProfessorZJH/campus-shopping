# 锁顺序契约

> 适用：`campus-shopping-case` 的跨域用例与 `campus-shopping-domain` 的库存服务。
> 来源：本文逐条来自源码阅读（2026-11-12），不是设计意图。新增/修改事务用例必须先更新本文。

## 1. 为什么需要这份文档

AGENTS.md 要求「Case 保证同库事务、锁顺序和幂等」。此前只有 `CheckoutCaseImpl` 的类注释声明了锁序，`cancel` / `expire` / `refund` / 提货四条路径没有等价声明，等于四条路径的锁顺序没有契约。

## 2. 共享资源

| 资源 | 表 | 加锁方式 |
|---|---|---|
| 订单行 | `trd_order` | `orderForUpdate`（`SELECT ... FOR UPDATE`） |
| 售后单 | 售后表 | `afterSaleForUpdate` |
| 预占记录 | `inv_reservation` | `reservations` 按 `sku_id` 排序并 `FOR UPDATE`；`reserve` 的单条 `reservation` 也使用 `FOR UPDATE` |
| 库存余额行 | `inv_stock_balance` | 领域层 `required(...)` 内部以 `FOR UPDATE` 读取 |
| 购物车 | 购物车表 | 下单路径按用户维度加锁 |
| 下单幂等键 | 订单唯一键 | 唯一索引冲突 |

## 3. 各路径的加锁顺序

| 路径 | 代码位置 | 顺序 |
|---|---|---|
| 下单 | `CheckoutCaseImpl.checkout` | 请求闸门 → 用户购物车 → 商户 → 商品/SKU → 库存（按 `skuId` 升序） |
| 预占 | `InventoryServiceImpl.reserve` | 逐 SKU 处理，`items` 先按 `skuId` **升序**排序 |
| 商品写入/提案确认 | `stocksForProductWrite` / `stocksForConfirmation` | `ids` 排序后 `stocksForUpdate` |
| 买家取消 | `OrderLifecycleCaseImpl.cancel` | 订单行 → 预占记录 → 库存（`finish`，均按 `skuId` 升序） |
| 超时关单 | `OrderLifecycleCaseImpl.expire` | 订单行 → 预占记录 → 库存（`finish`，均按 `skuId` 升序） |
| 退款裁决 | `OrderLifecycleCaseImpl.decideRefund` | 订单行 → 售后单 → 履约 → 预占记录 → 库存（`finish`，均按 `skuId` 升序） |
| 提货核销 | `OrderLifecycleCaseImpl` → `inventory.consume` | 订单行 → 预占记录 → 库存（`finish`，均按 `skuId` 升序） |

## 4. 硬规则

1. **库存行一律按 `skuId` 升序加锁。** `reserve`、`stocksForUpdate`、`finish` 三处必须保持一致。任何按其他顺序（索引返回顺序、插入顺序、`IN` 列表原序）遍历并加锁的写法都是缺陷。
2. **订单行先于库存行。** 取消、关单、退款、核销都遵守；下单是唯一例外（先锁库存再插入**新**订单行，新行主键不参与竞争，因此不构成环）。
3. **售后单在订单行之后。** 退款裁决不得先锁售后单再锁订单行。
4. **禁止在持有任何行锁时调用远程服务**（AI、对象存储、LLM 供应商）。远程调用必须在事务外完成。
5. **库存写入和加锁操作使用 `Propagation.MANDATORY`**：必须在调用方事务内执行，不允许库存服务自行开事务。

## 5. 已知的次序倒置（现无环，但需守住前提）

下单新建路径「库存 → 订单」，退款路径「订单 → 库存」，方向相反。新建路径插入的是**新**订单主键，与退款的 `orderForUpdate` 不竞争同一行。已有请求的幂等重放会锁已有订单，但它在获取库存锁之前直接返回，不走新建路径。

因此有一条必须守住的前提：

> 下单新建路径持有库存锁之后，不得再对**已存在的订单行**加锁。幂等重放可以在获取库存锁之前锁已有订单，并直接返回。

若打破这条前提，`checkout` 与 `decideRefund` 可能分别持有库存锁和订单锁并互相等待。新引入已有订单锁时，应重新审查完整事务路径与锁序，并用真实数据库并发回归验证。

预占与完成也有顺序差异：`reserve` 先锁库存、再查询对应预占；`finish` 先锁该订单的预占记录、再锁库存。当前正常下单使用新订单 ID，幂等重放不会再次预占；如果未来允许同一订单的预占与释放或核销并发，必须重新评估这一前提及死锁风险。

## 6. 变更检查清单

修改任何 Case 事务方法时确认：

- [ ] 新增的行锁是否在本文第 3 节被登记
- [ ] 库存行是否仍按 `skuId` 升序
- [ ] 是否出现第 5 节描述的反向加锁
- [ ] 是否仍在事务内调用远程服务
