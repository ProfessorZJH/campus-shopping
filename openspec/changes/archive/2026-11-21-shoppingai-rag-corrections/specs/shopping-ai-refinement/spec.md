# Spec Delta

## Purpose

让导购在预算、数量、商品属性和多轮改选上保持可解释且可验证的约束行为，使模型建议只能在 Java 已核实的可售事实范围内产生。

## ADDED Requirements

### Requirement: Ambiguous purchase constraints are clarified
系统 MUST 将预算区间、模糊数量、冲突预算或超出允许范围的数量标记为歧义/无效，并在返回推荐前要求用户澄清；系统 MUST 使用分为单位计算预算。

#### Scenario: Budget range
- **WHEN** 用户说“20到30元买水”
- **THEN** 系统不选择任一端点作为确定预算，并返回预算澄清，不生成购买建议

#### Scenario: Approximate quantity
- **WHEN** 用户说“买两三瓶水”
- **THEN** 系统不把数量设为 2 或 3，并返回单项数量澄清

#### Scenario: Valid decimal budget
- **WHEN** 用户说“预算 12.50 元”
- **THEN** 系统以 1250 分执行预算过滤

### Requirement: Explicit and negative attributes are grounded in SKU facts
系统 MUST 将明确的规格/属性要求与 SKU 结构化属性或规格事实匹配；商品标题、描述和模型文本 MUST NOT 单独证明无糖、无乳糖等适用性。未知或冲突的明确属性 MUST 触发澄清，禁止以其他规格替代。

#### Scenario: Forbidden structured attribute
- **WHEN** 用户要求“不要家庭装”，且报价中仅有家庭装与标准装规格
- **THEN** 家庭装不得进入候选或提案

#### Scenario: Unknown attribute
- **WHEN** 用户要求“不要含糖”，但报价没有糖分结构化事实
- **THEN** 系统说明无法核实并澄清，不声称商品无糖

#### Scenario: Product title color
- **WHEN** 商品标题含“黑色”但 SKU 没有颜色属性，用户询问黑色商品
- **THEN** 系统不把标题颜色当作 SKU 规格约束

### Requirement: Multi-turn replacement preserves safe context
系统 MUST 在同一会话中保存上一轮展示的 SKU、价格和约束摘要；“换一个” MUST 排除上一轮展示的 SKU，“便宜点” MUST 只接受低于上一轮比较基准的当前真实报价。身份、会话或权限变化后 MUST 丢弃旧上下文。

#### Scenario: Replace previous offer
- **WHEN** 用户先接受展示 SKU A，随后说“换一个”
- **THEN** 系统不再次推荐 A，并仅从当前授权可售候选中选择

#### Scenario: Cheaper follow-up
- **WHEN** 用户上一轮展示价格为 12 元，随后说“便宜点”
- **THEN** 系统只返回当前价格小于 12 元的候选，找不到时明确无匹配

### Requirement: Semantic rank reaches SKU ranking
系统 MUST 保留语义检索结果的稳定 rank，并将该 rank 映射到商品及 SKU 候选；数据库返回顺序或 SKU ID 排序 MUST NOT 代替语义 rank。

#### Scenario: Semantic-only match
- **WHEN** 商品只在语义召回中命中且没有词面命中
- **THEN** 该商品仍可进入融合候选，其 SKU 保留语义来源 rank

#### Scenario: Tie is deterministic
- **WHEN** 两个候选融合分数相同
- **THEN** 系统按来源 rank 再按稳定 ID 进行确定性排序
