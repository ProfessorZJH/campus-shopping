# 最新 main 项目审查与小傅哥 DDD 对照

> 本文保留提交 `37124d0` 上的修复前审查证据。后续修复及重新验收见 [修复报告](../testing/PROJECT-REVIEW-FIXES-20261030.md)。

审查日期：2026-10-30。代码基线：`37124d0a114a0d79611528c69684276c1685f7e2`（GitHub `main`，合并 PR #9）。结束前通过 `git ls-remote` 再次确认远程 main 仍是此提交。

## 结论

**在本报告的基线提交上复现 8 个问题，其中 3 个 P1、5 个 P2。** 最应优先处理的是商品价格被并发操作覆盖、旧邀请恢复受限店员权限，以及生产配置下转发头绕过登录限流。另有购物车容量并发失守、提案读取旧库存、工作台成员截断和两项 AI 边界错误。另列 4 个源码确认但未做独立运行复现的待办，优先级为建议值。

现有测试全部通过，不能据此认为这些问题不存在：本次在全新临时 MySQL 8.0.31 中运行 `clean verify`，181 项 Java 测试零失败零跳过；真实 HTTP 173 项、严格响应 117 份、真实浏览器 8 项、Python 42 项通过。另有 58 项 Schema 检查及架构门禁通过。随后新增的探针复现了下列缺陷。**`REPRODUCED` 表示观察到缺陷，不表示业务验收通过。**

本次仅增加审查报告、复现脚本和脱敏证据，没有修改生产实现。

## 对照依据与边界

