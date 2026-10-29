# DDD、枚举、错误码与异常处理专项排查

日期：2026-10-29。以下保留审查时的原始问题和证据；用户随后已授权并完成本轮整改，实施见 [SDD-11](../specs/SDD-DDD-11.md)，实际结果见 [整改验收](../testing/DDD-REFACTOR-20261029.md)。原 REPRODUCED 证据不覆盖，新回归证据独立保存。

## 结论与依据

当前工程有真实的分层基础，但领域内部的类型约束、规则归属、服务职责与查询边界仍有明显欠账。上一轮修复的协议错误、参数边界和联调问题不代表架构已经收敛；本轮还复现了响应契约过宽的遗漏，应修正此前对响应校验完整性的理解。

审查依据包括当前源码、[本仓库工程对齐约定](engineering-alignment.md)、[上下文设计](context-map.md)及小傅哥公开的 [EnumVO 规范](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/value-object.md)、[领域服务规范](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/domain-service.md)、[Case 规范](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/case-layer.md)。原 `group-buy-market.zip` 的对照采用仓库已有的[历史源码对照记录](../tutorial/05-group-buy-market-reference-alignment.md)；本轮未取得该归档重新逐文件比对。公开参考资料仅作设计依据，不能覆盖本项目已接受的业务规则。

当前已成立的边界也应保留：

- 七个领域共 72 个 Java 文件，源码扫描未发现领域间的直接 Java 类型引用；Domain 没有直接依赖本工程 Infrastructure、Trigger、Case 或 API。
- Repository/Port 抽象位于 Domain，实现位于 Infrastructure；当前交易跨域写入由 Case 的本地事务编排。
- `OrderAggregate`、`StockBalanceAggregate`、`PickupAggregate` 等已经包含业务行为，不能把整个项目笼统判为只有表映射的贫血模型。
- `types/ResponseCode` 集中业务码、`AppException` 和 Controller 内捕获均符合本仓库明确采用的参考风格。集中枚举本身不是错误，也不需要另造每域一套错误枚举或新增全局业务异常处理器。
- 当前检查到的跨领域 SQL 依赖是读取；未据此发现跨领域直接写表。模块化单体可以有跨领域读模型，欠缺的是显式的查询边界及依赖约定。

机器证据：[ddd-review-20261029.json](../testing/evidence/ddd-review-20261029.json)。生产源码编译探针与仓储、网关、注解替身有明确区分；不是本轮真实 Spring/MySQL/模型验收。

## 问题清单

P2 表示应进入近期修正的行为、可靠性或演进问题；P3 表示较低风险的治理与可维护性问题。本轮没有复现足以断言生产资金或库存已经损坏的 P0/P1 事故。

| 编号 | 等级 | 问题 | 证据性质 |
|---|---|---|---|
| D01 | P2 | 订单成功响应契约允许缺失 data、null 和空对象，字段缺失仍可通过校验 | 3 个 JSON Schema 反例已复现 |
| D02 | P2 | 主要业务状态仍为 String，订单筛选不校验合法状态 | 源码扫描及 `PAYED` 穿透领域服务已复现 |
| D03 | P2 | AI 防腐层没有完整校验响应元素，异常归因会落成 NPE 或客户端 0002 | 3 个上游坏数据场景已复现 |
| D04 | P2 | 业务拒绝、依赖故障和内部不变量失败混用 AppException，日志按异常类统一降为业务 warn | 确定的异常调用链 |
| D05 | P2 | 知识索引、语义降级和商品同步吞掉原因，缺少失败诊断记录 | 3 处明确 catch 分支 |
| D06 | P2 | AI 召回融合和推荐规则写在 Case 中，Domain 主要承担状态存取 | 规则位置和依赖分析 |
| D07 | P2 | 售后、知识发布、提案状态规则分散，领域入口暴露直接改状态的能力 | Service/Case/Repository 调用分析 |
| D08 | P2 | 交易和 AI 服务、仓储按大上下文堆方法，公开接口泄露锁及持久化步骤 | 接口职责分析 |
| D09 | P2 | 跨域订单查询、访问规则和读模型拼装留在 Controller，且形成 N+1 | 调用链静态推导，未做延迟压测 |
| D10 | P2 | Catalog/Inventory 仓储混合本域持久化与跨域查询，数据依赖没有独立契约 | Mapper SQL 依赖分析 |
| D11 | P2 | 架构门禁只能约束部分模块依赖，未守住领域内部和能力边界 | 检查器源码分析 |
| D12 | P3 | 错误码提示跨业务语义、异常构造器及重复入口模板仍需治理 | 1 个错误码场景已复现，其他为源码分析 |

