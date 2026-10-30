# 当前工程与小傅哥参考项目的 DDD 风格、契约文档复核

审查日期：2026-10-30。对象为当前未提交修复工作树。比较的具体参考工程是用户曾上传的 `group-buy-market.zip`；本轮未取得该 ZIP，涉及其具体代码的结论以仓库已有的[归档源码对照记录](../tutorial/05-group-buy-market-reference-alignment.md)为限。分层原则另以小傅哥公开的 [项目结构](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/project-structure.md)、[Case](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/case-layer.md)、[聚合](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/aggregate.md)、[值对象/EnumVO](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/value-object.md)、[命名](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/naming.md)为依据。官方规范中的示例不等同于该 ZIP 的全部实际代码。

## 1. 代码设计对照

| 维度 | 参考依据 | 当前实现 | 判断 |
| --- | --- | --- | --- |
| 异常与响应 | 已记录的参考源码使用 `AppException`、集中 `ResponseCode`、`Response<T>`，Controller 内捕获业务/未知异常；未发现全局业务 Advice。 | [AppException](../../campus-shopping-types/src/main/java/cn/bugstack/ai/types/exception/AppException.java)、[ResponseCode](../../campus-shopping-types/src/main/java/cn/bugstack/ai/types/enums/ResponseCode.java)、[ControllerFailures](../../campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/ControllerFailures.java) 延续此结构。协议绑定与鉴权错误另由过滤器/协议解析器处理；`AppException` 有非空安全提示和异常链，日志不输出下游原文。 | **对齐且更明确**。不需要为了“像参考项目”增设每领域错误枚举或全局业务异常处理器。已进入 Controller 的业务失败通常 HTTP 200 + 非零码，属于本项目既定契约。 |
| 充血领域模型 | 官方聚合规范强调聚合根维护不变量；其 `GroupBuyOrderAggregate` 示例偏数据组合，参考项目复杂规则也常在领域服务/策略中。 | [OrderAggregate](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/trading/model/aggregate/OrderAggregate.java) 管金额与付款/取消/退款转换；[ProductAggregate](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/catalog/model/aggregate/ProductAggregate.java) 管 SKU、价格与发布；库存、自提、售后、知识发布和提案也有行为聚合。商户营业、购物车容量、实时成员授权主要在各自领域服务。 | **核心状态模型比“只装字段”更充血，但不均匀**。Cart/Identity 的数据库当前事实与并发锁在服务层有理由，不能仅按类名要求都改成聚合。需要继续检查新增规则是否回流到 Case/Controller/Repository。 |
| 分包和依赖 | 官方结构是 `api / trigger / case / domain / infrastructure / types / app`，Domain 下按领域划分 `adapter/model/service`，Infrastructure 下为 `adapter/repository`、`dao/po`、`gateway`。 | 七个限界上下文、Case 模块和上述包位均存在；Domain 不依赖基础设施实现。`verify-ddd-boundaries.py` 已纳入依赖方向、跨域查询白名单及违规样例门禁，实际数量见本轮报告。 | **总体对齐**。`ITradingDao`、`IAiDao` 仍跨多种同域能力集中 SQL，Repository 已按能力拆开；这是维护粒度选择，不是依赖倒置错误。静态门禁不等于行为或事务验证。 |
| 枚举 | 参考项目错误码集中于 Types，领域 `EnumVO` 表达状态/类型；官方值对象规范允许枚举包含业务行为。 | 商品、订单、自提、售后、知识、提案、成员及权限等固定字典已放在各领域 `EnumVO`；聚合内部用枚举，HTTP/数据库保留兼容字符串，`fromCode` 拒绝未知持久化状态。动态自定义角色码保持数据属性。 | **主要差异是当前项目的枚举解析更严格**，这有利于避免未知状态被放行；不应为了形式把动态角色码或所有传输字段改成 Java enum。 |
| Case 层 | 官方 Case 负责跨领域编排和事务，复杂流程可选 Node；并非每个简单动作都需要 Node/责任链。 | 审核开通、结算、支付履约、提案确认等在 Case 层编排跨域服务与本地事务；AI 长调用入口用 `NEVER`，完成消息/提案用短事务。 | **引入 Case 有业务依据**，不能因为参考工程某一流程没用 Case 就删除。Node/策略应由实际多分支需求决定，不应机械增加。 |

