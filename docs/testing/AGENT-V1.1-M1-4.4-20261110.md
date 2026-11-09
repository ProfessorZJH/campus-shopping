# Agent v1.1 M1.4.4 真实端到端验收（2026-11-10）

本次样本在临时 MySQL、临时 Java 进程和临时 Uvicorn 进程中执行。商品事实由 Java 公开商品详情提供，向量写入使用每次随机创建的 Milvus 集合，候选重新回到 Java 详情复验后才进入 Uvicorn 查询。真实 Embedding 和 LLM 配置只从私有 `.env` 读取，报告不保存凭据、提示词正文或下游异常正文。

## 执行命令

```powershell
python -X utf8 scripts/smoke-agent-v1-1-m1-e2e.py --env-file G:/develop/campus-shopping/.env
```

证据：[agent-v1.1-m1-e2e-20261110.json](evidence/agent-v1.1-m1-e2e-20261110.json)

## 结果

| 检查 | 结果 | 证据摘要 |
| --- | --- | --- |
| Java/MySQL 当前商品事实 | `REAL / PASS` | 1 个已发布商品、1 个有库存 SKU；没有业务写入 |
| 真实 Embedding + 隔离 Milvus 候选 | `REAL / PASS` | 随机 `campus_agent_products_<hex>` 集合写入和语义召回成功 |
| Java 事实复验后进入 Uvicorn | `REAL / PASS` | 只把当前 Java SKU 事实作为报价传入，生产集合未修改 |
| Uvicorn 多轮商品查询 | `REAL / PASS` | 2 轮、模型模式 `LLM`、首轮返回 1 项推荐；记录了每轮延迟和重试次数 |
| Uvicorn 知识引用 | `REAL / PASS` | 公开文档使用远程 Embedding，查询返回 1 条授权引用 |
| 服务认证和错误边界 | `REAL / PASS` | 错误服务密钥返回 HTTP 401 |
| 供应商失败降级 | `REAL / DEGRADED` | 关闭的 loopback LLM 地址触发 `LOCAL_FALLBACK`，并返回警告；没有写入业务数据 |
| Milvus 清理 | `REAL / PASS` | 随机集合删除后确认不存在 |

同一证据还引用了既有真实原生/流式 Tool Calling 样本，共 2 次工具调用及真实 token 统计。`/v1/query` 当前响应契约不返回 provider usage，因此该端到端样本的 `costStatus` 保持 `NOT_PRICED`，不能从本次报告推导成本或质量通过率。

## 边界

本样本不开放新的公开 Agent 入口，不调用购物车、订单、库存扣减、支付或商户经营写接口；临时 Java/MySQL、Uvicorn、SQLite 和 Milvus 集合均在结束时清理。真实模型质量、耗时和成本仍需基于冻结 Gold 样本建立独立基线。
