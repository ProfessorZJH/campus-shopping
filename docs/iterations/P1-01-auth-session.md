# P1-01 账号登录与商户申请身份对接

> 状态：代码已实现，完整 Maven、Spring 容器及 MySQL 验证仍待执行。不代表 P1 全部完成或服务已部署。

## 1. 本批范围

以 IAM-01 V3.1 中文工程和 V2.2.1 参考文档为基线，实现 FR-001 的注册、登录、查询当前账号、退出，并让既有商户申请提交使用真实用户 ID。

本批不实现管理员引导创建、入驻审核、首店和 OWNER 授权、商品交易、前端三端或 AI。商户申请仍是只含 merchantName 的轻量提交版，不等于全部 FR-004。

## 2. 已落地的接口

| 方法 | 路径 | 身份 | 说明 |
|---|---|---|---|
| GET | `/api/v1/auth/csrf` | 允许匿名 | 获取 CSRF 令牌，保留同一个 Cookie 会话 |
| POST | `/api/v1/auth/register` | 仅匿名 | 注册普通用户，不自动登录 |
| POST | `/api/v1/auth/login` | 仅匿名 | 数据库凭据校验后建立 Session |
| GET | `/api/v1/auth/me` | 已登录 | 返回 userId/username/displayName/status |
| POST | `/api/v1/auth/logout` | 已登录 | 销毁 Session、认证上下文和 CSRF 令牌 |
| POST | `/api/v1/merchant-applications` | 已登录 | 用 Principal 中的 userId 作为申请人 |

所有 POST 都需要 CSRF 请求头，包括注册和登录。取值来自 `/auth/csrf` 返回的 `data.headerName` 和 `data.token`。登录和退出后需重新获取令牌。切换账号需先退出，不允许已登录用户直接再次登录。

`/api/v1/users/me` 是旧文档草案，本批统一为 `/api/v1/auth/me`，未新增重复路由。当前用户响应不含商户成员列表，因为成员权限尚未实现。

## 3. 分层与实现契约

```text
AuthController implements IAuthApi
UserAccountRepository implements IUserAccountRepository
```

```text
HTTP -> Spring Security -> AuthController -> IUserAccountService
     -> UserAccountServiceImpl -> IUserAccountRepository
     -> UserAccountRepository -> MyBatis DAO/XML -> MySQL
```

API 接口是编译期契约，不是一个先于 Controller 执行的 HTTP 节点。单领域认证不新增 Case 模块。

- 领域服务保留 `@Service`、`final` 字段和手写构造器。
- Controller 使用 `@Slf4j`、`@Resource`，实现 API 接口，保留现有业务异常捕获风格。
- Repository 属于本地账号与凭据存储，继续负责 BCrypt 摘要匹配；不重新引入密码 Port。
- 账号聚合增加受控重建与状态校验，不含密码字段，不开放任意 setter。
- Session 与 CSRF 使用 Spring Security 的现成组件；不自制 JWT、安全令牌算法或第二套异常体系。

## 4. 安全边界

登录先完成凭据校验，再更换会话 ID、设置和保存认证上下文。Principal 只存 userId，凭据为 null，普通用户只获得 `ROLE_USER`。客户端传来的 userId/role 不参与授权。

每次已登录请求都重新读取账号状态。账号被停用或删除时，拦截后续访问并销毁会话；数据库不可用时返回 503，不绕过校验。这不表示一个已进入业务事务的请求可被中途立即取消，后续审批与资金操作需在事务边界内复验权限。

账号不存在和密码错误统一返回 `A0002`。不存在账号时仍执行一次摘要匹配以降低明显时间差异，但不宣称实现了完整的恒定时间响应。

会话默认 30 分钟空闲超时，可用 `SESSION_TIMEOUT` 配置。Cookie 使用 HttpOnly/SameSite=Lax，生产配置启用 Secure。开发默认仅绑定 127.0.0.1。多实例共享会话、限流与登录审计入库仍未实现，不要直接对公网开放本开发版。

## 5. 响应码契约

| 情况 | HTTP | 业务码 |
|---|---|---|
| 成功 | 200 | `0000` |
| 注册用户名重复 | 200 | `A0001` |
| 登录凭据错误 | 200 | `A0002` |
| 登录时账号停用 | 200 | `A0003` |
| 已登录但账号后续停用 | 403 | `A0003` |
| 受保护路由未登录 | 401 | `A0004` |
| CSRF 令牌缺失或失效 | 403 | `A0005` |
| 已登录但无权访问 | 403 | `A0006` |
| 账号复验时数据库异常 | 503 | `0001` |

未登录的 POST 若先缺少 CSRF 令牌，会先收到 403；不应认为所有匿名请求都必须返回 401。非法 JSON 仍由 MVC 返回 400。未新增全局业务异常处理器。

## 6. 本地运行

在项目根目录中使用 JDK 17 和 Maven。新数据库按顺序执行下面两个脚本，都包含 CREATE DATABASE 和 USE：

- `docs/dev-ops/mysql/sql/01_merchant_application.sql`
- `docs/dev-ops/mysql/sql/02_iam_user_registration.sql`

已有数据库先检查字段，不删库、不直接运行全套 P1 草案建表脚本。本批登录功能不要求修改现有两张表的结构。

```powershell
$env:DB_USERNAME = "你的数据库用户"
$env:DB_PASSWORD = "你的数据库密码"
mvn -B -ntp clean verify
java -jar .\campus-shopping-app\target\campus-shopping-app.jar --spring.profiles.active=dev
```

不再需要 `DEMO_AUTH_USERNAME` 或 `DEMO_AUTH_PASSWORD`。运行后在另一终端执行：

```powershell
python .\scripts\smoke-auth.py --base-url http://127.0.0.1:8091
```

该脚本使用 Python 标准库自动保留 Cookie，串起注册、错误密码、登录、CSRF 更新、幂等申请和退出后重放检查。它会在开发库留下一个测试账号和申请，不自动删除数据。

## 7. 真实 MySQL 测试

普通 `mvn verify` 运行单测和 H2 过滤器链测试。真实 MySQL 测试需显式准备专用 `campus_shopping_it` 库和凭据：

```powershell
$env:MYSQL_TEST_URL = "jdbc:mysql://127.0.0.1:3306/campus_shopping_it?useSSL=false&serverTimezone=UTC"
$env:MYSQL_TEST_USERNAME = "测试库用户"
$env:MYSQL_TEST_PASSWORD = "测试库密码"
mvn -B -ntp clean verify
```

测试不连接业务库，只清理自己创建的账号。未设置变量时该类会被跳过，不能把跳过记为通过。附带 GitHub Actions 配置可在 CI 中创建独立 MySQL 容器运行测试，本次未触发任何远程 CI。

## 8. 合并与迁移

使用增量包时，先保存本地 Git 改动，再对照差异合并。需删除旧 `DemoBasicSecurityConfig.java`，不能让两套安全链同时存在。本批未修改你电脑上的文件。

旧演示数据中 `applicant_user_id` 可能存的是内存用户名；新申请使用数据库 UUID。不自动把历史演示数据归给同名新账号，需人工确认后迁移。

## 9. 上游依据和验证

- 项目工程规则：[工程对齐](../architecture/engineering-alignment.md)。
- 本批验证记录：[验证报告](../testing/P1-01-verification.md)。
- Spring Security 显式保存会话上下文：https://docs.spring.io/spring-security/reference/6.5/servlet/authentication/session-management.html
- CSRF 与登录、退出后刷新令牌：https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html

读取上游文档不等于当前工程已完成集成验证。
