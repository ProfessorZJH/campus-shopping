# ShoppingAI / RAG 批次 A+B 实施记录

本轮基于 `main` 的 `14e7135`，按 ShoppingAI 深度审查推进批次 A+B；正式模型、Embedding、Milvus 和人工 Gold 效果验收另行执行。本记录只描述代码和自动回归，不把替身结果当成真实 AI 效果通过。

## 已实现

- Java/Python AI 候选协议增加可选结构化 `attributes`；未知属性、否定属性和冲突规格安全澄清，不从商品标题推断糖分、颜色等 SKU 事实。增加“备货/到货”知识意图词，避免知识问题被当作推荐。
- Java 读取同一 actor/conversation 的最新待确认 Proposal，`换一个` 排除上一轮 SKU，`便宜点` 要求低于上一轮报价，再交给 Python 和 Java 的既有库存、预算、规格复验。
- 连续改选始终取按 `created_at DESC` 返回的最新待确认 Proposal；未知硬否定属性即使伴随已知正向规格也保持澄清，预算区间和“两三件”数量在 Java/Python 两端统一判为歧义。
- 语义商品响应保留 `productRanks`；Java 通过 `SemanticProductRankVO` 将 rank 传入 RRF 和 SKU 顺序。旧服务没有 rank 时仅按返回顺序生成并标记迁移兼容 rank。
- 引用响应增加文档版本、chunk ordinal、内容 hash；Python 输出确定性分块信息，Java 按 UUID5、700/80 分块规则、版本和 hash 复验。旧引用协议保留兼容读取路径，新的完整协议拒绝错版本、错 chunk 和错片段。
- 评测增加 `evidenceRecall`，将合法引用率、Gold 证据覆盖与人工回答支持率分开；DRAFT、NOT_RUN、PENDING 状态继续独立。
- 评测新协议严格核对 `documentVersion`、`ordinal`、chunk hash，并单独记录 `strictCitationValidity` 与旧协议兼容计数；多轮继承后的未知否定属性继续保持澄清。
- 旧 Python 引用缺少新字段时由 Java 网关显式归一化为旧协议；SQLite 历史索引没有可信文档版本时不再默认声称为版本 1，必须重新索引后才参与检索。
- 有 chunk 级 Gold 的案例按 `(documentId, ordinal, chunkHash)` 计算 `evidenceRecall`，没有该标注的旧案例保留文档级兼容口径。
- Java 网关和引用复验统一按 Unicode code point 计数，避免包含 Emoji 的 500 字符片段被 UTF-16 长度误拒；严格引用分母在授权判断前统计，未授权新协议引用记为失败。

## 自动验证

- `ai-service`：223 项 pytest 通过，包含结构化属性、语义 rank 顺序、预算/数量歧义、跨语言规格继承、旧引用兼容、SQLite 迁移和 chunk 级证据召回回归。
- Java：`DddRulesTest`、`SkuConstraintPolicyTest` 共 17 项定向回归通过；最近一次 `mvnw clean verify` 全模块构建成功，267 项测试中 179 项执行通过、88 项按环境跳过。
- `python scripts/verify-api-contract.py`、`verify-api-schemas.py`、`schema_contract.py --check` 和 OpenSpec strict 校验通过。
- 未在本机启动隔离 MySQL/Redis，也未调用真实外部模型、Embedding 或 Milvus；这些属于后续正式验收范围。

## 限制与后续

当前 Catalog 数据模型仍只有 `specKey`，未把糖分、乳糖、颜色等属性写入 MySQL；因此没有可信属性时系统会澄清，这比错误声称满足禁选条件更安全。AI 服务本地索引会携带 Java 传入的文档版本；历史 SQLite 索引没有可信版本时会被排除，必须重新索引后才参与引用复验。若要支持这些属性的可售筛选，需要单独设计不可变迁移、录入契约和数据回填，不在本批次静默扩张。