小傅哥官方的 [Case 规范](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/case-layer.md) 将跨域流程与事务边界交给 Case；[聚合规范](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/aggregate.md) 强调聚合内一致性；[仓储规范](https://github.com/fuzhengwei/xfg-ddd-skills/blob/main/references/repository.md) 将本地持久化放在 Repository。以上资料于本次联网读取。

本机未找到原始 `group-buy-market.zip`，其公开 GitHub 地址也未取得源码。因此，对该项目具体 Controller、异常和模块风格的比较采用已有的[历史源码对照记录](../tutorial/05-group-buy-market-reference-alignment.md)；不能声称本轮重新逐文件审查了原拼团项目，更不能据此断言原项目也有下列缺陷。

| 对照维度 | 最新代码的事实 | 本轮判断 |
|---|---|---|
| 分层与依赖倒置 | API/Trigger/Case/Domain/Infrastructure 已分离，333 个 Java 源文件、133 条 SQL 的静态门禁通过 | 不应再将已拆分的交易/AI 大服务、Controller 查询组装等旧问题列为当前缺陷 |
| 聚合一致性 | 有 Product、Order、AfterSale、Proposal 等模型，但商品写仓储混用了当前读与旧快照读 | 模型命名和根行锁存在，仍不足以守住实际不变量，见 R01/R04/R05 |
| 授权状态转换 | 权限实时查询，但接受邀请没有保护已经生效的自定义角色 | 必须审查状态转换允许什么，而不只是检查权限接口是否拆开，见 R02 |
| Case 与领域服务 | 跨域事务已集中到 Case，现有窄服务和读模型应保留 | 修复应落在已有命令仓储与领域规则中，无需为此引入微服务、MQ 或复杂责任链 |
| 查询完整性 | 工作台上层批量读商户，但下层成员查询先截断 | 用例的“完整返回”契约必须贯穿 SQL 和接口，见 R06 |
| 测试与部署 | 构建、契约和主流程通过，仍遗漏锁等待后的读取、旧邀请重放及 prod 转发头场景 | 需要行为回归补上这些场景；目录/正则门禁无法替代它们 |

本项目已接受的 Controller 内捕获、`AppException/ResponseCode`、业务错误 HTTP 200、Java 17/Boot 3 和同库只读投影继续成立，本轮不把这些约定本身列为缺陷。

## R01 · P1：并发下架会覆盖已经提交的新 SKU 售价

位置：[CatalogRepository.java](../../campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/adapter/repository/CatalogRepository.java) 22–36 行；[icatalogdao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/icatalogdao_mapper.xml) 4–8、25–26 行。

`find(id, true)` 锁定商品主记录后，通过普通 `SELECT` 读取 SKU；`save` 又把聚合内全部 SKU 的价格和版本无条件写回。在 MySQL 默认 `REPEATABLE-READ` 下，请求中的账号/权限查询已经建立旧快照。等待商品锁结束后，主记录是新版本，SKU 仍可能来自旧快照。

复现：连接 A 持有商品锁并准备将售价从 1000 分改成 2000 分；真实 HTTP 下架请求 B 建立快照后等待该锁；观察到数据库锁等待后提交 A。B 返回 `0000`，最终售价回到 **1000 分**，SKU 版本也回退到 **0**。这会丢失商户已提交的改价，后续交易可能按被恢复的旧价成交。

建议：命令仓储在同一锁序下以当前读装载聚合子项；SKU 写入增加版本条件，或仅保存实际变更的字段。至少补充“改价与下架”“改价与新增规格”的锁等待回归，检查最终价格和版本均不倒退。

## R02 · P1：第二封旧邀请可以恢复已被收回的店员权限

位置：[AccessServiceImpl.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/impl/AccessServiceImpl.java) 74–98 行；[iaccessdao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/iaccessdao_mapper.xml) 的 `grantClerk`。

Owner 可以向同一未入职账号连续发两封 PENDING 邀请。接受第一封后，Owner 将其角色改为仅有 `product.read` 的自定义角色。该成员随后接受第二封旧邀请，`accept` 仅排除 OWNER，便再次执行 `grantClerk`，把当前角色覆盖为 CLERK。

真实 HTTP 复现结果：访问库存原本返回 **A0006**；接受第二封邀请后，同一账号访问返回 **0000**，数据库角色变为 **CLERK**。默认 CLERK 包含补货、备货、核销等权限，因此这不是单纯的角色显示错误。

建议：已是 ACTIVE 成员时，接受旧邀请不能改变现有角色；同一商户与目标用户的待接受邀请应有明确的幂等/替代规则，首次接受后作废其余旧邀请。为“重复邀请 → 接受 → 降权 → 再接受旧邀请”增加完整回归。

## R03 · P1：prod 的转发头处理使登录限流可被绕过

位置：[application-prod.yml](../../campus-shopping-app/src/main/resources/application-prod.yml) 3 行；[AuthenticationRateFilter.java](../../campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/AuthenticationRateFilter.java) 41 行。

prod 启用 `forward-headers-strategy: framework`，而限流直接用包装后请求的 `getRemoteAddr()`。如果客户端可以直连 Java，或边缘代理没有覆盖/清洗传入的转发头，客户端便能影响限流使用的地址。过滤器注释所说的“不相信客户端 X-Forwarded-For”没有在此配置下成立。

复现使用真实 **prod 配置**，仅将服务地址绑定到回环并关闭测试不需要的后台任务。同一真实来源连续发送 32 次错误登录，出现 **4 次 429**；随后改变 `X-Forwarded-For` 连续发送 32 次，**0 次 429**，请求均到达业务认证并返回 HTTP 200。

建议：明确可信代理边界，由可信入口清洗转发头，并限制应用直连；应用只采信经过验证的代理地址链。增加 prod 配置的集成测试，验证伪造头不能改变限流主体。此复现没有对公网服务进行探测。

## R04 · P2：购物车 100 行上限在并发写入时失守，且有商品被隐藏

位置：[CartServiceImpl.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/trading/service/impl/CartServiceImpl.java) 34–50 行；[itradingdao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/itradingdao_mapper.xml) 的 `cart/ensureCart/lockCart`。

写操作取得购物车闸门锁后，用普通的 `repository.cart(user)` 判断是否达到 100 行。该读仍可能使用等待闸门前建立的旧快照；展示 SQL 又固定 `LIMIT 100`。

复现：最初有 99 行，连接 A 持有购物车锁；真实 HTTP 加购 B 开始并等待，A 插入第 100 行并提交。B 仍看到 99 行，通过校验并返回 `0000`。数据库最终 **101 行**，`GET /cart` 只返回 **100 行**，用户无法从列表看到其中一项。

建议：命令仓储在取得用户闸门后使用当前读判断真实行数；容量规则不应依赖带展示截断的列表查询。回归必须确认数据库总行数、响应错误码及列表完整性。

## R05 · P2：AI 提案确认可能用旧库存通过“实时复验”

位置：[ProposalConfirmationCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/ProposalConfirmationCaseImpl.java) 70–83 行；[iinventorydao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/iinventorydao_mapper.xml) 的 `stocks`。

确认在事务内锁定报价，但库存来自普通 `inventory.stocks(ids)`。请求先前建立的旧快照不会因为等待商品锁而刷新。

复现：确认请求开始时库存可售 100 件；另一个事务持有商品锁，在确认等待期间将库存全部预占并提交。确认恢复执行时，数据库实际可售 **0**，但接口仍返回 **0000**，通过了 `STOCK_NOT_ENOUGH` 判断。

这里确认动作只加购物车，最终下单还有库存预占校验；**本轮没有据此声称发生超卖或真实扣款**。缺陷是已提交的库存变化发生在复验之前，复验仍使用旧值。

建议：在既有商品→库存锁序内提供专用的库存当前读/锁定能力；不能把展示快照当作命令复验结果。补充等待其他交易提交后库存归零的回归。

## R06 · P2：工作台超过 100 个有效成员关系时被静默截断

位置：[iaccessdao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/iaccessdao_mapper.xml) 13–17 行；[WorkspaceQueryCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/merchant/impl/WorkspaceQueryCaseImpl.java) 32–49 行。

最新 Case 已按每批 100 个商户读取，并声明更多商户仍完整返回，但 `access.memberships` 的 SQL 更早就 `LIMIT 100`。上层分批无法恢复被下层丢弃的数据。

在隔离库准备 **105** 个有效成员关系后，真实 `/workspace` 只返回 **100** 个成员关系和 **100** 个商户，且没有分页或截断提示。工作台选择和基于成员列表构造的知识授权范围都可能遗漏有效商户。`members` 也存在同类 `LIMIT 100`，这一额外列表场景仅做源码确认，未单独计入探针数量。

建议：明确无截断的完整工作台契约，或提供贯穿 SQL/API/前端的分页；不要靠服务替身返回 105 项来证明真实 SQL 支持超过 100 项。商户员工列表使用同类 `LIMIT 100`，应统一修复两条查询，并分别用真实 MyBatis 查询验证第 101 条数据。

## R07 · P2：中文购买数量被解析成末尾一位

位置：[engine.py](../../ai-service/app/engine.py) 18–24、81–83 行。

正则只识别一个中文数字，且没有防止从完整数词中间开始匹配。实际解析：**“买十二瓶矿泉水” → 2**、**“买二十瓶矿泉水” → 10**。本地真实检索函数对“十二瓶”最终推荐 **2 瓶**，同时理由仍声称数量已校验。

“买100瓶”被解析为 `None`；源码随后把 `None` 当成没有指定数量并默认 1，这一后续效果属于源码推导。超出上限与未指定数量应有不同的结果。

建议：完整识别阿拉伯/中文数词及边界；区分未指定、歧义、格式错误和超出 99 上限，无法可靠识别时要求澄清。增加十二、二十、二十一及超限数量的用例。

## R08 · P2：模型回答校验失败后，降级分支仍保留失败正文

位置：[engine.py](../../ai-service/app/engine.py) 114–119 行；Java 防腐边界见 [AiEnginePort.java](../../campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/adapter/port/AiEnginePort.java) 的 `query`。

代码先把模型结果赋给 `text`，再验证类型、空白和 8000 字符上限。校验抛错后只切换 mode/warning，没有清空 `text`；非空的失败结果会跳过后面的本地回答生成。

使用明确的模型提供者替身返回 **8001 字符**的回答，结果 mode 是 **LOCAL_FALLBACK**，answer 仍是该 **8001 字符模型正文**。没有调用真实模型。更长文本超过 Java 的 10000 上限时会被 Java 拒绝，这一点由两侧源码边界推导；8001–10000 字符则可能继续以降级名义输出。

建议：先校验候选值，全部通过后再赋给正式回答；异常分支丢弃候选正文，确定性生成本地回答。覆盖空白、超长和非字符串的故障输出，验证降级回答的内容而不只断言 mode。

## 源码确认的剩余问题（未独立运行复现）

以下四项来自同一最新提交的源码核对。它们没有计入上面的 8 项 `REPRODUCED`，建议修复前先补有针对性的行为或规模测试。

| 编号与建议优先级 | 代码证据及影响 | 后续验证与改进 |
|---|---|---|
| S01 · P1 | [iaccessdao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/iaccessdao_mapper.xml) 的 `members` 查询固定 `LIMIT 100`，接口没有分页。超过 100 名员工时，后续成员可能无法出现在管理列表。它与 R06 的 `memberships` 截断属于同一层的查询完整性问题。 | 在真实 MySQL 写入 101 名成员，验证店员管理查询、角色分配入口和总数；给两条查询统一设计分页或完整读取策略。此列表场景尚未单独复现。 |
| S02 · P2 | [WorkspaceQueryCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/merchant/impl/WorkspaceQueryCaseImpl.java) 对每个商户单独执行 `access.permissions(actor, id)`。关系数增加时，权限读取次数随之增长；修复 R06 的截断后，影响会更明显。 | 记录不同商户数下的 SQL 次数，再在 Identity 领域提供批量权限查询，并保留当前用户、当前商户的实时复权。 |
| S03 · P2 | [contract_ui.py](../../frontend/tests/contract_ui.py) 从 `static/assets/app.js` 等旧版资源启动；[full-release.yml](../../.github/workflows/full-release.yml) 把它和新版 UI 契约脚本放在同一个 `run` 块且排在最前。旧版脚本失败会中断后续脚本。 | 将旧版与新版浏览器测试拆成独立步骤或 Job，两者仍保持失败门禁，并各自保存结果与截图。 |
| S04 · P3 | [IOrderLifecycleCase.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/trading/IOrderLifecycleCase.java) 仍有 `prepare(..., boolean ready)`；[AfterSaleServiceImpl.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/trading/service/impl/AfterSaleServiceImpl.java) 仍有 `afterSale(order, boolean lock)`。调用点需靠参数位置理解行为。 | 后续小范围改成语义明确的方法，保持现有 Case 与仓储层级；这是可读性改进，尚无独立故障证据。 |

## 修复顺序与验收要求

1. 先修 R01/R02/R03：防止价格回退、权限恢复与认证限流失效。分别增加受控并发、全 HTTP 邀请重放和 prod 配置测试。
2. 同批梳理 R04/R05 的命令读取语义，区分展示快照和取得锁后的当前读；保留现有事务边界、商品→库存锁序及最终下单校验。
3. 将 R06 与 S01 作为一组查询完整性问题修复，再处理 R07/R08 的确定性解析与降级输出。S02/S03/S04 按上表补测试和整理。每个实际缺陷补行为回归，保留原始失败证据，然后运行完整隔离验收。

不建议仅把整个应用改成 `READ_COMMITTED` 作为统一修复；它不能解决邀请、转发头、静默截断或 AI 输出问题，还会改变其他现有事务的语义。

## 证据、复现与环境清理

- [最终 8 项探针](../testing/evidence/project-review-20261030/probes-final.json)：全部 `REPRODUCED`，MySQL 隔离级别 `REPEATABLE-READ`。
- [完整构建与联调汇总](../testing/evidence/project-review-20261030/baseline.json)：181 Java、173 HTTP、117 严格响应、8 浏览器；全部使用新建临时数据库。
- [静态架构门禁](../testing/evidence/project-review-20261030/boundaries.json) · [Schema 检查](../testing/evidence/project-review-20261030/api-schemas.json) · [Python 执行摘要](../testing/evidence/project-review-20261030/python-summary.json)。Python 42 项在接手后的同一提交工作树重新执行通过；Java/MySQL 与探针记录来自原任务的隔离运行，其提交号、源文件快照及结果已核对。
- [可重复执行的探针](../../scripts/probe-project-review.py)：商品/购物车/提案并发场景采用直接 SQL 事务控制阻塞方，观察 `performance_schema.data_lock_waits` 后提交，再检查真实 Spring HTTP 请求的结果；它们不是两个完整浏览器交易的压力测试。AI 两项直接运行生产 Python 函数，R08 明确使用模型替身。

```powershell
python -X utf8 -B scripts/verify-mysql-isolated.py --mysql-bin 'D:\develop\mysql-8.0.31-winx64\bin' --maven .\mvnw.cmd --offline --http-smoke --artifact-dir var/review-20261030/verified-build --output var/review-20261030/mysql.json
python -X utf8 -B scripts/probe-project-review.py --mysql-bin 'D:\develop\mysql-8.0.31-winx64\bin' --jar var/review-20261030/verified-build/campus-shopping-app.jar --output var/review-20261030/probes-final.json
```

路径应按本机调整；浏览器阶段需要可用 Chromium。脚本不读取私有 `.env`，不使用业务数据库或远程 AI/Milvus。没有重新验收 Docker、Qdrant、真实远程模型、生产部署或性能。

首轮探针观察到 8 项现象，但 Windows 上直接结束 MySQL 父进程没有正确清理子进程，目录删除发生文件占用异常，未生成完整 JSON。第二轮保留了[锁等待观测失败记录](../testing/evidence/project-review-20261030/probes-before-barrier-fix.json)；调整为直接使用 performance_schema 锁等待关系后，最终一轮完整复现 8 项，且通过 SQL SHUTDOWN 成功清理该轮临时数据库。

首轮遗留 MySQL 进程 PID **23588** 已停止。删除其目录 `C:\Windows\Temp\campus-review-probe-jig3bjqg` 的操作被自动审批拒绝，仅返回 **blocked by policy**，该目录仍遗留；没有将其记成清理成功。最终完整轮次及基线轮次的临时数据库均已清理。没有覆盖原工作目录的未提交改动。
