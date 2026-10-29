# 与用户上传的 group-buy-market.zip 逐项对照

> **历史教学记录，不是R1运行指南。** 当前源码、接口与部署步骤见 [R1运行手册](../operations/R1-runbook.md)；不要把本文件中的旧版本示例复制覆盖当前实现。


> **历史教学记录**：当前已实现数据库 Session 登录。新的启动方法、CSRF 和认证以 [P1-01](../iterations/P1-01-auth-session.md) 为准，不要再次导入旧 Basic 配置。
## 本次依据是什么？

读取了用户上传的 `group-buy-market.zip` 中的*实际源码*，不是只依据网络博客或 Skill 推断。

主要参考文件（归档内部相对路径）：

- `group-buy-market-types/src/main/java/cn/bugstack/types/exception/AppException.java`
- `group-buy-market-types/src/main/java/cn/bugstack/types/enums/ResponseCode.java`
- `group-buy-market-api/src/main/java/cn/bugstack/api/response/Response.java`
- `group-buy-market-api/src/main/java/cn/bugstack/api/IMarketTradeService.java`
- `group-buy-market-trigger/src/main/java/cn/bugstack/trigger/http/MarketTradeController.java`
- `group-buy-market-trigger/src/main/java/cn/bugstack/trigger/http/MarketIndexController.java`
- `group-buy-market-domain/src/main/java/cn/bugstack/domain/trade/service/lock/TradeLockOrderService.java`
- `group-buy-market-infrastructure/src/main/java/cn/bugstack/infrastructure/adapter/repository/ActivityRepository.java`

## 真实工程事实

| 观察项 | 真实源码证据 | 结论 |
| --- | --- | --- |
| 业务异常 | `types/exception/AppException` 的字段 `code/info` 与 `ResponseCode` 构造器 | 已知业务失败用 AppException |
| 错误码 | `types/enums/ResponseCode` 除通用 0000/0001/0002，还有 E0001/E0101 等领域相关码 | **该项目未拆**每个领域的 ErrorCodeEnumVO |
| 领域 EnumVO | 如 `TradeOrderStatusEnumVO`、`RefundTypeEnumVO` | 主要表示状态、类型、策略；不等于错误码枚举 |
| API/Trigger | `IMarketTradeService` 和 `MarketTradeController implements IMarketTradeService` | API 定义接口，Trigger 实现 |
| Controller 注解 | `@Slf4j @RestController @CrossOrigin("*") @RequestMapping`，`@Resource` 注入 | 我们采用日志、映射和注入，不复制宽松 CORS |
| 异常捕获 | `MarketTradeController` 在请求方法体内部 `catch(AppException)` 和 `catch(Exception)` | 已知业务失败返回其 code/info，未知返回 UN_ERROR |
| 响应结构 | `Response<T>` 是 `@Data @Builder @NoArgsConstructor @AllArgsConstructor` 的 data class | 不使用自定义 Response.fail 工厂也能工作 |
| 全局 Advice | 在该归档的 Java 源码中未找到 `@RestControllerAdvice` / `@ControllerAdvice` | **这份参考工程没有 GlobalExceptionHandler** |
| 协议结果 | Controller 直接 `return Response.builder()...build()` | 已捕获的业务错误通常仍 HTTP 200 |

## 与官方 Skill 并不冲突

`xfg-ddd-skills/SKILL.md` 展示 Controller 内部 try/catch；`references/trigger-layer.md` 同时给出可选的 `GlobalExceptionHandler`。因此**Skill 不强制**只用某一种。

当前用户明确指定本 ZIP 的实际风格，本次选择 Controller 捕获并删除旧 Advice。若将来引入接口安全合规或完整 HTTP 4xx/5xx 契约，可单独提出设计变更，而不是把它错说成“符合作者唯一规范”。

## 有意不照搬的地方

- 参考项目 `Spring Boot 2.7.12 / Java 8` 使用 `javax.annotation.Resource`。校园商城 `Spring Boot 3.4.3 / Java 17` 必须使用 `jakarta.annotation.Resource`。
- 参考项目存在 `@CrossOrigin("*")`：当前商城演示接口有 Basic 认证，不宜不加限制照抄。
- 参考 `AppException` 构造器没有 `super(message)`，因此 `getMessage()` 可能为 null。校园商城保留已经修复的 `super(message)`。
- 参考例子大多 `@Resource` 注入。校园商城既有 `MerchantApplicationServiceImpl` 的 `private final` + 手写构造器符合 Spring，保留以免无必要更改；Trigger 与 Repository 的字段注入对齐参考。
- 用户身份不能从客户端任意提供的 `userId` 获取；本练习始终从后端认证的 `Principal` 获取，不复制参考的用户身份传递方式。
- 未复制完整组队、策略等与此接口无关的额外功能。

## HTTP 行为变化（需要前端注意）

| 场景 | 修订版响应 | 旧版响应 |
| --- | --- | --- |
| 成功申请 | HTTP 200，code=0000 | HTTP 200，code=0000 |
| 业务冲突 | **HTTP 200，code=M0001** | HTTP 409，code=M0001 |
| 参数不合法（Controller 内校验） | HTTP 200，code=0002 | HTTP 400，code=0002 |
| 代码内部未知异常（Controller 内） | HTTP 200，code=0001 | HTTP 500，code=0001 |
| 无效 JSON（Controller 调用前） | 通常 HTTP 400，框架默认错误响应 | 旧 Advice 统一包装 HTTP 400 |
| 未认证 | Spring Security 过滤器返回 401 | 同样是安全过滤器处理 |

**局限**：对监控、HTTP 客户端、网关而言，业务异常返回 HTTP 200 有代价，而且框架绑定异常和业务异常响应形态不完全一致。这是为对照真实项目选择的样式，不应盲目推广到所有生产系统。

## 影响的主要源码

- API DTO 转为 Lombok 类，移除仅为演示需要的 Validation 依赖。
- `GlobalExceptionHandler.java` 删除。
- `MerchantErrorCodeEnumVO.java` 删除；M0001/M0002/M0003 转到 Types `ResponseCode`。
- Controller 加 `@Slf4j`、`@Resource`、局部 try/catch，保留 `@Profile("dev")` 和 API 接口实现。
- 原因明确的 AppException 继续保留业务码；不修改数据库表、事务和 Repository 算法。
- MockMvc 测试改为验证 HTTP200 + 业务码，以及 Spring MVC 未进入 Controller 的无效 JSON 仍返回 HTTP400。