## D01：成功响应的机器契约过宽

位置：`scripts/generate-api-contract.py:82–88, 207–210`；`docs/api/openapi.json`。

生成器把响应 Java 引用字段一律设为可空，没有给响应 DTO 声明业务必填字段；成功信封也只要求 `code/info`，所有接口的成功 `data` 都允许 null。对 `GET /api/v1/orders/{orderId}`，以下三份响应均被当前 Schema 接受：

```json
{"code":"0000","info":"成功"}
{"code":"0000","info":"成功","data":null}
{"code":"0000","info":"成功","data":{}}
```

实际 `ApiViews.order` 会构造订单 ID、买家、商户、状态、金额、时间和订单行；它们与可缺失的自提、售后字段有不同语义。这三份反例通过说明现有校验无法发现关键返回字段被删除，并不说明运行中的接口已经返回了空订单。

这是上一轮契约修正中的实际遗漏。117 份真实响应通过校验的证据仍有效，但只能证明满足当前较宽的结构，不能宣称返回字段语义已经严格覆盖。

建议按响应 DTO 和操作分别显式声明 required/nullable。订单详情成功必须有非空订单对象及核心字段；`pickup/afterSale` 可以为 null；`Response<Void>` 和入驻驳回等确实允许无数据的操作单独定义。增加“删除必填字段必须失败”的反例，替换现有允许残缺订单成功的样例。

## D02：枚举没有覆盖主要业务状态

位置：`OrderAggregate.java:19,34,49–77`、`ProductAggregate.java:9,16,35–36`、`ProposalAggregate.java:8–17`、`InventoryServiceImpl.java:35–48`，均在 `campus-shopping-domain` 对应上下文中。

72 个领域 Java 文件只有 `UserAccountStatusEnumVO` 与 `MerchantApplicationStatusEnumVO` 两个 enum。订单、商品、SKU、库存预占/流水、自提、售后、提案、知识可见范围/发布/索引状态主要仍由 String 表示。同一状态的允许集合及切换规则散布在聚合、服务、Case、SQL、前端；拼写错误无法由编译器发现。

已经复现 `TradingServiceImpl.orders(...,"PAYED",...)` 原样调用仓储。该服务仅执行 `optional(status,24)`；真实 Mapper 按原值等值筛选，因而客户端拼错状态会得到空列表，而不是明确的输入错误。本轮探针确认到仓储边界，真实数据库空列表是由 Mapper 条件推导，未再次发起线上请求。

建议为封闭状态集合补充本领域的 `OrderStatusEnumVO`、`ProductStatusEnumVO`、`SkuStatusEnumVO`、`ReservationStatusEnumVO`、`StockMovementTypeEnumVO`、`PickupStatusEnumVO`、`AfterSaleStatusEnumVO`、`ProposalStatusEnumVO` 及知识相关状态。使用稳定 code/fromCode，在 API/持久化边界转换；可接受筛选值与响应值生成到契约中。

自定义角色的 `R...` 编号、商户 ID、SKU ID、类目编码属于动态标识，不应全部强改为 enum。Owner/Clerk 可表达为内置角色类型，自定义角色继续使用角色编码；固定权限码可逐步收敛为带依赖关系的枚举/值对象。

## D03：上游坏数据被误判为应用或用户错误

位置：`campus-shopping-infrastructure/.../adapter/port/AiEnginePort.java:11–19`；`CatalogServiceImpl.java:28–31`。

防腐适配目前检查对象、列表是否为 null 及列表长度，但没有逐项检查召回词、引用、推荐等数据。隔离网关替身输入已复现：

