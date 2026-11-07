# Spec Delta

## Purpose

让导购评测区分检索合法性、相关证据覆盖、回答支持、无匹配与澄清正确性，避免 DRAFT Gold 或模型替身结果被误报为正式 AI 效果验收。

## ADDED Requirements

### Requirement: Evidence metrics keep separate denominators
评测 MUST 分开报告 citation validity、evidence recall/coverage 和人工回答支持率；无 Gold、未执行、失败和待人工状态 MUST 使用不同状态，不得互相转换。

#### Scenario: Authorized but unsupported answer
- **WHEN** 引用合法但回答断言没有被 Gold 证据支持
- **THEN** 合法性保持通过，支持率为待人工或 0，证据覆盖不被高估

#### Scenario: Not run
- **WHEN** 真实模型、Embedding 或 Milvus 因缺少配置未执行
- **THEN** 该路径标记 NOT_RUN，不继承替身或历史分数

### Requirement: Product and recommendation stages are not conflated
Python 注入候选的推荐排序 MUST NOT 生成 Java/MySQL 全目录商品召回指标；商品词面、语义和混合路径 MUST 使用相同冻结数据并分别记录来源。

#### Scenario: Python recommendation fixture
- **WHEN** 评测仅执行 Python R-RULE
- **THEN** 报告只包含推荐阶段指标，不产生 product.fused 或 sku.pool 指标

### Requirement: Formal completion requires reviewed data
正式效果验收 MUST 要求 ACCEPTED Gold、人工回答评审、实际模型/索引来源和完整失败分母；DRAFT 或模型替身结果只能标记阶段性结果。

#### Scenario: Draft dataset
- **WHEN** 数据集仍为 DRAFT 或 reviewer 为空
- **THEN** CLI 不报告正式通过，输出 PARTIAL/PENDING 及未验证原因
