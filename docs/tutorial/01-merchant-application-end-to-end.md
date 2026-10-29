# 提交商户申请：从 SQL 到 HTTP 的单接口手写路线

> **历史教学记录，不是R1运行指南。** 当前源码、接口与部署步骤见 [R1运行手册](../operations/R1-runbook.md)；不要把本文件中的旧版本示例复制覆盖当前实现。


> **历史教学记录**：当前已实现数据库 Session 登录。新的启动方法、CSRF 和认证以 [P1-01](../iterations/P1-01-auth-session.md) 为准，不要再次导入旧 Basic 配置。
本教程以**用户上传的 group-buy-market 项目实际风格**为准，区别于先前的全局异常处理版本。请阅读 [真实工程对照](05-group-buy-market-reference-alignment.md)。

## 一、业务规则

- 已认证学生提交商户名称；服务端从 `Principal` 获取用户 ID。
- `Idempotency-Key` 防止重复提交；同一人+同一键+同一内容返回同一申请 ID；换内容返回 `M0001`。
- 申请初始状态 `SUBMITTED`；审核仍由聚合对象控制，禁止自己审批和重复审批。
- 本练习仅开放 dev 环境接口；支付、用户体系和多租户角色鉴权由后续业务用例单独实现。

## 二、完整调用链

```text
POST /api/v1/merchant-applications
  -> Spring Security 认证（dev 环境 Basic）
  -> Trigger：MerchantApplicationController implements IMerchantApplicationApi
  -> Domain Service：MerchantApplicationServiceImpl
  -> Aggregate：MerchantApplicationAggregate.submit()
  -> Domain Repository：IMerchantApplicationRepository
  -> Infrastructure：MerchantApplicationRepository -> IMerchantApplicationDao -> MyBatis XML -> MySQL
  -> Domain Aggregate 转 ResponseDTO -> Response<T>
```

## 三、数据库（先建库，再建表）

SQL 文件：`docs/dev-ops/mysql/sql/01_merchant_application.sql`。

```sql
CREATE DATABASE IF NOT EXISTS campus_shopping
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;
USE campus_shopping;
-- 接下来执行该 SQL 文件中的 CREATE TABLE mer_application ...
```

注意 Spring Boot 配置中的 `spring.datasource.url` 也必须指向 `campus_shopping`；`USE` 只作用于当前 MySQL 会话。

## 四、各层应该敲哪些类

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| Types | `types/enums/ResponseCode` | 通用 `000x` 和商户 `M000x` 错误码 |
| Types | `types/exception/AppException` | 统一业务异常，携带 code/info |
| Domain | `merchant/model/valobj/MerchantApplicationStatusEnumVO` | SUBMITTED/APPROVED/REJECTED |
| Domain | `merchant/model/aggregate/MerchantApplicationAggregate` | submit、approve、reject 和业务不变量 |
| Domain | `merchant/adapter/repository/IMerchantApplicationRepository` | 保存、按用户与幂等键查询 |
| Domain | `merchant/service/MerchantApplicationServiceImpl` | 聚合提交、幂等条件校验；保留手写构造器 |
| Infrastructure | `dao/po/MerchantApplicationPO` | 数据库记录字段 |
| Infrastructure | `dao/IMerchantApplicationDao` | MyBatis 映射接口 |
| Infrastructure | `adapter/repository/MerchantApplicationRepository` | @Repository + @Resource 注入 DAO，完成 PO/聚合转换 |
| App | `resources/mybatis/mapper/merchant_application_mapper.xml` | INSERT/SELECT SQL |
| API | `api/IMerchantApplicationApi` | 对外 Java 方法契约 |
| API | `api/dto/SubmitMerchantApplicationRequestDTO` | Lombok Bean，请求字段 merchantName |
| API | `api/dto/SubmitMerchantApplicationResponseDTO` | Lombok Bean，申请编号、状态 |
| Trigger | `trigger/http/MerchantApplicationController` | 接收 JSON、读取 Principal、try/catch、构建 Response |

## 五、Controller 怎样抛、怎样接

业务错误统一通过 `new AppException(ResponseCode.MERCHANT_REQUEST_CONFLICT)`；Controller 里分别 `catch (AppException)`、`catch (Exception)`。前者返回 e.code/info，后者返回 `0001/未知失败`。参见 [异常约定](02-merchant-exceptions.md)。

```java
@Slf4j
@Profile("dev")
@RestController
@RequestMapping("/api/v1/merchant-applications")
public class MerchantApplicationController implements IMerchantApplicationApi {
    @Resource
    private IMerchantApplicationService applicationService;
    // 完整实现见本工程同名 Java 文件
}
```

这里保留已有 `AppException` 的 `super(message)`，不会盲目复制参考中的旧实现。Spring 3 需要 `jakarta.annotation.Resource`。

## 六、IDEA 调试和验证

在 IDEA 中启动应用，并给 dev Profile 配置好 DB_USERNAME、DB_PASSWORD、DEMO_AUTH_USERNAME、DEMO_AUTH_PASSWORD。示例接口只监听本地地址。

```text
POST http://127.0.0.1:8091/api/v1/merchant-applications
Authorization: Basic（使用本地环境变量配置的凭据）
Content-Type: application/json
Idempotency-Key: demo-001

{"merchantName":"校园水果店"}
```

测试数据：

```sql
USE campus_shopping;
SELECT * FROM mer_application ORDER BY create_time DESC LIMIT 5;
```

构建测试（需要本机安装 JDK 17 和 Maven）：

```sh
mvn -pl campus-shopping-app -am test
```

**验收重点**：重复同键相同内容返回同一申请编号；不同内容收到 HTTP 200、code=M0001；参数非法收到 HTTP 200、code=0002；无认证收到 HTTP 401；JSON 解析异常通常收到 HTTP 400。只有 `code=0000` 才表示业务成功。
