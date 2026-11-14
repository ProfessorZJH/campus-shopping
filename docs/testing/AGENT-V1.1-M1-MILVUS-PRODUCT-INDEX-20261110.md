# Agent v1.1 M1 Milvus 商品索引验收

日期：2026-11-10
分支：`codex/agent-v1-1-m2`
范围：M1 任务 4.2；不把 Java/MySQL 事实复验或完整 Agent 端到端链路计入本报告。

## 结果

使用真实 NVIDIA Embedding、HTTPS Milvus REST v2 和 `ProductIndex`，在随机命名的隔离集合中完成了 121 个商品向量的写入、幂等同步、语义检索、增量更新、删除和最终清理。集合创建、商品索引、幂等、召回、更新和清理均通过；`productionProductCollectionModified=false`。

完整结构化证据见[JSON](evidence/agent-v1.1-m1-milvus-product-index-20261110.json)。集合标识、每步结果和清理结果保存在证据中；最终集合已确认不存在。

NVIDIA Embedding 对多输入请求返回 HTTP 500。本次实现只对 413/422/500 的批量请求做受限单条回退，429 和其他错误不会被拆分重试。单条回退使 121 条索引完成，但耗时约 80 秒，后续需要独立评估批量参数、限流和成本。

## 边界

本证据只关闭 M1 任务 4.2。`real_nvidia_milvus_http_xfyun_chain` 在同一轮返回 `LOCAL_RETRIEVAL_DEMO`/空推荐，因此 M1 任务 4.4 仍为 FAIL；Java/MySQL 商品事实复验另有独立证据，完整 Milvus 候选到 Java 事实链尚未形成同一端到端运行，任务 4.3 仍为 NOT_RUN。

本轮未访问或修改生产商品集合，未写购物车、订单、库存或支付。
