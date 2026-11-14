# Agent v1.1 M1 补充验收记录（2026-11-10）

本记录补充 `agent-v1-1` 的 M1 真实配置复跑结果，基线为当前 M2 分支。它只记录实际运行范围，不把协议测试、隔离夹具或 Java loopback 结果当作真实供应商质量结论。

## 已验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 讯飞原生 Tool Calling | `REAL / PASS` | `agent-v1.1-live-rerun-20261110-2.json` |
| 讯飞流式 Tool Calling | `REAL / PASS` | `agent-v1.1-live-rerun-20261110-2.json` |
| NVIDIA Embedding passage/query | `REAL / PASS` | `agent-v1.1-live-rerun-20261110-2.json` |
| 隔离 Milvus ProductIndex 生命周期 | `REAL / PASS` | `agent-v1.1-live-rerun-20261110-2.json`；独立集合创建、写入、检索、删除、清理均记录 |
| Java/MySQL 商品事实复验 | `PASS / 隔离证据` | `AGENT-V1.1-JAVA-MYSQL-FACT-REVALIDATION-20261110.md` |
| Milvus 候选回 Java/MySQL 当前事实 | `REAL / PASS` | `evidence/agent-v1.1-m1-milvus-java-fact-revalidation-20261110.json` |
| Java/MySQL → Milvus → Uvicorn → 真实模型 | `REAL / PASS` | `AGENT-V1.1-M1-4.4-20261110.md`、`evidence/agent-v1.1-m1-e2e-20261110.json` |
| Java→真实 Uvicorn→本地确定性模型夹具 | `STUB / PASS` | `AgentRuntimeUvicornProcessIntegrationTest`，只验证跨进程协议和 Run 循环 |

## 尚需单独建立的产品基线

真实样本的质量、耗时和成本基线仍需按产品批准的 Gold 样本单独建立；本记录没有预设通过率。

## 安全边界

本轮只使用随机命名隔离集合和临时测试资源，`productionProductCollectionModified=false`，没有写购物车、订单、库存或支付数据。缺少隔离 Java 服务、Redis 测试实例或真实 Runtime 入口时，证据保持 `NOT_RUN`/`DEGRADED`，不以成功的本地夹具替代真实验收。

## 证据文件

- [M1 复跑证据](evidence/agent-v1.1-live-rerun-20261110-2.json)
- [M1 隔离复验摘要](evidence/agent-v1.1-m1-followup-20261110.json)
- [M1 Milvus→Java 事实复验](evidence/agent-v1.1-m1-milvus-java-fact-revalidation-20261110.json)
- [M1 真实端到端](AGENT-V1.1-M1-4.4-20261110.md)
- [Java/MySQL 事实复验](AGENT-V1.1-JAVA-MYSQL-FACT-REVALIDATION-20261110.md)
- [M2 Runtime Bridge 跨进程报告](AGENT-V1.1-M2-RUNTIME-BRIDGE-20261110.md)
