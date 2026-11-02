# Tasks

## 约束与多轮导购

- [x] 1. 扩展 AI 候选 SKU 的结构化属性字段与 Java/Python DTO/协议，兼容旧数据并补契约测试；Catalog 尚无属性事实时安全澄清。
- [x] 2. 统一预算区间、模糊数量、未知否定属性和商品/知识/交易意图规则；补 Java/Python 共享回归。
- [x] 3. 复用会话 Proposal 的上一轮候选/报价/约束摘要，实现“换一个”和“便宜点”的服务端过滤，并按 actor/conversation 隔离上下文。

## 语义排序与证据链

- [x] 4. 保留语义产品 rank 并映射到 SKU 融合排序，增加旧协议降级标识和确定性排序测试。
- [x] 5. 扩展引用定位到文档版本、chunk ordinal/hash，Java 与 Python 共同拒绝错版本、错 chunk 和内部片段；旧协议仅保留迁移兼容路径。

## 评测与验证

- [x] 6. 修正 evidence recall/coverage 与回答支持率评分口径，保持 DRAFT/NOT_RUN/PENDING 分离并新增指标测试。
- [x] 7. 执行格式、API/Schema/迁移契约、Python/Java 回归和隔离 MySQL/HTTP 测试，记录未运行的真实模型/Milvus 验收范围。
- [x] 8. 更新 SDD/评测入口引用与本次报告，复核 diff、凭据扫描和 PR 交付状态；不合并、不部署。
