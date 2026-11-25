# Design

## Context

See `proposal.md` for motivation. 当前知识检索先分别得到 BM25 和 dense 排名，再按 RRF 合并；商品回答路径则把 BM25 商品索引与 Java 可信语义 SKU 顺序合并。两处排序都必须继续由 Python 负责候选建议，不能改变 Java 对价格、库存、预算、SKU、权限和成交事实的最终裁决。

## Goals / Non-Goals

**Goals:**

- 用无状态纯函数承载 RRF 分数累加、稳定分数排序和 Top-K 截断。
- 保持现有排名遍历顺序、RRF 常数、平局键、trace 内容和空结果行为。
- 让知识检索与商品推荐共享排序原语，但不共享存储、供应商或业务约束对象。

**Non-Goals:**

- 不调整 BM25 参数、向量阈值、检索范围、候选数量或任何推荐业务规则。
- 不改 `Provider`、SSE worker、FastAPI 路由、SQLite/Qdrant/Milvus、跨语言契约或 Java 接口。
- 不引入重排模型、机器学习依赖、异步任务或新的数据库结构。

## Decisions

1. 新模块只接收已计算的 `(item, score)` 排名序列，输出分数映射和稳定排序后的 item 列表；它不读取 `KnowledgeStore`、`Settings`、HTTP 客户端或商品字段。这样可以在两个调用方复用算法而不扩大领域依赖。
2. RRF 使用现有 `60 + rank` 分母，排名从 1 开始，按现有 ranking 输入顺序累加；稳定 Top-K 接受调用方提供的平局键，知识检索仍按 chunk ID、商品候选仍按原 eligible 索引排序。
3. 保留 `bm25`、dense 召回和约束过滤在原模块。排序模块只负责融合，不拥有召回、权限、预算、库存或规格语义。
4. 通过纯函数单测锁定空排名、跨排名累加、平局排序和截断；现有 `test_evaluation_seams`、`test_rag_corrections`、`test_service` 与 `test_sku_constraints` 证明集成行为未变。

## Risks / Trade-offs

- [Risk] 通用排序函数被误用来承载业务过滤 → 通过只接受排名序列、在调用方完成授权和硬约束来限制边界。
- [Risk] 抽取时改变字典插入顺序或平局键，导致结果顺序漂移 → 保留遍历顺序与原 tie-break，并用等价性回归覆盖。
- [Risk] 后续调用方传入重复 item 改变分数 → 当前实现沿用旧逻辑逐条累加；调用方继续负责生成去重且有序的排名。

## Migration Plan

1. 新增 `ranking.py` 纯函数及单元测试。
2. 逐一替换 `KnowledgeStore.search` 和 `engine.answer` 的内联 RRF/排序，不改变其输入准备和输出组装。
3. 运行 Python 定向回归、OpenSpec 严格校验和差异检查。
4. 回滚只需回退本次提交，不涉及数据、索引、配置或部署迁移。
