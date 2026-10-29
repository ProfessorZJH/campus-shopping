# PR3 · 其余限界上下文职责核对与必要拆分

## 结论

逐项核对七个限界上下文的领域服务、聚合、仓储及跨域用例，**不以接口数量或 Java 文件行数作为拆分条件**。

| 上下文 | 审查结论 | 本 PR 处理 |
| --- | --- | --- |
| Trading | PR2 已拆 Cart、Order、AfterSale，保留订单行锁和事务协同 | 不再修改 |
| Identity | Access 同时做成员邀请、权限复权、角色 CRUD/成员角色变更 | **拆出 IRoleService/IRoleRepository**，Access 保留成员身份、实时鉴权、审计 |
| Merchant | 入驻审核聚合与商户经营服务已分开；审批开店由 MerchantAdmissionCase 事务编排 | 保留 |
| Catalog | CatalogRepository 混合 MyBatis 商品记录与磁盘图片解码/保存 | **独立 IProductImageRepository/ProductImageRepository**，保留 CatalogService 公开上传能力 |
| Inventory | StockBalanceAggregate 维护 onHand/reserved；预占/释放/消耗同一库存一致性边界 | 保留 |
| Fulfillment | PickupAggregate 覆盖准备、单次凭证签发与核销；订单/库存跨域动作由 Case 完成 | 保留 |
| ShoppingAI | IAiStateService/IAiRepository 同时管知识版本、会话和商品提案 | **拆为知识、会话、提案三组 Service + Repository**，仍在 ShoppingAI 限界上下文 |

以上是**源码结构评审结论**，不等于对业务所有边界的形式化证明；是否可交付仍必须经真实 MySQL、Spring、HTTP 与浏览器回归。

## Identity 的职责与安全边界

- `IAccessService`：可信用户身份状态、商户成员关系、实时权限复验、邀请与审计。
- `IRoleService`：角色新增/更新/删除、权限依赖集合校验、给成员分配角色。
- `IRoleRepository`：本地角色定义与权限关系；`IAccessRepository` 只维护成员授权事实、邀请与审计。
- 自定义角色码仍为数据库动态编码，不能改为固定 enum。角色禁授权 `role.manage` 和 Owner 独占权限的规则保留。
- `RoleServiceImpl` 通过 `IAccessService.requirePermission` 复用现有身份授权，**不复制当前登录人的角色快照**；撤权下一次访问立即生效。
- `IAccessDao` 的 SQL namespace 暂时不拆，纯持久化适配不引入新的业务职责。

## ShoppingAI 的职责与一致性边界

- `IKnowledgeStateService / IKnowledgeRepository`：知识库元数据、文档版本、索引准备状态、发布/撤回指针。
- `IConversationStateService / IConversationRepository`：会话归属、消息与历史记录；`appendTurn` 同时通过 `IProposalRepository` 将**两条消息及可选提案**在一个 Spring 数据库事务内提交。
- `IProposalStateService / IProposalRepository`：本人提案查询、确认状态写入、拒绝状态转换。外层 `ShoppingAiCaseImpl` 负责复权、报价、库存与事务内加购。
- 外部大模型、Milvus/Qdrant 仍仅经 `IAiEnginePort`，不得让 Repository 直接调用远程 API；发布知识前后的实时权限复验仍由 KnowledgeCase 与 ShoppingAiCase 控制。
- `IAiDao` 及表结构继续使用现有 SQL，防止大规模无关迁移。

## Catalog 图片存储

- 之前 `CatalogRepository` 同时进行 SQL 查询和图片解码、格式规范化、文件写入；现在交给 `ProductImageRepository`。
- 保留原 2MB 大小上限、1200 万像素上限、PNG 重编码和 `/media/{id}.png` URL 契约。没有改变上传接口、文件名规则或数据库字段。
- 商品、SKU、类目均在原 Catalog 范围内；简单类目 CRUD 不需要另造一套专属 Service/Repo。

## API / 事务 / 数据库

- **无 DDL**，不改动 HTTP 路径、DTO 或状态字符串。
- 角色 CRUD 原有事务一致性保留。
- 提案确认仍由 Case 单事务协调：本人提案复核 → 购物车锁 → 商户锁 → SKU/库存复验 → 加购 → 提案确认状态写入。
- 知识库版本在短数据库事务内切换，不允许用向量索引直接决定权限。
- 保留真实 MySQL 归属、权限撤销、角色跨商户隔离和 AI 提案确认测试；另新增提案重复主键导致整轮消息回滚的 MySQL 集成测试。

## 验收与后续批次

执行 `mvn -B -ntp clean verify`，再运行 CI 的纯领域规则、Python 本地测试、真实 Spring/MySQL/FastAPI HTTP 及 Chromium。仅在全部工作流成功后合并。

**后续 PR4 才统一处理代码格式、必要中文业务注释及文档历史验收状态漂移。** 不把格式化差异混入跨领域职责变更，也不对 Merchant/Inventory/Fulfillment 做形式主义拆分。
