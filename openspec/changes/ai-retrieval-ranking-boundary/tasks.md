# Tasks

## 1. 纯排序边界

- [x] 1.1 新增 `ai-service/app/ranking.py`，实现保持 `60 + rank` 分母和输入遍历顺序的 RRF 分数合并与稳定 Top-K 选择，并用纯函数单测覆盖空输入、跨排名累加、平局键和截断。
- [x] 1.2 将 `KnowledgeStore.search` 的 sparse/dense 融合改为调用排序模块，验证 hybrid/sparse/dense、空结果、trace 排名与 `LOCAL_CHAR_NGRAM_DEMO` 降级结果保持不变。
- [x] 1.3 将 `engine.answer` 的 BM25/semantic SKU 融合改为调用排序模块，验证 Java 传入顺序优先、预算/库存/规格硬约束和推荐数量行为保持不变。

## 2. 回归交付

- [x] 2.1 运行 Python 定向检索、推荐、流式和安全测试，确认无 API、SSE、Provider 或跨语言契约变化。
- [x] 2.2 运行 `openspec validate ai-retrieval-ranking-boundary --strict`、`python -m py_compile app/*.py` 和 `git diff --check`，提交单独 Python 结构重构 commit。
