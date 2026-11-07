# Design

## Context

见 `proposal.md`。现有链路已经由 Java 复核可售 SKU、库存、权限和 Proposal，但 `specKey` 是单一字符串，Python/Java 约束解析需保持一致；语义商品 ID 在 Java 重新查询后目前只映射为集合，引用只核验文档正文包含片段。现有评测器已有 FAILED/NOT_RUN/PENDING 概念，需扩展而不重写历史结果。

## Goals / Non-Goals

**Goals:**

- 在不改变外部交易写接口的前提下，提供可验证的属性、预算、数量和多轮上下文。
- 保留语义来源 rank 到 SKU 候选，确保融合顺序可重现。
- 将引用定位和评测证据覆盖变成可机器核验的契约，并保留人工支持率的待评状态。

**Non-Goals:**

- 不让 Python、LLM、Milvus 直接修改价格、库存、权限或购物车。
- 不在本次运行真实供应商模型、修改 DRAFT Gold、声称正式 AI 效果验收。
- 不做无关前端重构，不迁移或清理既有业务库。

## Decisions

1. **属性事实**：在 Catalog 尚未提供 SKU 结构化属性前，先以稳定的 `specKey` 事实和显式属性前缀支持约束；对“无糖/无乳糖”等没有事实来源的要求返回澄清。AI 候选协议的 `attributes` 字段可由后续 Catalog 版本填充，旧数据空属性不自动推断。
2. **多轮状态**：在 Java Proposal/Conversation 的短事务快照中保存上一轮候选 ID、报价版本、价格和约束摘要；远程调用只接收最小摘要。换选和相对价格过滤在 Java 与 Python 都执行，最终以 Java 实时报价为准。
3. **语义排名**：将 Python 返回的产品 ID 与其 1-based rank 一起封装，Java 先按该 rank 融合再构造带 `semanticRank` 的 SKU 摘要；为了兼容旧 Python，缺失 rank 的响应按返回序号记录为降级来源并显式标记。
4. **引用**：知识文档用 `documentId + version + chunkId + ordinal + snippet` 定位。Java 将实际文档版本传给 Python 索引，Python 返回版本并生成确定性分块；Java 从当前文档版本读取 chunk 后比对 hash/位置；内部可见文档只允许脱敏引用。Python 不返回未经允许的内部正文。
5. **评测**：扩展现有 `metrics.py`，新增 `evidenceRecall` 和 `answerSupport` 的分离结果；不修改已提交 JSON，评测输出记录 scorer/dataset hash、profile、adapter、status 和失败分母。

## Risks / Trade-offs

- [属性字段与旧客户端不一致] → 字段可选，生成契约同步，旧 SKU 走澄清而非错误推荐。
- [新增多轮快照扩大会话数据] → 仅保存 SKU/价格/版本/约束摘要，不保存 prompt 或内部正文，并沿用现有会话租约和清理策略。
- [旧 Python 服务无 rank/chunk 版本] → Java 将其视为降级协议并拒绝无法证明的引用；先在同一提交更新双方，再由契约测试锁定。
- [真实模型未执行] → CI 只验证协议、规则和隔离事实；正式验收仍单独运行并标注 REAL。

## Migration Plan

本批次不新增业务库迁移；AI 服务本地索引仅向后兼容地补充文档版本列，已有索引按版本 1 读取，新索引由 Java 传入实际文档版本。先更新 Python/Java 双写读，再启用新字段；回滚时保留旧字段读取但对缺少可信属性的请求澄清。评测器输出新目录，不覆盖历史证据。

## Open Questions

无。属性词典和人工 Gold 审核属于正式效果验收阶段，不改变本批次接口与任务拆分。
