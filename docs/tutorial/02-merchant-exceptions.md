# 异常处理：按 group-buy-market Controller 实际代码对齐

> **历史教学记录，不是R1运行指南。** 当前源码、接口与部署步骤见 [R1运行手册](../operations/R1-runbook.md)；不要把本文件中的旧版本示例复制覆盖当前实现。


参考文件：用户上传 `group-buy-market.zip` 中的 `group-buy-market-trigger/src/main/java/cn/bugstack/trigger/http/MarketTradeController.java`。

## 真实参考流程

1. Domain 通过 `AppException` 表达可预期业务失败，例如 `new AppException(ResponseCode.E0101)`。
2. `ResponseCode` 集中定义通用码和部分业务错误码；DTO/PO/状态 EnumVO 不是异常码载体。
3. Controller 方法使用 `try/catch(AppException)/catch(Exception)`，分别返回 `e.code/info` 或 `UN_ERROR.code/info`。
4. `Response<T>` 只包含 code、info、data，使用 Lombok `@Builder` 组装；参考工程源码中**没有全局 `GlobalExceptionHandler`**。

```java
try {
    MerchantApplicationAggregate application = applicationService.submit(userId, merchantName, key);
    // Response.success builder ...
} catch (AppException e) {
    return Response.<SubmitMerchantApplicationResponseDTO>builder()
            .code(e.getCode()).info(e.getInfo()).build();
} catch (Exception e) {
    log.error("商户入驻申请服务失败", e);
    return Response.<SubmitMerchantApplicationResponseDTO>builder()
            .code(ResponseCode.UN_ERROR.getCode())
            .info(ResponseCode.UN_ERROR.getInfo()).build();
}
```

**在当前项目已删除**：`trigger/http/GlobalExceptionHandler.java` 和原有 `MerchantErrorCodeEnumVO`，不会再引入 `IdempotencyConflictException`。

## 不应忽略的事实

- 官方 Skill 的 `trigger-layer.md` 有一个**可选** `@RestControllerAdvice` 示例，因此该类不是错误的 Spring 技术，只是与用户给出的**具体真实工程**不一致。
- 本项目保留修复过的 `AppException` 构造器 `super(message)`，比参考源码的旧实现对异常日志更友好。
- Controller 内捕获的业务异常默认 HTTP 200；这是一项对前端有影响的协议变更。HTTP 401/JSON 解析失败等仍由过滤器/框架处理，不能说所有错误都统一包装了。
- 如果未来项目更重视 HTTP 4xx/5xx 可观测性，需要单独评审响应契约，而不是不告知前端就改变它。
