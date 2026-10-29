# 测试策略、测试环境与质量门槛

> **R1 对齐说明（2026-10-28）**：本文保留需求来源与历史设计；当前冻结规则以 [R1 实施规格](../specs/RELEASE-01.md) 为准，实际实现/验证状态见 [R1 交付清单](../DELIVERY-R1.md)。历史“下一批/待开发/已通过”描述不作为本次执行证据。

> 版本 v1.1 · 2026-10-27 · **计划/验收规范，非测试结果**。真实通过记录必须来自实际代码运行。  
> 参照 `xfg-ddd-skills` 的 Domain、Case、Infrastructure、Trigger 分层组织测试。

## 1. 测试金字塔

| 层次 | 目标 | 技术/范围 | 不允许替代的能力 |
|---|---|---|---|
| Domain 单元 | 聚合状态机、值对象校验、不变量 | JUnit 5，不启动 Spring、不依赖 MySQL | 不能证明事务并发 |
| Case 集成 | 跨域调用顺序、回滚、幂等、状态竞争 | Spring Boot Test + MySQL 8（可用 Testcontainers） | 不能只用 Fake Repository |
| Infrastructure 集成 | MyBatis SQL、PO/Domain 映射、唯一键、锁行为 | 实际 MySQL 8 与事务隔离级别 | H2 结果不能当 MySQL 竞争证据 |
| HTTP/权限 | API 接口实现、请求 DTO、认证、授权、异常码、跨商户隔离 | MockMvc/真实 HTTP + 已授权 Fixture | **业务成功要断言 `code==0000`，不能只看 HTTP 200**；安全过滤器和 MVC 绑定错误分开测 |
| AI Port 契约 | 超时、错误映射、结构化响应和鉴权 | 固定 Fake、契约模拟、有限真实模型测试 | 不能只看 LLM 文本主观评价 |
| E2E | 三端实际用户链路与回归 | 浏览器/API + 独立测试库 | 不能只看接口 200 |
| AI 评测 | 商品 Recall@K、约束满足、证据和权限 | 固定评测集 + 真实索引/模型版本 | 不能填写不存在的数据 |

## 2. P0 工程基线

- `java -version` 必须为 JDK17；`mvn -version` 使用同一 JDK17；检查 Spring Boot 3.4.x 与实际 POM 依赖。
- `mvn clean verify` 不能被默认 `skipTests=true` 绕过；检查 Maven Surefire/Failsafe 版本与测试发现情况。
- 不照抄官方模板中的默认 MySQL 密码和旧 JDBC 配置，开发机环境变量注入凭据。
- 原 `.mvn/` 与 `docs/dev-ops/` 保留；项目实际配置与本设计差异应记录 Issue/ADR。

## 3. 结构化测试 Fixture

| Fixture | 初始状态 | 主要目的 |
|---|---|---|
| userA / userB | 普通用户 | 隔离自己的订单和会话 |
| adminA / adminB | 受控平台管理员 | 并发审核、不能自审 |
| merchantA / merchantB | 两个独立已开通商户 | 全站跨租户隔离 |
| storeA / storeB | 每商户一门店 | 不同店库存隔离 |
| skuA | 库存 onHand=1 reserved=0 | 最后一件并发下单 |
| skuB | 有效 SKU、报价已改变 | 提交时变价 |
| pickupA | READY_PICKUP、凭证有效 | 核销/退款竞争 |
| proposalA | 属 userA、PENDING | 过期、跨用户、重复确认 |
| internalDocA | MERCHANT_INTERNAL | RAG 泄漏验证 |

Fixture 不使用生产数据库和提交到仓库的固定管理员密码；测试账号/密码临时创建、执行后清理或隔离销毁。

## 4. 架构规则（静态检查）

1. Domain 不依赖 Infrastructure/Trigger/Case、MyBatis Mapper 或数据库 PO。
2. Infrastructure 的 Repository/Port 实现位于小傅哥指定的 `adapter/repository`、`adapter/port`，下游为 `dao`/`gateway`。
3. Case 不直接注入 Mapper/DAO/PO，不跨域写别人的数据库表。
4. API 定义接口，Trigger Controller `implements I...Api`，请求 DTO 不进入领域聚合方法作为持续领域状态；PO 不外泄给 API。
5. Java 业务行为有中文领域注释，明确关键状态前置条件；不使用注释代替测试。

可使用 ArchUnit/构建脚本实现检查；**静态检查不证明并发和事务正确**。