| 上游响应 | 当前结果 |
|---|---|
| recall.terms 含 null | `List.copyOf` 抛 NullPointerException |
| recall.terms 为 `["?"]` | 防腐层放行，Catalog 抛 `0002`，把上游违约归到客户端参数 |
| recommendations 含 null | 映射推荐时抛 NullPointerException |

用户问题本身有效。这些错误经过 Controller 后可能是 `0001` 或 `0002`，不再表达 AI 依赖响应违约。没有证据表明当前真实 Python 正在返回这些坏值；探针模拟的是依赖升级或故障时的防御缺口。

建议防腐适配完成元素级非空、长度、格式和枚举范围检查，构造有效的领域对象后再返回。依赖响应无效使用明确的 AI 依赖失败分类和安全提示，记录受控的失败类型；不要让下游领域替外部服务判“用户非法参数”。

## D04：AppException 的日志语义过于单一

位置：`OrderController.java:125–128`（另 9 个 Controller 有同类 execute）；`AiGatewayService.java:81–82`；`TradingRepository.java:43–45`。

`AppException` 同时表示参数错误、权限拒绝、业务状态冲突、AI 不可用，还用于订单持久化金额与订单行合计不一致的 `UN_ERROR`。Controller 对所有 AppException 只执行 `log.warn("业务请求失败 code={}",...)`，不记录 cause、具体操作或资源定位。

因此，AI 网关即使保留了异常链，也会在入口失去诊断信息；订单持久化不变量失败也被归入普通业务 warn。未知 Exception 的 error 堆栈分支并不能覆盖这些故障。

建议继续使用 AppException/ResponseCode，但区分预期业务拒绝、依赖失败和内部数据不变量失败的日志等级与诊断字段。对外仍使用安全 code/info；对内保留经脱敏的原因类型、操作、资源 ID、请求关联号。响应码分类元数据或入口分类器即可承担这项职责，不要求新增异常继承树。

## D05：降级与重试缺少可诊断的失败记录

位置：`KnowledgeCaseImpl.java:30–34`、`ShoppingAiCaseImpl.java:28`、`ProductVectorSyncJob.java:17–27`。

- 知识索引 catch Exception 后只写固定 FAILED 提示，原始原因不进入日志或错误分类。
- 语义检索 catch RuntimeException 后静默回退；依赖不可用和编程错误没有区分。
- 商品索引周期任务 catch RuntimeException 后无日志、无成功/失败记录，运维无法确认连续失败、失败页或最近成功时间。

保持词面降级和安全提示是合理的；凭据与正文不应被记录。仍可安全记录依赖名称、异常类别、任务阶段、批次、耗时、重试次数及最近成功时间。只捕获约定的可降级依赖故障，程序错误应保留明确诊断。现有“下次周期重试”也没有持久游标/失败任务状态，容量扩大后需专门评审同步可靠性。

## D06：AI Case 承担了领域算法

位置：`ShoppingAiCaseImpl.java:22–72`。

该方法内直接实现 RRF 融合及权重常数、全量候选截断、跨商品 SKU 均衡取样、库存过滤、最多三项提案、数量规则、引用验证和推荐理由处理。构造器还需要九个服务/端口/时钟依赖。

这些规则并非全部属于“调用多个领域服务”的编排职责。调整推荐融合、候选配额或提案策略，会直接改动同时负责权限、会话、远程调用和写入编排的 Case，隔离验证也更困难。

建议在 ShoppingAI 内提取可独立验证的召回融合/候选选择/提案生成能力，输入使用公开查询快照。Case 保留身份与知识权限、跨域取数、调用顺序和事务；交易前事实复验继续由 Java 负责。不需要为了模仿参考仓库强加责任链或复杂工厂。

## D07：部分状态规则没有稳定的领域归属

位置：`TradingServiceImpl.java:145–184`、`OrderLifecycleCaseImpl.java:28,34–42`；`AiStateServiceImpl.java:24–25,40–42`；`AiRepository.java:75–85`。

