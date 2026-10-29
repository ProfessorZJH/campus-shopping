# R1 业务错误码与边界

> 从当前 `ResponseCode` 核对；这是一组项目业务码，不是小傅哥原仓库全部预设值。

| 枚举名 | 业务码 | 安全提示 |
|---|---|---|
| `SUCCESS` | `0000` | 成功 |
| `UN_ERROR` | `0001` | 系统暂不可用 |
| `ILLEGAL_PARAMETER` | `0002` | 非法参数 |
| `AUTH_USERNAME_EXISTS` | `A0001` | 用户名已被注册 |
| `AUTH_BAD_CREDENTIALS` | `A0002` | 用户名或密码错误 |
| `AUTH_ACCOUNT_DISABLED` | `A0003` | 账号已停用 |
| `AUTH_UNAUTHENTICATED` | `A0004` | 请先登录 |
| `AUTH_CSRF_INVALID` | `A0005` | 安全令牌无效，请刷新后重试 |
| `AUTH_FORBIDDEN` | `A0006` | 无权执行此操作 |
| `AUTH_RATE_LIMITED` | `A0007` | 请求过于频繁，请稍后再试 |
| `NOT_FOUND` | `G0001` | 资源不存在或不可访问 |
| `STATE_CONFLICT` | `G0002` | 状态已经变化，请刷新后重试 |
| `REQUEST_CONFLICT` | `G0003` | 同一请求键不能用于不同内容 |
| `MERCHANT_REQUEST_CONFLICT` | `M0001` | 幂等键已用于另一份申请 |
| `MERCHANT_ALREADY_REVIEWED` | `M0002` | 申请已经审核，不能重复处理 |
| `MERCHANT_SELF_REVIEW_FORBIDDEN` | `M0003` | 申请人不能审核自己的入驻申请 |
| `MERCHANT_SUSPENDED` | `M0004` | 商户当前暂停经营 |
| `MERCHANT_PROFILE_INCOMPLETE` | `M0005` | 申请资料不完整，不能开通门店 |
| `PRODUCT_UNAVAILABLE` | `C0001` | 商品已下架或规格不可售 |
| `PRICE_CHANGED` | `C0002` | 商品价格或版本已变化，请重新确认 |
| `SKU_DUPLICATE` | `C0003` | 商品规格重复 |
| `STOCK_NOT_ENOUGH` | `I0001` | 可售库存不足 |
| `STOCK_STATE_INVALID` | `I0002` | 库存预占状态冲突 |
| `ORDER_STATE_INVALID` | `T0001` | 订单当前状态不允许此操作 |
| `ORDER_EXPIRED` | `T0002` | 订单已超过付款期限 |
| `ORDER_MIXED_MERCHANT` | `T0003` | 一次只能结算一个商户 |
| `REFUND_STATE_INVALID` | `T0004` | 售后状态不允许此操作 |
| `PICKUP_INVALID` | `F0001` | 自提凭证无效或过期 |
| `PICKUP_NOT_READY` | `F0002` | 商品尚未备货完成 |
| `AI_UNAVAILABLE` | `AI0001` | 智能服务暂不可用，普通购物不受影响 |
| `PROPOSAL_EXPIRED` | `AI0002` | 推荐建议已过期，请重新生成 |
| `KNOWLEDGE_NOT_READY` | `AI0003` | 知识索引尚未就绪 |
| `UPLOAD_INVALID` | `AI0004` | 文件格式、大小或内容不符合要求 |

业务判断由 Domain/Case 完成，领域异常穿过事务代理后在 Controller 捕获。不能在事务方法内吞掉异常并返回成功。

数据库重复键只有确认对应用户名/业务键时才转为业务冲突；其他 SQL 故障保持系统失败。账号状态检查、CSRF 与认证失败发生在安全过滤器时，由独立安全处理器返回 JSON，不依赖 Controller catch。

`EnumVO` 用于账号、商品、订单等领域状态/类型，不为每个错误新增领域错误枚举。`AppException` 位于 Types，不反向依赖 Domain。