### 本轮已处理的代码差异

1. **Catalog 命令与查询已分开。** [ICatalogCase](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/catalog/ICatalogCase.java) 只保留 9 个写用例；[ICatalogQueryCase](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/catalog/ICatalogQueryCase.java) 负责展示、库存、分页和授权。Query Case 直接调用领域能力，删除对写 Case 的依赖与重复查询入口；测试已迁移。
2. **Case 方法表达业务动作。** 商品使用 `createProduct/addSkuToProduct/changeSkuPrice/editProduct/setProductPublished/forceUnpublishProduct/replenishStock/uploadProductImage/upsertCategory`；履约使用 `issuePickupToken/verifyPickup/startPreparing/markReady`，退款使用商户/平台明确的同意与驳回方法。领域内简短且上下文明确的 `find/pay/save` 保留。
3. **命令对象已更名。** [ProductCreateCommandEntity](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/catalog/model/entity/ProductCreateCommandEntity.java) 明确表达商品创建输入；保留参考工程的 `model/entity` 与 CommandEntity 命名习惯，所有生产和测试引用同步。
4. **订单写响应由 Case 组装。** 下单、支付、取消、核销返回不可变 [OrderReadModel](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/trading/model/OrderReadModel.java)，不包含可变订单聚合。商户、自提和售后事实在原写事务内完成组装；HTTP 只映射 DTO。新增回归验证响应读失败会回滚建单/库存/幂等键，或支付/自提任务。

## 2. 契约与文档的当前一致性

93 条对外路由保持兼容，会话与邀请增加可选 `page/size`；[HTTP 表](../api/http-api.md)、[OpenAPI](../api/openapi.json)、[路由清单](../api/route-manifest.json)与[错误码](../api/error-codes.md)从当前源码重新生成。必填字段/null 规则仍由 `scripts/api_response_rules.py` 管理。[行为契约](../api/behavior-v1.1.md)同步了列表末页、知识容量与 AI 多轮约束。

| 原问题 | 当前处理 |
| --- | --- |
| TRACEABILITY 仍称数据库/HTTP 未运行，且引用旧类 | [当前追踪矩阵](../TRACEABILITY.md)按实际证据更新，改为 WorkspaceController、AfterSaleServiceImpl、OrderRepository；旧 NOT_RUN 只留在有日期的历史表。 |
| DELIVERY 前后冲突，候选 100/200 与 Milvus/Qdrant 混用 | [交付说明](../DELIVERY-R1.md)统一全量词面召回 200 件、SKU 上限 300，区分商品 Milvus、知识可选 Qdrant和各自验收边界。 |
| 文档索引、路线和运行手册状态陈旧 | [索引](../README.md)、[路线](../ROADMAP.md)、[运行手册](../operations/R1-runbook.md)、根 README 与验证入口都指向当前报告；2026-10-28 的阶段声明标为历史。 |
| 会话/邀请静默截断 100 条 | 服务端分页贯穿 Controller、Case/Domain、Repository 和 SQL；前端提供加载更多/翻页，真实 MySQL 与浏览器分别覆盖第 101 条。 |
| 知识范围静默截断 1000 | 知识库元数据读取完整；授权文档分批查询并额外探测溢出。单次最多 1000 份，超限返回新增 AI0005；Python 超限拒绝，合法边界分批查询。1001 个知识库与 1001 份文档均有边界测试。 |
| 预算和多轮数量规则遗漏 | 中文预算、模糊数量、追问继承由确定规则处理；可信用户条件优先于检索改写及模型输出。新增 Python 用例。 |

历史设计稿 `docs/domains/` 与旧系统架构中已标明的异步 OrderPaid/Qdrant 设想继续作为历史材料，当前实现以[上下文映射](context-map.md)、API 和 DDL 为准。

## 3. 修复验收与比较边界

完整命令、源码快照、成功数量及未验收项见[本轮闭环报告](../testing/DDD-DOC-CLOSURE-20261030.md)。本轮没有取得原 group-buy-market ZIP 重做逐文件比较；风格依据仍限于开头的归档记录与官方规范。生产安全、性能、真实支付、远程模型当前版本回归是独立工作，不能从本轮本地通过推导。