## 4.1 当前商户申请 HTTP 响应契约（仅 dev 练习）

- 成功：HTTP 200，`code=0000`，`data.applicationId` 与 `data.status=SUBMITTED`。
- 同人同键同载荷：返回相同 ID，不重复入库；同键不同载荷：HTTP 200、`code=M0001`，原记录不变。
- 入参校验失败：HTTP 200、`code=0002`；未知 Controller 内异常：HTTP 200、`code=0001`；日志记录异常原因但不泄漏 SQL/堆栈。
- 无效 JSON/错误 HTTP 方法通过 MVC 抛出相应 HTTP 4xx；未认证通过 Spring Security 拒绝，不能指望 Controller 的 try/catch 包装它们。
- 领域单元测试和 MockMvc 测试不足以证明真实 MySQL 并发唯一性；完整 P1 审核仍需要独立事务及权限集成测试。

## 5. 不可跳过的并发测试

| 测试 | 操作 | 正确结果 |
|---|---|---|
| 审核竞争 | adminA 审通过、adminB 审驳回同申请 | 只有一种结果成功，唯一商户/Owner 或仅拒绝 |
| 多 SKU 预占 | 前 SKU 成功，最后 SKU 库存不足 | 全部事务回滚，订单不存在 |
| 最后一件库存 | 两买家同时买唯一库存 | 最多一单预占成功 |
| 支付 vs 过期 | 到期瞬间支付与 Job 关闭 | 支付/取消只能一边成功，余额一致 |
| 退款 vs 核销 | 退款审核与有效提货核销同时发生 | 不得同时 REFUNDED 与 COMPLETED |
| Proposal 确认 | 相同建议多次/并发点击确认 | 最多一次加购效果 |
| 事件重复投递 | OrderPaid 重复消费 | 一张 PickupTask，重复不会二次插入 |

使用真实 MySQL，至少记录线程/事务/隔离级别、重复次数、最终数据库状态；只有运行后才填写“通过”。

## 6. 安全测试

- 匿名和普通账号不能调用平台审核，平台管理员也不能审自己申请。
- 同用户商户 A Owner 与商户 B Clerk 的权限没有蔓延。
- 任何接口仅传别人的 `merchantId/orderId/conversationId` 都不能拿到其私有内容。
- 自提码被重复、爆破或跨商户使用均拒绝，错误信息不暴露秘密。
- 公开 RAG 检索不返回内部知识标题、片段、URL、文档 ID；提示注入无法诱导写命令。
- 生产日志不泄漏密码、Cookie、LLM 密钥、自提明文、内部文档。

## 7. CI 与交付证据

建议 CI 执行编译、静态检查、Domain 单测、MySQL 集成测试（可使用 Testcontainers）和代码风格检查。每一批应保留：commit SHA、测试命令、测试用例数、通过/失败记录、MySQL 版本、修复后的复测结果。部署验证另见 [运维检查单](../operations/deployment-checklist.md)。

### 质量门槛

- 开发阶段功能必须具有最小纵向 API、事务测试和业务验收，不以空类/空模块作为进度。
- 已知高优先级并发/越权问题不能以“本地先跑起来”作为完成理由。
- AI 指标必须引用固定数据集的真实运行结果；任何数字未测则写“待测”。

## 8. 各批验收的入口

P1：[身份商户验收](../domains/P1-acceptance.md)；P2～P6：[全业务 E2E 验收](e2e-acceptance.md)。每个测试需求均对应 FR ID，映射在 [追踪矩阵](../TRACEABILITY.md)。

## IAM-01：Repository / Port 分类与注册测试（ADR-013）

- **Domain 单元测试**：验证用户名规范化、密码长度、业务错误码，以及账号聚合初始为 `ACTIVE` 且不含任何密码字段。模拟仓储只接收临时密码方法参数。
- **Infrastructure 单元测试**：注入模拟 `IUserAccountDao` 和真实 `PasswordEncoder`，捕获传给 `insert` 的 PO，确认 `passwordHash != rawPassword` 且 BCrypt `matches(...)` 通过；同时验证唯一键异常转换和其他唯一键错误不会被误报。
- **Spring MVC 单独测试**：确认 `AuthController implements IAuthApi`、响应不含凭据字段、业务错误码正确以及无效 JSON 被拒绝。
- **仍待本地运行验证**：完整 Maven 测试、真实 MySQL 并发用户名唯一索引、开发安全过滤器中的匿名注册 POST，以及正式限流与 CSRF。
