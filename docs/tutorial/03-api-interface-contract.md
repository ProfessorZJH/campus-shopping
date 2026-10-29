# API 接口与 Trigger HTTP 实现

> **历史教学记录，不是R1运行指南。** 当前源码、接口与部署步骤见 [R1运行手册](../operations/R1-runbook.md)；不要把本文件中的旧版本示例复制覆盖当前实现。


用户上传的 `group-buy-market` 实际采用：

```text
group-buy-market-api/.../IMarketTradeService.java
group-buy-market-trigger/.../MarketTradeController.java implements IMarketTradeService
```

校园商城对应：

```text
campus-shopping-api/.../IMerchantApplicationApi.java
campus-shopping-trigger/.../MerchantApplicationController.java implements IMerchantApplicationApi
```

API 层负责方法输入输出签名，Trigger 负责 `@RequestMapping`、`@RequestBody`、`@Resource` 等 Spring HTTP 实现注解；Domain Service 负责业务，不能与 API 接口混为一谈。

```java
// API 层，只定义 Java 方法签名
public interface IMerchantApplicationApi {
    Response<SubmitMerchantApplicationResponseDTO> submit(
            SubmitMerchantApplicationRequestDTO request,
            String idempotencyKey,
            Principal principal);
}
```

```java
// Trigger 层定义 HTTP 路由并实现接口
@Slf4j
@Profile("dev")
@RestController
@RequestMapping("/api/v1/merchant-applications")
public class MerchantApplicationController implements IMerchantApplicationApi {
    @Resource
    private IMerchantApplicationService applicationService;
    @Override
    @RequestMapping(method = RequestMethod.POST)
    public Response<SubmitMerchantApplicationResponseDTO> submit(
            @RequestBody SubmitMerchantApplicationRequestDTO request,
            @RequestHeader(value="Idempotency-Key", required=false) String idempotencyKey,
            Principal principal) {
        // 见完整实现；按参考工程风格 try/catch 返回 Response
        return null;
    }
}
```

该片段仅用于说明注解与依赖位置，不可当作可以直接复制运行的完整实现。请使用实际源码中的 Controller。

`@CrossOrigin("*")` 虽出现在参考工程，但不代表必须复制到使用认证的商城接口。`jakarta.annotation.Resource` 是 Spring Boot 3 的兼容写法。
