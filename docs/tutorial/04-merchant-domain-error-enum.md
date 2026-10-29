# 为什么不再创建 MerchantErrorCodeEnumVO？

> **历史教学记录，不是R1运行指南。** 当前源码、接口与部署步骤见 [R1运行手册](../operations/R1-runbook.md)；不要把本文件中的旧版本示例复制覆盖当前实现。


此前我把“按领域分开管理错误码”误说成小傅哥的固定实现方式。现在读取用户提供的真实 `group-buy-market.zip`，可以确认：该项目实际把 `E0001/E0101...` 和通用 `0000/0001/0002` 一起集中在 **`types/enums/ResponseCode.java`**。

`Domain` 下的 `RefundTypeEnumVO`、`TradeOrderStatusEnumVO` 等主要描述退款类型、状态、策略选择等业务概念，而不是一异常一枚举。领域错误码拆到 `EnumVO` 不是这个参考项目的实际编码方式。

## 校园商城现在的约定

`campus-shopping-types/src/main/java/cn/bugstack/ai/types/enums/ResponseCode.java`：

```java
SUCCESS("0000", "成功"),
UN_ERROR("0001", "未知失败"),
ILLEGAL_PARAMETER("0002", "非法参数"),
MERCHANT_REQUEST_CONFLICT("M0001", "幂等键已用于另一份申请"),
MERCHANT_ALREADY_REVIEWED("M0002", "申请已经审核，不能重复处理"),
MERCHANT_SELF_REVIEW_FORBIDDEN("M0003", "申请人不能审核自己的入驻申请");
```

Domain 代码中直接使用：

```java
throw new AppException(ResponseCode.MERCHANT_REQUEST_CONFLICT);
```

`MerchantApplicationStatusEnumVO` 保留，它表示 `SUBMITTED/APPROVED/REJECTED` 等业务状态。不要再创建 `IdempotencyConflictException` 或 `MerchantErrorCodeEnumVO`。

`AppException` 处在 Types 层，可直接引用同模块 `ResponseCode`，不会发生 Types 反向依赖 Domain 的问题。
