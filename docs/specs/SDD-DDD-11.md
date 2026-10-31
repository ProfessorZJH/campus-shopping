# SDD-11：枚举、异常与领域能力收敛

日期：2026-10-29。对应 [DDD 审查 D01–D12](../architecture/DDD-REVIEW-20261029.md)。实现与真实验证结果见 [本轮验收](../testing/DDD-REFACTOR-20261029.md)。

## 兼容边界

保留 Java 17、Spring Boot 3.4.3、MyBatis、七领域模块化单体和 Case 本地事务。93 条对外路由、已有业务码编号、数据库状态字符串与 HTTP 成功/失败信封保持兼容。本轮没有新增表、修改已有业务库或执行生产迁移。

新增 `T0005` 表达购物车同规格累计数量上限、`T0006` 表达购物车行数上限、`F0003` 表达自提状态冲突。已有 `T0001` 继续表示订单状态冲突。客户端仍通过 `code/info` 显示失败原因。

## 状态与响应契约

Order、Product、Pickup、Proposal 聚合内部保存对应 EnumVO；持久化与协议快照仍使用既有字符串，并在重建时校验合法状态。库存预占、流水、商户、成员、邀请、知识及消息角色的快照也有枚举校验。未知持久化状态是内部数据问题；客户端非法状态筛选在领域服务返回 `0002`，不得进入 SQL。

固定的 15 个商户权限由 `MerchantPermissionEnumVO` 维护 code、中文标签、可授予标志和依赖权限。自定义角色编码仍是动态业务数据。`MerchantPermissions` 保留兼容访问常量，权限标签和可授予判断从枚举派生。

`api_response_rules.py` 显式列出每个响应 DTO 的非空/可空字段；字段增加、删除或约束表遗漏都阻断生成。所有成功信封必须有 `data`，普通实体不能为 null；Void 与入驻驳回成功无新商户的既有行为保留。订单缺 data、null、空对象、缺关键字段和非法状态均拒绝。知识列表的 content、未产生的自提/售后、未建立的商户关联等有明确可空语义。

## 领域规则与能力

| 领域 | 独立服务实现 | 规则归属 |
|---|---|---|
| Trading | CartServiceImpl、OrderServiceImpl、AfterSaleServiceImpl | 购物车限制；订单状态与支付/退款记账；AfterSaleAggregate 的申请、审核、申诉及提货互斥 |
| ShoppingAI | KnowledgeServiceImpl、ConversationServiceImpl、ProposalServiceImpl | KnowledgePublicationAggregate 的最新可发布版本/指针；私有会话归属；ProposalAggregate 的确认/拒绝/到期/幂等 |

服务依赖各自的仓储能力接口。原 `ITradingService`、`TradingServiceImpl`、`IAiStateService`、`AiStateServiceImpl` 删除，调用方使用实际能力接口。仓储适配器可实现同一领域内组合的能力接口，不要求把每个数据库表变成独立领域。

`IOrderQueryService`、`IAfterSaleQueryService` 只公开读取；订单锁定和记账只在订单写服务公开。提案服务不再向 Case 提供直接 `confirm(id, hash)` 改状态入口。`confirmSelection` 校验归属、选中项、到期和幂等，在外层同一事务先写确认状态，再由 Case 复核商户、报价、库存并加购；任何失败整体回滚。锁顺序继续为提案 → 用户购物车 → 商户 → 商品/SKU；结算仍为请求闸门 → 购物车 → 商户 → 商品/SKU → 排序库存。

知识仓储在文档根行锁下重建发布聚合。聚合验证 READY 与最新版本；仓储只负责替换旧状态、写入新状态和活动指针，并检查更新行数。创建新版本、发布、撤回共用同一根锁。撤回历史版本不能清空新版本的活动指针。

`RecommendationPolicy` 承担 RRF、每商品均衡 SKU 配额、建议去重与库存筛选。Case 负责跨领域取数和事实转换，规则类不引用 Catalog/Inventory 类型。MySQL 全量词面召回、语义 ID 实时资格复验、200 商品/300 SKU 上限、最多 3 项提案和最终事务复核继续有效。

## 异常和防腐

预期拒绝使用 `AppException`；`0001` 与 `AI0001` 按系统/依赖故障诊断。未知持久化状态使用内部异常，不能伪装为用户参数错误。String 业务码构造器只接受已登记的码，缺少消息时回退安全提示，并保留 cause。

Controller 继续显式分别捕获 AppException 与 Exception，`ApiResponses` 只构造信封，`ControllerFailures` 统一日志级别。`FailureDiagnostics` 记录类型链和代码位置，不输出异常消息、上游正文或凭据。没有新增全局业务异常处理器。

AI 防腐层逐项检查检索词、引用、推荐和语义 ID；非法上游数据统一为 `AI0001`。本地检索、模型模式与降级模式按真实 Python 协议校验。语义召回只对约定的依赖故障降级；程序错误继续向外传播。知识索引保存 FAILED 并记录安全原因，商品同步保留扫描/耗时/失败次数及最近成功/失败时间。

## 查询与表归属

`OrderQueryCaseImpl` 先执行本人/商户权限/管理员授权，再组合本域服务返回的读模型；Trigger 只映射 DTO。订单分页通过一次订单查询、一次订单行 IN 查询、一次自提 IN、一次售后 IN、一次商户 IN 和一次 COUNT 完成，共 6 次数据查询，与本页订单数无关；不包含认证与权限复核查询。空页不发送空 IN 查询。

Catalog、Inventory 的跨领域读取迁入独立 QueryRepository、QueryDao、QueryMapper。Catalog 可只读联查商户资格与库存以执行全局排序；Inventory 可只读联查商品/SKU 以搜索。不得改成取一页后在 Java 筛选或排序。

`verify-ddd-boundaries.py` 维护逐 Mapper/语句的跨域只读白名单，拒绝跨域写表、未批准读表、查询 Mapper 写入/锁定、领域反向依赖、领域直接引用其他领域类型、领域 HTTP/SQL SDK，以及旧大服务依赖恢复。10 个故意违规样例验证门禁确实拒绝错误。`verify-release.py` 在实际 JDK 源码检查后调用该门禁。

## 验收范围

必须运行纯领域、原缺陷回归、严格响应 Schema、静态边界、完整 Maven/MySQL、真实 HTTP 与真实浏览器检查。本轮外部模型和远程 Milvus 未重新验收，生产部署与容量性能不在本轮通过范围。具体数字以本轮独立证据目录为准。
