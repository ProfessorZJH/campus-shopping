# Spec Delta

## Purpose

为校园智能导购建立可复现、可审计的检索与推荐评测能力，覆盖固定业务数据、人工相关性标注、分层运行、指标口径、对照实验与报告。明确本地算法、测试替身和真实依赖的证据边界，保留交易事实复验及知识授权隔离，避免以演示命中率或历史联调替代业务质量结论。

## ADDED Requirements

### Requirement: Versioned and validated evaluation dataset
评测系统 SHALL 使用有版本、内容摘要和固定划分的数据集，记录案例、语料、业务快照、角色及约束。首版 SHALL 覆盖至少 120 个案例、12 类业务场景及多相关项；标识缺失、悬空引用、非法金额/权限或跨集合近重复 MUST 阻止正式评测。

#### Scenario: Reproduce an accepted dataset
- **WHEN** 两次运行选择相同的数据、划分、算法配置和代码版本
- **THEN** 报告记录相同输入摘要和案例集合，本地确定性路径的排名、非计时指标与失败归因一致
- **AND** 时间、随机运行标识与真实模型输出不被承诺为逐字节相同

#### Scenario: Reject invalid or contaminated inputs
- **WHEN** 案例引用不存在的 SKU/证据、使用不同快照的标签，或同一问题家族跨开发与验收集
- **THEN** 校验返回明确的数据错误和非零退出码，不输出伪造的有效质量分数

### Requirement: Human governed relevance annotations
相关性标签 SHALL 依据冻结语料与业务规则产生，按 0/1/2 级标注检索相关性，并独立记录可售条件、禁止事实、预期澄清/拒绝及证据支撑。系统 MUST 区分草稿与人工复核标签；模型或被评系统自身输出 MUST NOT 自动成为金标准。

#### Scenario: Use an unreviewed label set
- **WHEN** AI 生成标签尚未经过具名或匿名编号的人类标注者复核
- **THEN** 结果只能作为 DRAFT/探索输出，不能标为正式基线或业务验收通过，报告列明未复核数量

#### Scenario: Judge a no answer or ambiguous request
- **WHEN** 请求没有相关可售结果或预算/数量存在歧义
- **THEN** 标签明确预期无推荐或澄清，空相关集合不被当作 Recall=1，执行结果按对应行为指标判定

### Requirement: Explicit component provenance and scope
每个运行和案例 SHALL 记录请求的实验路径、实际生效路径及 Embedding、LLM、商品向量库、知识向量库、Java/MySQL 的实际参与情况，区分本地、受控替身、真实调用与未运行。仅凭配置、健康检查或响应的 mode 字符串 MUST NOT 证明真实依赖已执行。

#### Scenario: Stub claims the same mode as a remote provider
- **WHEN** 受控替身返回 LLM 或 MILVUS 模式标记
- **THEN** 该次结果仍明确为受控替身，不计入真实 LLM/Milvus 的统计或验收

#### Scenario: A requested live dependency fails or falls back
- **WHEN** 真实依赖不可用、返回降级结果或所需组件未被实际调用
- **THEN** 报告保留失败/降级及组件证据，声明该真实路径未完整完成，不与正常真实路径合并为通过

### Requirement: Stage specific ranked retrieval metrics
系统 SHALL 分别计算知识 chunk/document、商品 product、SKU 候选池和最终推荐指标，声明各自候选范围、排序、K 值与去重规则。Recall SHALL 使用全部已标注相关项作分母；Hit、MRR 与分级 nDCG MUST 按各自定义计算，不能以商品 ID 代替 SKU 或把最终三个推荐当全部候选。

#### Scenario: Multiple gold items distinguish recall from hit
- **WHEN** 某例相关项为 A、B、C，前两项检索结果为 X、B
- **THEN** Recall@2 为 1/3、Hit@2 为 1、MRR@2 为 1/2，重复返回 B 不增加命中数

#### Scenario: Labels or candidate stage do not exist
- **WHEN** 某任务没有相关性标签，或直接向 Python 注入候选而未执行 Java 全目录召回
- **THEN** 缺失指标为 N/A 或对应阶段为 NOT_RUN，不把未测的全目录 Recall 填为 0、1 或候选内重排分数

### Requirement: Complete denominators and recommendation behavior
系统 SHALL 报告逐例及分类宏平均、总案例数、可计分数、失败数、未运行数和适用范围。推荐 SHALL 评估预算合计、数量、库存、经营/发布状态、商户范围及数据集中声明的规格/否定要求，同时报告有效推荐覆盖率、无结果/澄清正确率，防止用全部空回答获得高分。

#### Scenario: A feasible request returns nothing
- **WHEN** 标签显示存在满足需求的结果，但系统返回空推荐
- **THEN** 覆盖率和该例请求成功判定失败，推荐项安全率不因分母为空被填为 100%

#### Scenario: An evaluated case times out
- **WHEN** 一个选定的案例尝试执行后超时或异常
- **THEN** 它保留在总例数和执行失败分母中，其适用检索/成功指标按失败计分，报告不能只统计成功返回的案例

