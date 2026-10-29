# PR1 · 领域核心状态枚举改造

> 分支 `refactor/pr1-domain-status-enums`。本批只整理状态建模，**不包含** PR2 的 Trading Service/Repository 职责拆分、PR3 的全局格式化。

## 目标与边界

- Order、Product、Pickup、Proposal 聚合内部使用类型安全状态枚举；聚合根自身决定合法业务转换。
- SKU、预约库存、流水、售后申请、商户、提案等领域快照在构造时校验字符串，提供 `statusEnum()` / `typeEnum()` 给 Domain/Case 使用；保留现有 `String` 访问方法，避免跨层一次性迁移。
- 库存 Repository 接口的预占流转与流水操作类型改为枚举；**Infrastructure 适配器**在 MyBatis 边界转换成原有字符串。
- 状态码与当前生产 SQL 一致。保持 `cat_product.status`、`trd_order.status` 等 VARCHAR，HTTP DTO 与 JSON 的字符串码不变；不需要数据迁移。
- 不改变限界上下文与事务边界，不引入策略、责任链、独立微服务或新依赖。

## 业务规则检查

| 业务 | 校验重点 |
| --- | --- |
| 订单 | 未支付→支付/取消，支付→完成/退款；重复付款/取消幂等 |
| 商品/SKU | 有有效规格才能上架；数据还原必须验证状态编码 |
| 预占库存 | RESERVED→RELEASED / CONSUMED，重复消费不重复扣减 |
| 自提 | WAIT_PREP→PREPARING→READY→COMPLETED；令牌仅生效一次 |
| 售后 | REQUESTED、REJECTED、DISPUTED、APPROVED；拒绝非法状态 |
| AI 提案 | PENDING→CONFIRMED/REJECTED；重复确认仅允许原选择 |
| 商户 | ACTIVE/SUSPENDED，停用只阻止新交易 |

## 回归命令

```bash
mvn -B -ntp clean verify
```

`DomainStatusEnumTest` 为无数据库的枚举及状态机回归；MySQL 隔离环境的 `CommerceMySqlIntegrationTest` 和 `scripts/smoke-full.py` 复验并发、幂等及完整交易流程。以 GitHub Actions 的真实状态为准，不将源码提交视为测试通过或生产上线。

## 后续工作

PR2 再评估订单/售后/购物车的服务和仓储职责划分；PR3 才处理与本次功能无关的代码格式化和必要中文注释，避免本次改动扩大风险。
