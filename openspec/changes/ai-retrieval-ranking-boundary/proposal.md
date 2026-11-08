# Proposal

## Why

`KnowledgeStore.search` 和 `engine.answer` 都内联了 BM25/语义结果的 Reciprocal Rank Fusion（RRF）与稳定排序逻辑，检索存储、推荐编排和排序细节因此形成静态耦合。Provider 边界已经收口后，下一步把纯函数排序能力抽出，可以让知识检索和商品候选融合分别演进，同时保持现有结果顺序、降级模式、追踪字段与输出契约不变。

## What Changes

- 新增无 I/O 的检索排序模块，集中维护 RRF 分数合并、稳定 Top-K 选择和顺序映射等纯函数。
- `KnowledgeStore.search` 通过该模块融合 sparse/dense 结果，保留策略选择、授权过滤、向量失败降级和 trace 形状。
- `engine.answer` 通过同一模块融合 BM25 商品排序与 Java 传入的语义 SKU 顺序，保留预算、库存、规格和推荐数量裁决。
- 为纯排序函数补单元测试，并继续使用现有知识检索、推荐、流式和安全回归验证兼容性。
- 不改变 FastAPI 路由、SSE、Provider、SQLite/Qdrant/Milvus、Java 业务事实或任何 HTTP/JSON 字段。

## Capabilities

### New Capabilities

无。本次是内部结构重构，`.openspec.yaml` 使用 `skip_specs: true`。

### Modified Capabilities

无。外部行为、排序输入和输出契约保持不变。

## Impact

- 影响 `ai-service/app/retrieval.py` 与 `ai-service/app/engine.py` 的内部排序调用。
- 新增 `ai-service/app/ranking.py` 及对应 Python 单元测试。
- 不新增依赖、不修改配置、数据库、索引结构、鉴权、权限或交易接口。