- 售后只有承载字段的 AfterSaleVO，允许申请、驳回、申诉、同意、阻止核销的规则分布在交易服务和生命周期 Case。
- 知识发布是否 READY、是否最新版本、如何替换旧发布指针，主要由 Repository 决定；Domain 的 publish 只转发调用。
- 提案确认由 Case 构造 ProposalAggregate 判定，再调用 `state.confirm(id,hash)` 直接改状态；拒绝的聚合构造却位于 Domain Service。两条路径的规则入口不一致。

建议先为售后和知识版本定义聚合/领域状态行为，统一提案确认与拒绝的领域入口。Repository 继续承担行锁、条件更新和最终并发防线；不能把数据库条件检查直接删掉，仅在 Java 提前检查，否则会引入竞态。Case 只决定跨域动作顺序。

## D08：服务和仓储的职责过宽

位置：`ITradingService.java:7–18`、`ITradingRepository.java:6–15`、`IAiStateService.java:4–11`。

交易公开接口同时承载购物车、结算幂等闸门、订单、模拟支付/退款、售后和统计；AI 状态接口同时承载知识库、文档、索引状态、会话、消息和提案。调用方依赖的接口包含大量无关能力。

`lockCart`、`order(id,boolean lock)`、`begin/finishCheckout`、`proposal(...,lock)`、`confirm(id,hash)` 等还把持久化步骤或锁策略暴露给上层。部分入口使用 MANDATORY，而 Catalog 写服务依赖调用者先开启事务，公开能力的事务前提不统一。

建议先在现有上下文中按能力拆成购物车、订单查询、订单命令、售后、知识版本、会话、提案等窄接口，并约定命令事务入口。内部事务实现可继续复用同一仓储适配器，再根据变化拆仓储；不要求马上拆七个 Maven 领域模块或七个微服务。

## D09：订单查询在 Controller 聚合，形成 N+1

位置：`OrderController.java:54–56,63–71,122–124`；`TradingRepository.java:26,40–45`。

Controller 自行判断“本人/管理员/有商户权限”，并拼装订单、履约、售后和商户名称。订单 Repository 查询列表时又对每笔订单分别查订单行。

按当前源码推导，分页查询 N 笔订单、涉及 M 个商户时，业务组装约为 `1 + 3N + M` 次 SQL，再加 COUNT 和权限相关查询。N=100、M=1 时约 303 次（含 COUNT），M=100 时约 402 次；旧列表逐笔 view 不缓存商户名，重复查询更多。本轮没有执行 SQL 计数器或延迟压测，这些是调用链推导值。

建议建立明确的订单查询用例和只读结果模型，把访问规则集中到可复用入口；批量读取订单行、自提、售后和商户，或使用独立只读投影。仅把原循环搬入 Service 不会消除 N+1，应增加分页查询 SQL 数量预算回归。

## D10：跨领域 SQL 读取没有独立边界

位置：`icatalogdao_mapper.xml:11,28,35,57,90`；`iinventorydao_mapper.xml:14,40`，位于 App 的 `mybatis/mapper`。

Catalog 的商品搜索/召回直接连接 Merchant，库存排序读取 Inventory；Inventory 的库存筛选连接 Catalog。这样的只读 JOIN 在当前同库单体内可以成立，也能保证正确的全局排序和公开资格过滤。

问题在于这些查询与领域写仓储混在同一接口，依赖的他域字段、授权事实和快照语义没有形成显式契约。未来修改商户状态、库存粒度或商品结构，需要跨域同步修改多个 Mapper，静态 Java import 扫描看不到。

建议将跨域展示查询放在明确的 Query Repository/只读投影适配器中，列出允许读取的数据及刷新/一致性要求；本域写仓储保持所有权。保留当前公开商品经营资格过滤和全局排序，不能为消除 JOIN 改成“先分页再过滤/排序”。

## D11：架构门禁未覆盖本轮发现的边界

位置：`scripts/verify-release.py:25–35`；[上下文设计的核验要求](context-map.md)。

现有检查会阻止 Domain import 本工程的 Infra/Trigger/Case/API，但没有检查领域间类型依赖，也没有检查各 Repository/DAO 的表访问归属、Controller 的业务编排、领域状态 String 或命令入口前提。对非本工程包的 import 提前 continue，文档所述的 MyBatis/HTTP SDK 禁入也未在此处完整实现。

