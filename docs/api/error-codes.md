# R1 业务与协议错误码

> 由 `python scripts/generate-api-contract.py` 从 `ResponseCode.java` 生成，CI 检查漂移。

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
| `REQUEST_TOO_LARGE` | `G0004` | 请求体超过允许大小 |
| `METHOD_NOT_ALLOWED` | `G0005` | 请求方法不支持 |
| `MEDIA_TYPE_UNSUPPORTED` | `G0006` | 请求内容类型不支持 |
| `MEDIA_TYPE_NOT_ACCEPTABLE` | `G0007` | 响应内容类型不支持 |
| `MERCHANT_REQUEST_CONFLICT` | `M0001` | 幂等键已用于另一份申请 |
| `MERCHANT_ALREADY_REVIEWED` | `M0002` | 申请已经审核，不能重复处理 |
| `MERCHANT_SELF_REVIEW_FORBIDDEN` | `M0003` | 申请人不能审核自己的入驻申请 |
| `MERCHANT_SUSPENDED` | `M0004` | 商户当前暂停经营 |
| `MERCHANT_PROFILE_INCOMPLETE` | `M0005` | 申请资料不完整，不能开通门店 |
| `MERCHANT_ROLE_NAME_EXISTS` | `M0006` | 本商户已存在同名角色 |
| `PRODUCT_UNAVAILABLE` | `C0001` | 商品已下架或规格不可售 |
| `PRICE_CHANGED` | `C0002` | 商品价格或版本已变化，请重新确认 |
| `SKU_DUPLICATE` | `C0003` | 商品规格重复 |
| `STOCK_NOT_ENOUGH` | `I0001` | 可售库存不足 |
| `STOCK_STATE_INVALID` | `I0002` | 库存预占状态冲突 |
| `ORDER_STATE_INVALID` | `T0001` | 订单当前状态不允许此操作 |
| `ORDER_EXPIRED` | `T0002` | 订单已超过付款期限 |
| `ORDER_MIXED_MERCHANT` | `T0003` | 一次只能结算一个商户 |
| `REFUND_STATE_INVALID` | `T0004` | 售后状态不允许此操作 |
| `CART_QUANTITY_LIMIT` | `T0005` | 同一规格最多可加入99件，请调整购物车数量 |
| `CART_LINE_LIMIT` | `T0006` | 购物车已满，请先清理部分商品 |
| `PICKUP_INVALID` | `F0001` | 自提凭证无效或过期 |
| `PICKUP_NOT_READY` | `F0002` | 商品尚未备货完成 |
| `PICKUP_STATE_INVALID` | `F0003` | 自提任务当前状态不允许此操作 |
| `AI_UNAVAILABLE` | `AI0001` | 智能服务暂不可用，普通购物不受影响 |
| `PROPOSAL_EXPIRED` | `AI0002` | 推荐建议已过期，请重新生成 |
| `KNOWLEDGE_NOT_READY` | `AI0003` | 知识索引尚未就绪 |
| `UPLOAD_INVALID` | `AI0004` | 文件格式、大小或内容不符合要求 |
| `KNOWLEDGE_SCOPE_TOO_LARGE` | `AI0005` | 可访问知识文档超过单次检索上限，请联系管理员整理知识库 |

Domain/Case 抛出 AppException，异常穿过事务代理后由 Controller 内部捕获；禁止在事务方法内吞异常返回成功。

数据库唯一约束冲突在明确的仓储写操作处翻译：用户名 A0001、同商户角色重名 M0006；其他 SQL 故障仍为系统失败。

ApiProtocolExceptionResolver 只适配 /api 下的 MVC 协议错误，不处理 AppException 或普通运行异常；没有新增全局业务异常处理器。
Security 独立处理 401/403，账号状态服务不可用返回 503/0001；入口限流为 429/A0007。

协议映射：400/0002、404/G0001、405/G0005、406/G0007、413/G0004、415/G0006；业务失败通常仍为 HTTP 200。
请求体上限 3,000,000 字节（包括分块上传）；文件解码后上限 2,000,000 字节。错误响应不回显正文、SQL 或异常堆栈。
