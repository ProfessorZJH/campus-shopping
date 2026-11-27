# Spec Delta

## Purpose

在保留 `campus-shopping-v1` 及既有评测契约兼容的前提下，定义 Campus Shopping Benchmark V2 的大规模全语料合成数据治理、跨家族防泄漏划分、未实现能力独立挑战集、多角色/多版本权限复验、异常状态精确统计以及独立 SSE 流式首 Token 延迟测量要求。

## ADDED Requirements

### Requirement: Full-corpus deterministic V2 benchmark and challenge isolation
系统 SHALL 提供独立于 V1 的 `campus-shopping-v2` 合成评测集，包含 360 条主评测场景（覆盖 12 个主分类，划分为 144 条开发集与 216 条测试集，smoke 子集严格取自开发集）、8～12 家合成商户、400～600 个商品、800～1,200 个 SKU 及 60～100 个知识文档版本，并将尚未实现的产品能力单独收录于显式标记 `UNSUPPORTED` 的挑战集。语料 MUST 明确标识为合成数据且不含真实个人信息，禁止通过唯一商品串号拼接问题凑数。

#### Scenario: Validate V2 corpus scale, split ratios, and family isolation
- **WHEN** 加载并校验 `campus-shopping-v2` 数据集
- **THEN** 清单文件 SHA-256、360 条主场景类别分布、144/216 划分及外键约束全部通过校验
- **AND** 语义等价或改写问题归属同一多样本 `familyId`，任一 `familyId` 或高相似近重复样本不得跨越开发集与测试集

#### Scenario: Evaluate unsupported product capabilities via challenge set
- **WHEN** 运行针对未实现能力（如独立 reranker、优惠券满减、跨商户合单支付、外卖配送、已提货退货或扫描件 OCR）的挑战集或实验项
- **THEN** 系统显式记录状态为 `UNSUPPORTED` 并单独统计，不伪造通过分数，也不混入已支持能力的质量分母

### Requirement: Complete corpus Gold relevance and honest draft governance
V2 的 Gold 相关性标签 SHALL 基于完整商品、SKU 与知识分块语料独立确定性求解，区分主题相关性（`grade=1`）与满足全部硬约束的可行推荐/核心证据（`grade=2`），不得使用被测模型输出直接生成标准答案。未经真实人类逐例审阅的数据 MUST 保持 `AI_ASSISTED` 与 `DRAFT` 状态。

#### Scenario: Distinguish topical relevance from feasible recommendation across full catalog
- **WHEN** 某查询在全语料中存在多个同品类商品，其中部分有货合规、部分缺货或超预算、部分属停用商户或已下架
- **THEN** 所有有货且满足硬约束的目标项均进入 `grade=2`，同品类但缺货/超预算/次优报价的已上架活跃商户项标为 `grade=1`，下架与停用商户商品不作为有效正例
- **AND** 消费者跨店比较场景的候选范围覆盖全部活跃商户，不得预先按目标门店裁剪候选池

#### Scenario: Export human review package without fabricating approval
- **WHEN** 导出 `campus-shopping-v2` 的 Gold Review Package 或执行 `--formal` 检查
- **THEN** 复核包完整包含 360 条场景、全量商品/知识语料、标注依据、潜在争议标记与可编辑 `annotations.jsonl`
- **AND** 在人类实际填写评审身份、时间并解除争议前，`--formal` 与 `--release-strict` MUST 拒绝将其判定为正式冻结基线

### Requirement: Clerk RBAC, multi-version knowledge, and accurate status accounting
评测与隔离 Java/MySQL 夹具 SHALL 支持消费者、商户经营者、具备或缺少 `knowledge.read` 权限的店员以及平台管理员的知识可见性核验，支持同一知识根下的多版本演进，并在统计与报告中严格区分 `EXECUTED`、`DEGRADED`、`FAILED`、`NOT_RUN` 与 `UNSUPPORTED`。

#### Scenario: Verify clerk permission boundary and document version superseding
- **WHEN** 店员角色未授予 `knowledge.read` 或知识文档存在已撤回/被替代的旧版本
- **THEN** 服务端计算的实际可读范围与评测预期严格一致，未授权内部资料与撤回旧版本不得进入合法引用

#### Scenario: Crashed or degraded executions are not misreported as clean live passes
- **WHEN** 执行过程中案例发生异常（`FAILED`）或因预算/上游故障降级（`DEGRADED`）
- **THEN** `FAILED` 空输出不得被计为“已验证零泄漏”，`DEGRADED` 快速失败耗时与纯成功执行耗时分开可辨，配对比较显式记录降级样本数

### Requirement: Independent SSE streaming first-token latency measurement
当评测 SSE 流式导购首 Token 延迟时，系统 SHALL 通过真实流式 HTTP/SSE 链路逐帧采集事件到达时间，MUST NOT 从非流式 JSON 接口耗时推导或估算首 Token 延迟。

#### Scenario: Measure real streaming chain milestones
- **WHEN** 执行流式延迟专项实验（`S-SSE`）
- **THEN** 系统独立记录 `started`、`progress`（如适用）、首个用户可见文本 `delta` 及 `completed` 的墙钟分位数（P50/P95）与错误计数
- **AND** 非流式实验的 `firstTokenMs` 继续保持 `N/A`（`null`）
