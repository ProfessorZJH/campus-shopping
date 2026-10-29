# Campus Shopping — 架构决策记录（ADR）

> 版本：v1.0 · 2026-10-26。已接受决策才是开发硬约束；提议中的决策应在对应批次确认。

## ADR-001：官方脚手架与 Skill 为工程规范源

- **状态**：Accepted
- **决定**：以已初始化的 JDK17 `campus-shopping` 官方 Maven 工程为起点。Java DDD 编码命名、分层、仓储与 Port/Case 模式以 [xfg-ddd-skills](https://github.com/fuzhengwei/xfg-ddd-skills) 为规范。不要再次运行创建工程脚本覆盖当前项目。
- **实际工程**：`campus-shopping-api/app/domain/infrastructure/trigger/types` 六模块，`docs/dev-ops/` 保留。现有脚手架不含 Case 模块。
- **进一步规定**：实际出现跨领域审核/交易编排时才增加 `campus-shopping-case` 模块，确保 Maven 依赖无环；简单单域操作不强制建立 Case。接口按 Skill 要求放置，避免重复定义项目私有的一套 DDD 包结构。
- **代价**：本项目的具体业务模型仍需我们自己定义，Skill 不保证业务正确性。

## ADR-002：业务模块化单体 + 单个 MySQL

- **状态**：Accepted
- **决定**：首版采用 Spring Boot JDK17 单体、同一个 MySQL。七个限界上下文是业务与代码边界，不是七个服务或数据库。
- **一致性**：审核开通、订单创建/库存预占、取消/释放、核销/出库在适当的本地事务内协调；核心数据库并发仍需行锁、条件更新、唯一约束和幂等。
- **不选择**：微服务 + 分布式 Saga 作为首版基础；避免为简单毕设引入不必要的分布式故障。
- **例外**：后续服务拆分时重评跨库一致性，不能照搬当前事务假设。

## ADR-003：Python AI 服务独立，但不拥有交易写权限

- **状态**：Accepted
- **决定**：Python FastAPI 处理意图、检索和文本生成；Spring Boot 统一处理权限、推荐 Proposal、购物车、订单和库存。Qdrant 只用于检索投影。
- **边界**：AI 只能提出写操作建议，确认后由 Java 重新校验并执行；绝不直接连接交易数据库执行写 SQL。AI 不可用时普通购物流程不受影响。
- **代价**：要维护 Java↔Python 的超时、鉴权、JSON 契约与失败降级。

## ADR-004：只在需要可靠异步集成时启用 Outbox

- **状态**：Accepted
- **决定**：主业务强一致变更不依赖 MQ。商品索引、通知等如需可靠异步，使用 MySQL Outbox + 周期 Worker + 幂等消费；首版不要求 Kafka、RocketMQ 或 Temporal。
- **条件**：真的出现“业务事务提交后必须可靠通知另一个模块”时才引入 Outbox，不能给所有事件风暴节点建消息表。

## ADR-005：P1 身份会话方案

- **状态**：Proposed，P1 编码前需确认
- **建议**：首版使用 Spring Security 的服务端 Session + HttpOnly Cookie；前端统一经同源反向代理访问 API。单实例演示可用默认会话存储；跨实例或持久会话需求出现后再引入共享 Session 存储。
- **原因**：无需提前引入 Redis/JWT 撤销列表，退出登录、失效会话和 CSRF 保护已有成熟框架支持。
- **边界**：如果采用 Cookie 会话，启用 CSRF 防护、Secure（HTTPS 时）、SameSite、合理失效时间；每次敏感写操作仍重新验证账号状态和商户成员权限。
- **备选**：短效 JWT + 明确撤销与轮换策略。未经确认不要同时混用两套登录架构。

## ADR-006：P1 商户审核提交与开通同事务

- **状态**：Accepted（业务一致性）；具体事务实现 P1 设计
- **决定**：平台审核通过、生成商户、生成首个门店、授予申请人 Owner、记录审核决定在一个 MySQL 本地事务完成。
- **幂等**：申请 ID 关联唯一商户；重复通过请求返回已存在的商户结果，不重复创建；审核状态只能从 `SUBMITTED` 进入 `APPROVED` 或 `REJECTED`。
- **边界**：管理员身份来自可信认证主体，不从请求体获取；审核员不能审自己的申请；审计留痕。

## ADR-007：第一版权限划分

- **状态**：Accepted（角色范围）；具体邀请机制 P1 确认
- **决定**：平台角色 `PLATFORM_ADMIN` 与商户成员角色 `OWNER`、`CLERK` 分开。用户可以在多商户拥有不同角色，所有商户敏感写操作按 `userId + merchantId + permission` 校验。
- **禁止**：用 JWT / 前端 `role=OWNER` 字段直接视为跨商户授权；客户端任意传 `userId` 指定授权主体。

## ADR-008：全局文档完整覆盖，代码按阶段交付

- **状态**：Accepted
- **决定**：PRD、业务架构与七个上下文的详细设计草案都纳入 Git；但仅 Identity / Merchant 在 P1 优先进入实现与数据库迁移。其他五个领域已形成完整的设计候选，仍需在对应开发批次前评审、冻结开放决策并完成实际测试。
- **原则**：不靠生成大量接口、策略、责任链或空目录表演 DDD。必要模式以具体业务变化点为依据。


## ADR-009：官方 Skill 是工程规范，不代替业务契约

- **状态**：Accepted
- **决定**：小傅哥 `xfg-ddd-skills` 约束 Java 工程目录、依赖倒置、仓储/端口、Case/Trigger、中文业务注释；本仓库 PRD/领域文档定义特定业务所有权、订单状态、交易一致性和 AI 权限。
- **优先级**：遇到示例与明确业务不变量冲突时先记录差异并评审，不能直接照搬示例放弃一致性要求。
- **实际工程**：保留原生六个 Maven 模块及 `docs/dev-ops`，需要跨域 Case 时再新增模块。

## ADR-010：订单与库存强一致不采用先建单后异步预占

- **状态**：Accepted
- **决定**：订单创建+全 SKU 预占、关单+释放、核销+出库、退款+业务状态变更采用单 MySQL 本地事务，统一锁/幂等策略。
- **理由**：不能留下无库存却可支付的订单或退款又核销成功的状态；当前单库具备原子事务条件。
- **区别**：商品索引与消息通知可以最终一致，但它们不决定关键交易事实。

## ADR-011：完整项目文档纳入 Git，实施证据分阶段累积

- **状态**：Accepted
- **决定**：PRD、七域设计、上下文图、API、数据库逻辑模型、事务策略、测试矩阵与 AI 评测方案纳入 `docs/`；每批仅迁移和实现真正到期的领域。
- **约束**：文档用 `设计稿/Proposed/Accepted/NOT_RUN` 明确状态，不能因为设计文档齐全就声称功能已实现。

## ADR-012：采用真实 group-buy-market 的 API、注解和业务异常风格

- **状态**：Accepted（**工程编码基线**；不改变既有业务需求和权限规则） · 2026-10-27
- **背景**：用户提供了 `group-buy-market.zip` 源码，发现此前技术文档中的 ControllerAdvice、领域错误码 EnumVO、HTTP 409 和 `Response.success` 字段等与实际参考源码及当前校园商城示例不一致。
- **决定**：API 模块定义 `I...Api`、请求/响应 DTO；Trigger Controller 实现 API 接口，使用 `@Slf4j @RestController @RequestMapping`，优先参考 `@Resource` 业务依赖注入；Domain Service 保留当前手写 `final` 构造器，Infra Repository 注入 MyBatis DAO 使用 Boot 3 的 `jakarta.annotation.Resource`。PO/DTO 使用 Lombok；聚合只开放合法领域操作。
- **异常/响应**：当前采用 `AppException` + Types `ResponseCode` + `Response<T>(code/info/data)`；按真实案例在 Controller 捕获业务和未知异常。不引入 `GlobalExceptionHandler`、`MerchantErrorCodeEnumVO` 或 `IdempotencyConflictException`。**已捕获的业务异常一般 HTTP 200 + 非 `0000` 业务码**，客户端不得单独以 HTTP 200 判断成功；事务异常必须穿过 Service/Case 的事务边界。认证过滤器和 Spring MVC 入参绑定错误不受 Controller 的 try/catch 覆盖，需在实施真实登录/权限时专项验证。
- **覆盖范围**：这是一条 P1 商户申请练习以及后续新增接口的**默认编码风格**，不是声明 P1~P6 已实现。未来如果决定采用全站规范 HTTP 4xx/5xx 和全局 Advice，需要单独新增 ADR，更新 API、前端、测试，而不是静默变更。
- **不照搬之处**：参考仓库 Java 8 / Boot 2.7 的 `javax.annotation.Resource` 改用 `jakarta.annotation.Resource`；不照搬开放 CORS、默认密码、弱日志等不安全做法。保留我们对 `AppException` 继承类 `super(message)` 的修复。
- **代价**：业务失败 HTTP 200 对 API 可观测性、网关重试与标准 HTTP 语义有代价，必须检查响应体 `code` 并做业务码监控。该权衡是本项目明确选择的参考风格，不声称为所有 DDD 工程的最佳实践。


## ADR-013：用户注册的本地密码哈希与 Repository / Port 边界

- **状态**：已接受，2026-10-27；属于 IAM-01 的工程实现约定。依据 `xfg-ddd-skills` 2.2.4 的 `references/port-adapter.md`、`references/repository.md` 和 `references/infrastructure-layer.md`。
- **背景**：先前将进程内的 BCrypt 密码哈希误放入 `IPasswordHasherPort → BCryptPasswordHasherPort`，与本套 Skill 使用 Port 表示远程服务的分类不符。问题出在工程分类，而非 Spring 的依赖注入能力。
- **决策**：Repository 负责本地数据访问；Port 负责远程 HTTP、RPC、WebSocket 调用。IAM-01 由 Domain 校验用户名、密码并创建不含密码字段的账号聚合，再调用 `IUserAccountRepository.save(account, rawPassword)`。Infrastructure 的 `UserAccountRepository` 在构造 `UserAccountPO` 前使用 BCrypt 生成密码摘要，只将摘要写入 `iam_user.password_hash`。
- **实现边界**：`infrastructure/config/PasswordEncoderConfig` 统一声明 `PasswordEncoder` 的 Spring Bean，供注册流程和开发环境的 HTTP Basic 测试账号复用。不新增 Case 或远程 Gateway；Domain 不依赖 Spring Security Crypto 或 MyBatis。
- **安全约束**：原始密码只作临时参数，不允许写入聚合、字段、日志、缓存、消息队列或接口响应。Domain 在持久化前校验 BCrypt 的 72 字节输入上限；MySQL 唯一索引防止并发创建重复用户名。IAM-02 登录、正式权限体系与生产安全控制仍未实现。
- **权衡**：本方案将密码安全存储与本地仓储适配器放在一起，是本项目的明确选择；其他六边形架构可以用更宽泛的 Port 抽象表达密码技术能力，但我们不把这种选择强加到小傅哥的具体命名规范上。

## 决策维护要求

新 ADR 追加编号、日期、状态、背景、选项、结论、后果。若推翻已接受 ADR，不直接篡改历史，应新增替代 ADR 并说明迁移影响和测试证据。


## ADR-014：P1-01 数据库认证与 Cookie Session

- **状态**：本批开发默认已采用，集成和生产安全验证待完成；不声称用户已逐项批准生产策略。
- **选择**：实现 ADR-005 提出的 Session 方案，超时默认 30 分钟可配置。不引入 Redis、JWT 或外部认证服务。
- **安全**：显式保存 SecurityContext，登录换会话 ID，登录/退出刷新 CSRF，账号停用后拦截后续请求。
- **保持**：BCrypt 摘要生成与匹配仍在本地 Repository（ADR-013），不增加密码 Port。
- **兼容**：删除旧演示 Basic 配置，主体从用户名改为 userId；历史演示申请不自动重新归属。
- **限制**：单实例内存 Session，重启需重登；登录限流、审计落库、商户成员授权与生产安全评审仍需后续完成。


## ADR-015：完整交付规格与事务闭环

状态：本轮用户授权下选定的实施默认值。完整约束见 [R1 规格](../specs/RELEASE-01.md)。核心交易不使用远程调用参与本地数据库事务；跨域用例增加 Case 模块。模板中的旧 JDK8 JVM 参数与未使用依赖移除。前端 Vue3 自托管，无公网 CDN 依赖。不能把实现默认值、测试替身或候选文档视为生产验收。


## ADR-016：R1当前契约与验证门禁

- 日期：2026-10-28；状态：本轮实现决定，测试状态见验证报告。
- 旧多版本教程、P1候选API/DDL不能同时成为开发依据；以R1规格、从代码核对的API、app/resources/schema.sql为唯一运行基线，历史资料保留但明确废弃状态。
- 保留小傅哥七层职责与当前项目注解/异常约定，不为了运行演示换成Python交易后端。
- 单实例同库强一致解决首版交易；实时价格/库存不得由AI检索结果决定。
- AI本版返回完整JSON，SSE属于可选后续体验；没有伪造流式输出。知识检索支持真实模型与Qdrant配置，但无凭据时显式本地演示。
- 真实Java依赖和MySQL不可用时，不以语法解析、接口替身、H2或人工展开注解冒充生产栈验证。CI与本地真实验收脚本只在执行后记录PASS。
- 生产发布门禁仍包含完整构建、真实数据库竞争、浏览器联调、依赖安全、真实模型与备份恢复；本次尚未通过这些门禁。