当前“没有直接跨领域 Java 引用”是本轮额外扫描的发现，不能当作仓库 CI 已在守护这条规则。构建与业务验收通过，也不会发现响应 Schema 过宽或服务职责扩大。

建议增加编译后依赖规则/ArchUnit 等价检查、领域公开能力边界、SQL 读取白名单和写表归属规则。对静态规则本身加入违规夹具验证，使新增直接依赖能让 CI 失败；为批量查询和不合法上游响应补行为测试。

## D12：错误码与入口代码的治理问题

位置：`PickupAggregate.java:17–23`、`CatalogRepository.java:60–68`、`TradingServiceImpl.java:100–117`、`AppException.java:31–40`、各 Controller 的 execute。

- 已复现：取消的自提任务执行 prepare 返回 `T0001/订单当前状态不允许此操作`。商品图片上传也使用 `AI0004`，错误码的归属和提示没有准确覆盖业务上下文。历史 code 已发布，应采用兼容的归类/新增码方案，不能直接全量重编号。
- 购物车单 SKU 数量、行数上限与普通非法参数都返回 `0002`，调用方无法知道是参数格式、数量超限还是需要先清理购物车。已有 G0002/T0001 同样覆盖许多不同冲突原因，需要依据用户可采取的动作分配细分码，避免无限增码。
- `AppException(String code)` 和 `(String code,Throwable)` 会产生 info=null，任意字符串构造也可绕开已生成的枚举契约。本轮生产调用扫描未发现使用这两个只传 code 的构造器，因此它们属于接口风险，不能宣称已导致线上空提示。
- 10 个 Controller 复制 execute 模板，日志缺少操作标识；不少文件单行包含多段业务逻辑，并残留大量无关星号 import。维护一个行为要跨多处同步，行级审查也困难。

建议保留集中 ResponseCode，按“是否能让用户采取不同处理”补码或细化安全提示；固定状态、权限类型回归领域 EnumVO；业务异常优先枚举构造并保证安全提示非空。统一响应构造和脱敏日志辅助能力，Controller 内的业务捕获约定继续保留。格式整理应局部进行，避免一次全库重排掩盖行为变更。

## 建议实施顺序与验收

1. 先补响应 required/nullable、状态筛选和 AI 防腐边界。验收要求是本轮 8 个探针观察到的不足得到明确修正；将“复现现状”的探针升级成断言期望行为的回归。
2. 收敛枚举及错误归因：先订单/售后/自提/提案的固定状态，再知识状态与固定权限；对外 code、DB code 保持兼容。为依赖故障和不变量失败增加可诊断的日志分支。
3. 按售后、知识发布和提案逐条链路统一状态规则，再拆 ITradingService/IAiStateService 的能力接口。保留同库事务、锁顺序、幂等键与价格库存复验。
4. 抽取 AI 融合/推荐规则及订单查询用例，消除逐单查询；显式列出跨域只读 SQL 的依赖范围。
5. 增加架构门禁。之后执行完整 Maven、真实 MySQL 并发/回滚、真实 HTTP 契约和多角色浏览器回归；目前的静态/纯 Java 结果不能替代它们。

当前未将缺少 MQ、复杂责任链、独立微服务或新的异常继承体系作为缺陷。改造应由具体规则、变化点和验收要求驱动。

## 本轮执行及复现

```powershell
python -X utf8 -B scripts/probe-ddd-review.py
```

需要 JDK17、Python 及现有开发依赖 jsonschema。编译当前 40 个生产 Java 文件，注解、仓储和远程 Gateway 使用明确替身；5 个 Java 行为观察及 3 个 Schema 反例均已复现。临时编译目录自动清理，不读取 .env，不连接数据库或远程服务。证据状态为 REPRODUCED，表示问题存在，不表示问题已经修复。

本轮未重新运行完整 Maven 或全栈验收；上一轮验证记录保留在[契约/数据库专项报告](../testing/CONTRACT-DATABASE-API-AUDIT-09.md)。后续源码修正后必须更新相应验证证据。
