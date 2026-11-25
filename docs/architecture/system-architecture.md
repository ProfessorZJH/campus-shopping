# 系统总体技术架构与部署分工

> **当前对齐说明（2026-11-21）**：本文描述现行业务与技术边界；部署与外部依赖状态见[当前路线](../ROADMAP.md)，实现事实以源码和当前契约为准。

> 版本 v1.1 · 2026-11-21 · **主线架构已实现，生产部署仍单独验收**。
> Java DDD 实现细节服从 `xfg-ddd-skills`；系统业务约束来自 [PRD](../requirements/PRD.md)、[业务架构](business-architecture.md)。

## 1. 总体系统边界

```mermaid
flowchart TB
    Consumer[消费者 Vue 前端]
    Merchant[商户 Vue 前端]
    Admin[平台管理 Vue 前端]
    Reverse[HTTPS 反向代理 / 同源 API]
    Java[Spring Boot JDK17 模块化单体]
    MySQL[(MySQL 8 业务主数据库)]
    Python[Python FastAPI AI 引擎]
    Vectors[(Milvus 商品投影 / Qdrant 知识投影，可选)]
    LLM[模型推理/Embedding 服务]
    FS[文件存储]
    Consumer --> Reverse
    Merchant --> Reverse
    Admin --> Reverse
    Reverse --> Java
    Java --> MySQL
    Java -->|有鉴权的 Port/Gateway| Python
    Python --> Vectors
    Python --> LLM
    Java --> FS
    Python -.-> FS
```

**关键原则：** 交易权威在 Java + MySQL；AI 只读候选和生成建议；实际状态改变走可信 Java 应用入口。全站所有用户、商户权限在服务端判定，不因请求来自管理员前端就默认放行。

## 2. Java 七模块

| 模块 | 源码职责 | 典型类/目录 |
|---|---|---|
| `campus-shopping-api` | 对外 Java 接口、DTO 与 `Response<T>` | `IxxxApi`, `XxxRequestDTO`, `XxxResponseDTO` |
| `campus-shopping-app` | Spring Boot 启动、配置、MyBatis XML | `Application`, `application-*.yml` |
| `campus-shopping-case` | 跨域事务、锁序、幂等与用例编排 | `cases/{context}` |
| `campus-shopping-domain` | 各领域聚合、VO、领域服务、Repository/Port 接口 | `domain/{context}/model/...`, `adapter/repository`, `adapter/port` |
| `campus-shopping-infrastructure` | Repo/Port 实现、DAO、PO、HTTP Gateway | `adapter/repository`, `adapter/port`, `dao/po`, `gateway` |
| `campus-shopping-trigger` | REST、定时任务、事件入口；HTTP Controller 实现 API 接口 | `trigger/http`, `trigger/job` |
| `campus-shopping-types` | 必要公共异常、结果码、基础类型 | `exception`, `enums` |

`campus-shopping-case` 已用于审核开通、结算/支付、核销、退款和 AI 提案确认等跨域流程；Case 只编排公开能力，不直接操作其他域的 DAO/PO。

## 3. 依赖倒置与六边形调用链

```mermaid
flowchart TB
    Trigger[Trigger Controller / Job]
    Case[Case 跨域流程编排]
    Service[Domain Service]
    Aggregate[Aggregate / Entity / VO]
    Repo[IRepository / IPort 领域接口]
    Adapter[Infrastructure Adapter]
    Dao[DAO / PO / Gateway]
    Tech[(MySQL / Redis / HTTP / 可选向量投影)]
    Trigger --> Case
    Case --> Service
    Service --> Aggregate
    Service --> Repo
    Adapter -.->|implements| Repo
    Adapter --> Dao
    Dao --> Tech
```

**API 契约与实现**：`campus-shopping-api` 中定义 `IMerchantApplicationApi`，`campus-shopping-trigger` 中的 `MerchantApplicationController implements IMerchantApplicationApi`；Trigger 用 `@RestController` 暴露路由。该接口定义不等同 Domain Service 接口。

依赖倒置的**编译时方向**是 `Infrastructure → Domain`。运行时调用从领域服务通过接口落到具体适配器，但 Domain 源码从不 import 基础设施实现。HTTP DTO 与数据库 PO 不进入领域聚合。

## 4. 数据与一致性设计

- 一个 MySQL 业务库，按上下文拥有自己的表和持久化职责。
- 订单创建/库存预占、关单/释放、核销/出库、未提货退款采用本地事务强一致性。
- 对外可靠异步通知可使用 MySQL Outbox + Worker，不预设消息队列。
- 商品搜索、知识向量、运营报表是可重建的**读模型或投影**；不能用它们判断最终可支付/可售。
- 库存不可负、单订单唯一商户、商户数据隔离、Proposal 必须用户确认是全项目硬约束。

## 5. Python AI 体系

Python FastAPI 承担 Query 改写、关键词+向量检索、RRF、Rerank 和 LLM 回答生成。Java 维持 AI 会话权限、可信 SKU/库存报价和 Proposal 状态。知识库上传、索引、发布具备业务版本管理，不因外部 Embedding 失败损坏知识主数据。

## 6. 非功能设计

| 质量属性 | 架构措施 | 验证 |
|---|---|---|
| 安全 | 权限以身份+商户范围校验，Secrets 环境隔离，防提示注入 | 越权和资料泄露测试 |
| 正确性 | 强一致事务、条件库存更新、唯一键、幂等请求 | MySQL 并发/回滚集成测试 |
| 可维护性 | 上下文数据所有权、依赖倒置、Skill 注释和命名 | ArchUnit/代码审查 |
| 可扩展 | 单体先闭环；外部 LLM 通过 Port 替换 | Gateway 契约测试 |
| 可观测性 | correlationId、审计、失败状态与必要 Trace | 故障注入/日志核对 |
| 体验 | SSE、可解释推荐卡、明确确认/重试状态 | 前端 E2E 测试 |

## 7. 当前实施事实

七模块 Java、Python FastAPI、Vue 三端、MySQL 与 Redis 共享状态均已形成主线实现；Milvus/Qdrant 是可选投影，生产部署、持续负载和真实供应商质量仍按[当前路线](../ROADMAP.md)单独验收。
