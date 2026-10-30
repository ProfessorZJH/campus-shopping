# DDD 代码风格与职责收敛复查（2026-10-30）

基线：`codex/integrate-engineering`；本批不改变数据库结构、对外 HTTP 路由、订单锁顺序或业务响应码。本报告为源码复核与设计决策，不代替新增提交的 GitHub Actions 验收。

## 1. 已落地的最小改动

- [上下文图](context-map.md)：修正旧 `OrderPaid` 异步消息描述。当前付款由 `OrderLifecycleCase.pay` 在一个 MySQL 本地事务完成支付记账、自提创建和订单状态保存，失败整体回滚；无必要引入 MQ/Outbox。
- `ICatalogService` / `ICatalogCase`：移除会无提示忽略排序的默认方法，具体实现必须覆盖业务契约。
- `IOrderService.orderForUpdate`：锁定写操作由明确方法负责，事务传播 `MANDATORY`，普通查询继续调用 `IOrderQueryService.order`。
- `ICatalogService`：区分 `offers`（展示）、`saleOffers`（销售校验）、`saleOffersForUpdate`（销售校验并锁定）和 `offersForUpdate`（受控补货核对）；锁定方法要求外层事务，底层仍复用已有 Repository/DAO，锁顺序不变。
- `AfterSaleController`：商户/平台售后列表的授权和领域查询迁到现有 `IOrderQueryCase`，不新增转发层。

## 2. Merchant、Cart、Identity 的规则归属决策

| 领域 | 当前事实 | 决策 |
| --- | --- | --- |
| Merchant | `MerchantServiceImpl.changeStatus` 锁商户行并修改营业状态，停用与新交易的锁顺序由 Case 协作保证 | **保留服务层**。目前只有简单状态规则，不为追求对象名再造一个贫血的 `MerchantAggregate`；未来营业状态出现多步骤转移/不变量再升级建模 |
| Cart | `CartServiceImpl` 在事务内校验单行 1–99 件、最多 100 行、购物车变更与下单消费 | **保留领域服务**。购物车是独立领域能力，但没有必要让内存聚合取代数据库行级并发及请求闸门；不得削弱现有锁 |
| Identity | `AccessServiceImpl` 实时检查账号与商户成员/角色权限，`MerchantPermissionEnumVO` 集中维护授权依赖 | **保留当前服务**。权限基于数据库当前状态，不能只依赖预先加载的聚合或前端声明；将来按用例查询性能再考虑批量读模型 |
| Trading | `OrderAggregate`、`AfterSaleAggregate` 管理状态转换 | **继续保持富模型**。不把状态条件转移回 Case/Controller |

命令对象的后缀、只读 VO 命名与 Java 17 `record` 的区别属于较低优先级风格项。只有对象实际承担业务状态及不变量时才调整建模，不能仅因包含 `id` 就把查询快照改为 Aggregate。

## 3. Case 入口与调用方向

- `ICatalogCase` 中原有商品读取、统计与库存读方法，部分仍被 `ICatalogQueryCase` 和历史测试调用；当前不直接删除，避免破坏既有授权、分页及组合查询。未来调用方统一到 Query Case 后，再在独立小批次删除不再引用的入口。
- `IOrderQueryCase` 本就依赖 `IAfterSaleQueryService` 提供订单页内售后信息，复用它统一平台/商户售后列表授权比新建 `IAfterSaleQueryCase` 更简单。
- 简单单领域 Controller 直接调用公开 Domain Service 仍符合小傅哥原始规范；只有跨领域查询和访问控制编排不宜停留在 HTTP 层。

## 4. DAO 与跨域查询边界

- `ITradingDao` 目前组合订单/购物车/售后 SQL，`IAiDao` 组合知识/会话/提案 SQL；二者均位于 `infrastructure/dao`，域服务不直接依赖 DAO。Repository 已按能力分割，无证据要求此时机械按表拆 DAO。未来某个 DAO 因并行维护冲突、SQL 规模或测试隔离成为真实问题再拆。
- Catalog 全局售价/库存排序需要在数据库分页前计算；`ICatalogQueryDao` 通过只读联查商户状态和库存余额实现，`IInventoryQueryDao` 只读关联商品/SKU 作库存搜索。它们是**有意识的同库只读投影依赖**，不是跨域主数据写入。
- 严禁在这些查询 Mapper 内新增其他领域的 `UPDATE`/`INSERT`/`DELETE` 或 `FOR UPDATE`；保留 `verify-ddd-boundaries.py` 的允许列表和拒绝样例。未来拆数据库或微服务时应先改查询投影设计，不可直接复制 JOIN。

## 5. 验证边界与后续门禁

以对应 HEAD 的 GitHub Actions `Maven / MySQL / FastAPI / Browser E2E`、`Actual delivery images / isolated Compose transaction chain` 最终结果为准；提交前后某次被取消的运行不代表成功或失败。下一批只有在真实修改需要时才添加新 DAO、聚合或事件基础设施。

代码审查重点：锁定读取必须在代理事务内调用；订单与提案写入仍有权限复验、幂等和失败回滚；商品排序在 SQL 全局执行后分页；失败码/响应字段、既有 93 条路由与前端契约保持兼容。
