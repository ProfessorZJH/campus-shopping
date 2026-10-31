# 项目修复后的追加审查

> 后续处理：本页列出的 3 项 AI 规则和 3 项列表/知识范围问题已进入[最终修复与复验](DDD-DOC-CLOSURE-20261030.md)。下文保留发现时的复现、原因和未运行边界。

日期：2026-10-30。审查对象是 `37124d0` 基线上的未提交修复工作树；本轮没有修改生产代码，也没有重新执行完整 Maven/MySQL、浏览器或远程模型验收。前轮修复与验收见 [修复报告](PROJECT-REVIEW-FIXES-20261030.md)。

## 结论

前轮记录的 R01–R08 与 S01–S04 已有修复和隔离复验；本轮没有发现它们回退。另发现 **3 个已用生产 Python 逻辑复现的 AI 约束错误**，以及 **3 个源码确认的列表/知识范围截断问题**。其中 AI 的最终商品建议会经过 Java 的 SKU、库存和数量范围复核，但 Java 不解析自然语言预算，也不恢复上一轮购买数量，因此不能由现有 Java 复核消除这些错误。

“已复现”限于本地检索路径及临时 SQLite；没有把它记成真实讯飞/Milvus 或完整 Spring/MySQL 端到端复现。原始输入与结果见 [追加探针](evidence/project-review-20261030/followup-ai-probes.json)。

## 已复现的问题

| 优先级 | 输入与观察 | 原因与影响 |
| --- | --- | --- |
| P2 · 中文预算 | “预算二十元买一瓶矿泉水”被解析成无预算，30 元商品仍被推荐；本地真实 FastAPI `/v1/query` 也返回该建议。 | `budget_cent` 只识别阿拉伯数字；推荐理由仍声称预算已校验。Java `RecommendationPolicy.select` 只核实 SKU、数量范围和库存，不检查预算，错误建议可进入提案。 |
| P2 · 模糊数量 | “买十几瓶矿泉水”被视为未指定数量，推荐 1 瓶。 | `quantity_intent` 没有将“十几”判为需要澄清的数量；后续使用 `requested or 1`。用户给出了数量范围，不宜静默当作 1。 |
| P2 · 多轮数量 | 先问“预算20元买两瓶矿泉水”，再说“换一个”；改写查询保留“两瓶”，建议却变为 1 瓶。单独运行 `quantity_intent('换一个')` 还得到 `(1, 'VALID')`。 | `answer` 可以从改写查询继承预算，但数量只从当前问题解析；“换一个”中的“一个”被误认为购买数量。Java 只接受模型返回的 1 件建议，不对照会话中的购买数量。 |

对应源码：[engine.py](../../ai-service/app/engine.py) 的 `budget_cent`、`quantity_intent`、`answer`；[ShoppingAiCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/ShoppingAiCaseImpl.java) 的商品复核；[RecommendationPolicy.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/shoppingai/service/RecommendationPolicy.java) 的 `select`。

建议把预算与数量抽取统一成有状态的约束解析：明确区分有效、含糊、超限、未指定；后续追问只有在语义确实沿用原需求时才继承约束。预算无法可靠解析时要求澄清，不输出“已校验”理由。补中文金额、模糊数量和多轮替换的 Python 与 Java 契约测试。

## 源码确认，尚未独立运行复现

| 优先级 | 位置与影响 |
| --- | --- |
| P2 · 可见知识文档截断 | [iaidao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/iaidao_mapper.xml) 的 `visibleScope` 按 ID 排序并固定 `LIMIT 1000`；[KnowledgeCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/KnowledgeCaseImpl.java) 允许知识库中的文档分页增长，但导购只把前 1000 个已发布文档 ID 交给检索和引用核验。超过该数量时其余文档可能静默退出导购可见范围。需用 1001 份文档验证，或设计完整分页读取/明确上限。 |
| P3 · 历史会话截断 | [iaidao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/iaidao_mapper.xml) 的 `conversations` 固定 `LIMIT 100`；[ShoppingAiController.java](../../campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/ShoppingAiController.java) 无分页参数，[Guide.js](../../frontend/src/pages/Guide.js) 无加载更多。第 101 个及更早会话仍在库中，若用户不知道 ID，无法从页面找回。 |
| P3 · 邀请列表截断 | [iaccessdao_mapper.xml](../../campus-shopping-app/src/main/resources/mybatis/mapper/iaccessdao_mapper.xml) 的 `invitations` 固定 `LIMIT 100`；[WorkspaceController.java](../../campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/WorkspaceController.java) 和 [Account.js](../../frontend/src/pages/Account.js) 无分页。大量历史邀请会使更早的待处理邀请从界面消失；尚未验证是否能在实际业务规则下累积到该数量。 |

## 部署边界

[AuthenticationRateFilter.java](../../campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/AuthenticationRateFilter.java) 按连接地址和路径计数。修复后的 `prod` 配置已避免客户端伪造转发头绕过限流；反向代理或共享 NAT 下多个真实用户可能共用额度。这是已在[运行手册](../operations/R1-runbook.md)说明的部署条件风险，本轮没有代理部署复现，不重新列为已复现代码缺陷。入口需要按可信身份/来源做统一限流，并用实际代理拓扑验证。

## 验证边界

本轮读取未提交修复后的源文件与追加探针证据，确认 Java 复核范围、SQL 上限和页面入口。没有运行新的完整构建、真实 MySQL 扩容数据、远程模型/Milvus、Docker 或性能测试。前轮 181 Java、173 HTTP、8 浏览器、44 Python 等结果仅属于前轮修复验收，不代表以上新增场景通过。
