# FR-023 真实评测与隔离组合验收记录（2026-11-10）

状态：**PARTIAL**。本轮完成了评测工具链修复、真实 Embedding/真实 LLM/真实 Milvus/隔离 Java 与 MySQL 的组合验证，并保留了失败、降级、未执行和资源清理证据。正式业务质量评测仍未完成，因此不能把本记录标记为通过。

基线：`main` / `cba3f3b80c3f2a98ee807b7911324f31c9ec1d9a`。

## 当前进度

OpenSpec 当前为 **188/190（98.95%）**。未完成的 2 项全部属于正式业务评测收口：

- 7.1：120 条 case/qrels 尚未完成人工复核，数据集仍为 `DRAFT`。
- 7.2：真实 Embedding、真实 LLM、真实 Milvus 和隔离 Java/MySQL 均已实际执行并留存逐例结果；真实 LLM 本轮全部请求均失败或降级，结论是供应商运行失败，不能当作质量通过。
- 7.3：回答断言、推荐解释和语义泄漏尚未完成人工复核，不能提前计算正式质量结论。

这 2 项不是代码重构缺口，必须由人工 Gold 复核和真实供应商运行收口。

## 本轮工程改动

评测传输白名单现在会放行配置中的 Milvus HTTPS REST 地址。真实 LLM profile 同时复制 `LLM_TIMEOUT_SECONDS`，确保私有验收的超时预算真正作用于评测进程。Milvus 调用仍由 `RecordedClient` 在 ProductIndex 边界记录，避免把一次请求重复计数；未配置的地址、离线模式下的外部请求仍会被拒绝。新增了对应的单元测试。

## 已完成的验证

| 范围 | 结果 | 证据摘要 |
| --- | --- | --- |
| 锁定 Python 依赖回归 | `PASS` | 使用 `ai-service/requirements-dev.lock`（Pydantic 2.13.5）运行，`363 passed`，1 个 warning。 |
| 真实 Embedding | `PARTIAL` | `real-embedding` / test split：132 次 Embedding 请求，128 成功、4 失败；102 条评测记录中 100 条执行、2 条降级。失败按真实运行结果保留，没有被改写为成功。 |
| 真实 Milvus 临时集合 | `PARTIAL` | smoke split 创建随机 `eval_` 集合，完成真实 Embedding、写入、检索、更新/清理链路；集合由本次运行创建并在结束时删除。组合输入保留 36 条记录，其中 35 条执行、1 条因真实连接错误为 `NOT_RUN`。 |
| Java/MySQL 事实复验 | `PASS` | 使用隔离 MySQL 数据库和两个专用 Redis 实例，Maven 共 443 个测试，失败 0、错误 0、跳过 0；临时数据库和 Redis 实例均已清理。 |
| Milvus → Java/MySQL 组合 | `PARTIAL` | 36 条输入全部完成 Java/MySQL 事实复验；Milvus ProductIndex 记录为真实来源，47 次向量操作全部成功；上游仍保留 1 条真实连接错误样本。 |
| 真实 LLM | `REAL / PARTIAL` | [脱敏汇总证据](evidence/ai-evaluation-v1/real-llm-smoke-20261110.json)：官方 smoke split 的 R-LLM 三次重复全部实际发出，共 36 次真实请求，36 次失败（主要为读取超时，另有 JSON 解析/连接错误）；R-RULE 的 12 条固定对照正常执行。结果证明真实路径已运行，但供应商当前不可用，不能宣称 Tool Calling 或回答质量通过。 |
| 人工评测 | `PENDING` | 120 条 annotation 仍为 `DRAFT`，reviewer/reviewedAt 未填写；已生成本地 review package，未伪造人工结论。 |

## 安全与清理

- 未修改生产商品集合、购物车、订单、库存或支付数据。
- Milvus 只使用随机命名的临时 `eval_` 集合，并记录了删除结果。
- Java 验收使用隔离 MySQL 数据库；Redis 使用本轮专用实例和随机命名空间，验收结束后停止。
- 报告不包含真实凭据、提示词或下游异常正文；原始运行目录位于本地忽略目录 `var/evaluation/`，没有加入 Git。

## 可复现命令

以下命令均不包含凭据；真实供应商配置通过本地私有环境加载：

```powershell
cd ai-service
python -m pytest -q
python evaluate.py --dataset campus-shopping-v1 --split test --profile real-embedding --experiments K-D,K-H --allow-external --max-provider-requests 250
python evaluate.py --dataset campus-shopping-v1 --split smoke --profile real-milvus --experiments P-L,P-D,P-H --allow-external --max-provider-requests 500
```

隔离 Java/MySQL 验收使用仓库脚本 `scripts/verify-mysql-isolated.py`，输入为真实 Milvus 组合运行生成的 Java fixture；本轮结果为 443/443 通过且无跳过。

## 下一步

先由人工复核 review package 中的 120 条 case/qrels，并补齐 reviewer、source、time、version；随后在相同数据集版本上重新运行正式本地基线，再完成回答人工复核。7.2 已完成“实际执行并保留失败”的证据要求；只有 7.1、7.3 都满足各自证据要求后，OpenSpec 才能从 188/190 收口到 190/190。
