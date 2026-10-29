# 小傅哥 DDD 工程规范与真实 group-buy-market 编码风格对齐

> **R1 对齐说明（2026-10-28）**：本文保留需求来源与历史设计；当前冻结规则以 [R1 实施规格](../specs/RELEASE-01.md) 为准，实际实现/验证状态见 [R1 交付清单](../DELIVERY-R1.md)。历史“下一批/待开发/已通过”描述不作为本次执行证据。

> 文档版本 v1.2 · 2026-10-27 · **工程实现约定**，不是所有功能已实现的声明。  
> 标准来源：用户提供的 `group-buy-market.zip` 实际源码；[xfg-ddd-skills](https://github.com/fuzhengwei/xfg-ddd-skills) 负责分层/依赖规范；校园商城现有源码/POM 决定兼容性。  
> 相关决策：[ADR-012](decisions.md) · [异常响应](../api/error-codes.md) · [HTTP API](../api/http-api.md)。

## 1. 事实与优先级

- **校园商城实际工程**：官方六模块脚手架，JDK 17、Spring Boot 3.4.3。已有独立的开发示例 `MerchantApplicationController`，不等于 P1 注册、审核、商户开通全部完成。
- **参考工程真实代码**：`group-buy-market`（Java 8 / Spring Boot 2.7.12）采用 API 接口 + Trigger 实现、`@Resource` 注入、`AppException` + `ResponseCode` 和 Controller 内 `try/catch`；其实际源码中未发现统一 `GlobalExceptionHandler`。
- **原始 Skill 的要求范围**：`xfg-ddd-skills` 保证限界上下文、Repo/Port 依赖倒置、实体/聚合/VO、Case/Trigger 分工；它**同时给出了** Controller `try/catch` 与 `@RestControllerAdvice` 示例，不规定只有一种异常架构。
- **我们的项目约定**：现阶段优先模仿该参考工程的编码风格，同时保留安全性、领域不变量、Java 17 和 Boot 3 的必要差异。业务规则由 PRD/已接受 ADR 决定，不能靠外部案例覆盖。

## 2. 原六模块与依赖关系

| 模块 | 责任 | 当前参考类/文件 |
|---|---|---|
| `campus-shopping-api` | 对外 Java 接口、RequestDTO、ResponseDTO、`Response<T>` | `IMerchantApplicationApi`、`SubmitMerchantApplicationRequestDTO`、`Response` |
| `campus-shopping-trigger` | 实现 API 接口，接入 HTTP/MQ/Job，处理入口日志和业务响应 | `MerchantApplicationController implements IMerchantApplicationApi` |
| `campus-shopping-domain` | 聚合、Entity/EnumVO、业务规则、Domain Service 和 Repo/Port 抽象 | `MerchantApplicationAggregate`、`IMerchantApplicationService`、`IMerchantApplicationRepository` |
| `campus-shopping-infrastructure` | Repo/Port 适配器、DAO/PO、Gateway | `MerchantApplicationRepository`、`IMerchantApplicationDao` |
| `campus-shopping-types` | 公共异常与响应码 | `AppException`、`ResponseCode` |
| `campus-shopping-app` | 启动、配置、Spring Security、MyBatis XML | `Application`、`mybatis/mapper` |

编译期依赖倒置：`Infrastructure → Domain`；运行时领域服务通过自己声明的 `IRepository` 调用基础设施实现。API 接口不是 Domain Service 接口，二者职责不同。

```text
API: IMerchantApplicationApi + DTO + Response<T>
         ↑ implements
Trigger: MerchantApplicationController
         ↓ calls
Domain: IMerchantApplicationService → Aggregate → IRepository (抽象)
                                              ↑ implements
Infrastructure: MerchantApplicationRepository → I...Dao → MyBatis XML → MySQL
```

原脚手架没有 `campus-shopping-case`；只有审核通过+Owner 授权、订单+库存等真正跨域用例开始时，才引入或选择明确的编排入口，不为简单提交接口空建 Case 模块。

## 3. Spring / Lombok / MyBatis 编码约定

| 组件 | 项目选定写法 | 依据与注意事项 |
|---|---|---|
| Trigger Controller | `@Slf4j @RestController @RequestMapping`；`implements I...Api`；常用 `@Resource` 注入领域服务 | 贴近参考项目；不要复制宽松 `@CrossOrigin("*")` |
| Domain Service | `@Service`，依赖 `I...Repository`；现有商户示例 `private final` + **手写构造器** | Spring 自动注入唯一构造器；可以用 Lombok 简化，但同一个类不要同时手写构造器又标注 `@RequiredArgsConstructor` |
| Infrastructure Repository | `@Repository`；使用 `jakarta.annotation.Resource` 注入非 `final` 的 MyBatis DAO | 与参考项目相近；Spring Boot 3 不能照搬 `javax.annotation.Resource` |
| MyBatis DAO | `@Mapper` 接口，XML 放 App 模块对应 mapper 目录 | SQL/PO 不可渗透到 Domain |
| DTO 和 PO | 需要 JavaBean 时使用 Lombok `@Data @Builder @NoArgsConstructor @AllArgsConstructor` | API 接口对外传输用 DTO，不传 Domain 聚合/数据库 PO |
| Aggregate | 仅开放必要读取与领域行为，按需 `@Getter` | 不能为追求 `@Data` 破坏审核状态不变量 |
| Types | `Response<T>` 为 `code/info/data`，`ResponseCode` 与 `AppException` | 不额外造一套 `MerchantErrorCodeEnumVO` 或 `IdempotencyConflictException` |

## 4. 异常处理约定（当前编码基线）

**当前商户提交示例**沿用 `group-buy-market`：Controller 方法内分别捕获 `AppException` 与 `Exception`，返回 `Response.<DTO>builder()`。

```java
try {
    // 调用领域服务并返回 code=0000、data=DTO
} catch (AppException e) {
    log.warn("商户入驻业务失败 code={} info={}", e.getCode(), e.getInfo());
    return Response.<SubmitMerchantApplicationResponseDTO>builder()
            .code(e.getCode()).info(e.getInfo()).build();
} catch (Exception e) {
    log.error("商户入驻未知异常", e);
    return Response.<SubmitMerchantApplicationResponseDTO>builder()
            .code(ResponseCode.UN_ERROR.getCode())
            .info(ResponseCode.UN_ERROR.getInfo()).build();
}
```

- Domain 的可预期业务失败抛 `AppException`；通用码 + 商户业务码定义在 Types 的 `ResponseCode`；Domain 中的 `EnumVO` 表达审核状态、业务类型/策略。
- **当前示例** Controller 捕获的业务失败通常是 **HTTP 200 且 `code != "0000"`**，不是 HTTP 409；前端必须解析 `code`。此协议选择已通过 ADR-012 记录，不能在未通知调用方的情况下悄悄改变。
- Spring MVC 方法进入**之前**的坏 JSON / 错误方法 / 媒体类型仍可能返回 HTTP 400/405/415；Spring Security 过滤器链的未认证/无权限一般单独返回 401/403。当前不声称这些路径都统一返回 `Response<T>`。
- 对于需要回滚的业务，`@Transactional` 要在 **Case/Service 被 Spring 代理的方法边界**，异常须先穿过事务代理触发回滚，再由 Controller 捕获。不要把事务只加在 Controller 上、在事务内部吞掉异常。
- 参考工程没有 `GlobalExceptionHandler` 是**该具体项目的事实**，不是 Skill 禁止全局 Advice。未来如要全面采用 HTTP 4xx/5xx 与统一安全层响应，应以新的 ADR 同步修改 API、前端与测试。

## 5. 已实现练习与未来完整 P1 的区别

| 事项 | 当前独立商户提交练习 | P1 完整设计（待实现/验收） |
|---|---|---|
| 身份 | `@Profile("dev")`、本地 HTTP Basic 测试主体 | 真实注册/登录、平台管理员与商户权限 |
| 申请请求 | 只包含 `merchantName` 与幂等键 | 经营类别、联系信息、首店位置等更多字段 |
| 商户状态 | 创建 `MerchantApplication`、`SUBMITTED` | 审核后建商户、首店、OWNER 授权、审计 |
| 并发证据 | 独立领域断言与待完成的真实 DB 验证 | MySQL 8 并发/事务完整集成测试 |
| 数据库 | 练习表 `docs/dev-ops/mysql/sql/01_merchant_application.sql` | `docs/database/p1-schema-draft.deprecated.txt` 尚待评审与迁移 |

不能把两份 SQL 不经对比直接在同一个库里重复执行；P1 完整模型与当前练习的数据列不同。对所有 P2–P6 API/领域设计也不能宣称已有代码和生产验收。

## 6. 不变的领域与工程底线

- `domain/{context}/adapter/repository/I...Repository` → `infrastructure/adapter/repository/...Repository` → `infrastructure/dao/I...Dao` + `dao/po/...PO`；禁止把 Repository/DAO 放在 `persistent/`。
- `domain/{context}/adapter/port/I...Port` → `infrastructure/adapter/port/...Port` → `infrastructure/gateway/...GatewayService`。
- 入口只做路由、可信身份获取、参数验证和响应映射；权限检查由可信安全层和业务用例完成，前端的角色字段不可信。
- 新代码用中文解释业务规则，不复制小傅哥原有作者署名，不使用多余的策略/责任链/抽象类。
- 验证结果必须基于真实执行的 Maven/JUnit/MySQL；文档存在或测试代码写完不等于测试通过。


## IAM-01：本地密码存储的分层约定（ADR-013）

- `xfg-ddd-skills/references/port-adapter.md` 明确：Repository 对接 MySQL、Redis、Config 等**本地数据**；Port 对接 HTTP、RPC、WebSocket 等**远程调用**。即使远程服务属于同一家公司，通过网络调用仍符合远程 Port 的分类。
- BCrypt 是进程内密码哈希算法。**不要仅为隐藏技术细节**凭空创建 `IPasswordHasherPort` 或 `BCryptPasswordHasherPort`，它们不属于远程 Gateway。
- 注册领域服务校验参数并创建只含身份、业务状态的 `UserAccountAggregate`；通过 `IUserAccountRepository.save(account, rawPassword)` 传递临时密码。Infrastructure 的本地仓储在执行 MyBatis INSERT **之前**调用 `PasswordEncoder.encode`，数据库只保存 `password_hash`。
- `PasswordEncoderConfig` 位于基础设施配置层，为开发环境 HTTP Basic 测试账号和注册仓储提供同一个 Spring Bean。真正的数据读写只发生在 `adapter/repository/UserAccountRepository` 与 `dao/` 中。
- 以上是**本项目选择的本地凭据存储约定**，不代表通用 DDD 理论禁止所有非远程 Port；避免为了套模式创建额外目录，或者把明文密码放入聚合。
- 不记录明文密码、`RegisterRequestDTO` 全对象或密码摘要。IAM-02 数据库登录、正式限流及 CSRF 防护是独立任务。