#### Scenario: A failed experiment produces no stage trace
- **WHEN** 已尝试的K、Java/MySQL P或R实验异常，返回FAILED且stages为空
- **THEN** 系统按实验任务和适配器确定应评分阶段，有gold的适用Recall、Hit、MRR、nDCG按0进入宏平均和配对比较，NOT_RUN与无标签仍独立保留

#### Scenario: A machine verifiable hard constraint is violated
- **WHEN** 结果违反数量、整组预算、库存、经营或发布状态、商户范围、明确属性/否定、SKU唯一性、引用合法性或禁止事实边界
- **THEN** 自动评分及离线重算MUST返回非零退出码和FAILED状态，记录具体违规指标；不得因数据为DRAFT或案例未标sensitive而放行
- **AND** 空推荐的项约束为N/A，相关性/覆盖率不足和待人工语义仅作为质量或待评结果，不误记为硬规则违规

### Requirement: Separate source validity from answer grounding
系统 SHALL 分开检查引用的授权、版本与定位有效性，以及回答断言是否获得证据支持。自动定位与合成 canary 检查 MUST NOT 冒充完整的语义支撑人工判定；未复核断言 SHALL 标为待评并计入覆盖率。

#### Scenario: Correct document with an unsupported assertion
- **WHEN** 回答引用的文档可访问且片段存在，但回答中的退款条件与证据矛盾
- **THEN** 来源有效性可以通过，回答支撑判定失败或待人工评审，不输出自动“引用完全正确”的结论

### Requirement: Preserve authorization and transaction boundaries
评测 SHALL 保留 Java 对价格、库存、经营资格、权限、会话归属、提案过期及幂等的现有裁决。候选、向量结果和模型建议 MUST NOT 直接变成交易命令；知识白名单和响应前复权不得由评测开关放宽。真实业务安全结论 SHALL 有 Java/MySQL 与状态读回证据支持。

#### Scenario: Recommendation becomes stale before confirmation
- **WHEN** 生成提案后商品变价、下架、库存不足或商户被停用，用户再确认
- **THEN** Java 按当前规则拒绝无效确认且不留下部分购物车写入，报告记录实际错误及读回状态

#### Scenario: Cross user or repeated confirmation
- **WHEN** 其他用户确认提案、提案已过期，或同一用户重复确认已成功选择
- **THEN** 越权/过期请求被拒绝；相同有效选择的幂等重放不重复加购，不把“所有重复必须拒绝”当金标准

#### Scenario: Scope changes while generating an answer
- **WHEN** 内部文档未授权，或生成期间撤回文档/撤销商户成员知识权限
- **THEN** 未授权内容、标识、标题、引用与旧历史均不得越过现行服务端规则泄漏，结果以 Java 实际响应和读回核对

### Requirement: Controlled and attributable comparisons
对比实验 SHALL 固定数据划分、业务快照、授权、K、模型/索引/提示版本及运行范围，区分知识与商品实验。改写、混合与生成的对照 SHALL 明确唯一主要变量；不支持的算法 MUST 标为 UNSUPPORTED，不能用替身排名宣称真实算法收益。

#### Scenario: Compare rewrite or hybrid retrieval
- **WHEN** 运行原始查询与改写查询，或稀疏、稠密与融合检索对照
- **THEN** 报告给出同案例配对差异、失败覆盖及实际组件，配置不一致时拒绝直接归因于该变量

#### Scenario: Request a nonexistent reranker
- **WHEN** 请求历史计划中的独立 reranker，而当前实现没有该能力
- **THEN** 明确报告 UNSUPPORTED，不启用新平台或将现有 LLM 推荐选择冒充该算法

### Requirement: Reproducible and privacy conscious reports
系统 SHALL 留存配置/版本摘要、逐例脱敏结果、指标分子分母、失败样例、运行状态与可读报告，并可从保存结果重算指标。案例文本仅使用可公开的合成/脱敏评测材料；报告 MUST NOT 包含凭据、真实内部文档、完整模型提示或下游异常正文。历史证据 MUST 保留原边界。

#### Scenario: Recompute a report offline
- **WHEN** 使用相同评分器版本对已保存逐例结果重新聚合
- **THEN** 非计时质量指标与原报告一致，不需要重新调用供应商或重新获取业务数据

#### Scenario: Review historical demo results
- **WHEN** 查看旧的 8 条本地知识样本报告
- **THEN** 保留原报告并解释其单相关项命中口径，不将旧 1.0 填入新数据集、商品召回或真实模型对比表

### Requirement: Honest latency and external execution controls
系统 SHALL 区分检索、生成与 Java 整链路耗时，记录预热、测量次数、错误率和分位数算法。未实现的流式首 Token 延迟 MUST 为 N/A。离线默认运行 SHALL 不加载真实凭据、不发外部请求；真实实验仅在明确启用及调用预算内执行。

#### Scenario: Non streaming response timing
- **WHEN** 当前服务返回完整 JSON 而非流式响应
- **THEN** 报告可给出完整响应耗时，首 Token 延迟为 N/A，局部耗时不冒充整链路或生产 P95

#### Scenario: Live run lacks authorization or configuration
- **WHEN** 未启用真实外部执行、缺少所需凭据或调用预算不足
- **THEN** 相关实验标为 NOT_RUN 并说明原因，不继承历史授权、不读取生产数据、不静默改为替身后宣称真实通过
