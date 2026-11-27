# Campus Shopping Benchmark V2 评测可信度专项整改与前后对比报告（2026-11-27）

状态：**PARTIAL（评测器可信度五项专项整改、全套单元/集成门禁与隔离 MySQL 实证已完成；人工 Gold 复核与外部真实付费模型实验继续诚实保持未完成）**。  
分支：`codex/benchmark-v2-evaluation`（Draft PR `#120`），生产算法改动：**`0` 行**（`ai-service/app/**` 与 Java 生产业务模块未作任何修改）。  
原始基线保留：首轮 V2 实验报告 [AI-EVALUATION-V2-20261127.md](AI-EVALUATION-V2-20261127.md)（`scorerVersion = "3"`）及 `campus-shopping-v1` 全部原封保留，本报告按只追加原则对照报告 `scorerVersion = "3"` -> `"4"` 的口径变化、分母影响与真实瓶颈重验结论。

---

## 一、五项可信度整改内容摘要

1. **区分组合购买（`BUNDLE`）、备选推荐（`ALTERNATIVES`）与单品采购（`SINGLE`）评分语义**：
   - 在不改动任何一条 `qrels.jsonl` 相关性等级（`qrels.jsonl`、`products.jsonl`、`knowledge.jsonl`、`splits.json`、`challenge.jsonl` SHA-256 与首轮 100% 一致）的前提下，于 `cases.jsonl` 显式声明 `constraints.purchaseMode`（`SINGLE` 177 例 / `ALTERNATIVES` 78 例 / `BUNDLE` 12 例 / 纯知识无商品采购 `NONE` 93 例）及组合必选商品组 `constraints.requiredGroups`。
   - `metrics.py`（`SCORER_VERSION = "4"`）对 `BUNDLE` 采用**一对一二分图不重叠匹配**（`_max_bipartite_group_match`），强制推荐项以不重叠 `grade=2` SKU 100% 覆盖全部必选商品组且总价 `<= budgetCent`、不含无关项；已基于真实 `case-v2-071`（两款合规全麦吐司、缺少植物燕麦奶）建立负向回归测试（`bundleGroupCoverage = 0.5`，`recommendationCoverage = 0.0`，`requestSuccess = 0.0`）。
   - `SINGLE` 要求精确交付唯一 `grade=2` 目标单品（`len(recommendations) == 1`，新增 `singleItemExact`）；`ALTERNATIVES` 允许返回 `1..3` 个相关备选方案（全部 `grade >= 1` 且至少 1 个 `grade=2`）并按单品方案逐项核验预算。
2. **完善 `S-SSE` 流式安全、一致性、事件顺序与异常终止评测**：
   - `evaluation/streaming.py` 与 `metrics.py` 将实际流式推送的 `delta` 拼接全文（`streamedText`）及全部非 `completed` 事件帧纳入 `unauthorizedDisclosure` 泄漏与伪造交易安全门禁；即使流中途以 `failed` 或断流异常终止，只要已发送的 `delta` 帧含 Canary 或违禁断言，仍严格判定 `unauthorizedDisclosure = 1.0` 并触发硬违规阻断。
   - 新增并门禁化 `streamEventOrderValid`（严格核验 `started -> [progress*] -> [delta*] -> 单一终态`）、`streamCleanTermination` 与 `streamAnswerConsistent`（核验 `"".join(deltas) == completed.answer` 逐字一致），并对流式返回推荐同步执行 `constraint.*` 硬约束校验。
3. **明确词面近似筛查局限并建立仓库外独立 Holdout 盲测治理方案**：
   - `dataset.py` 将字符二元组筛查字段正名为 `charBigramOverlapWarnings`，显式输出 `leakageDetectionScope = "LEXICAL_CHAR_SIMILARITY_AND_DECLARED_FAMILY_ONLY"` 与 `semanticLeakageVerified = false`；原生支持 `--split holdout` 跨划分隔离校验，并制定 [独立 Holdout 盲测治理方案](../ai/benchmark-v2-holdout-protocol.md)。
4. **修正 Java/MySQL 四阶段独立计时、纯向量 `P-D` 隔离与真实 SQL `EXPLAIN ANALYZE` 验证**：
   - 修复 `ShoppingEvaluationMySqlTest.java` 中 `P-D` 误调用真实 `catalog.recall()` 后丢弃结果的计时污染，并在 `java_adapter.py` 中增加 `P-D` 禁止执行词面召回的强校验。
   - 独立采集 `lexicalRecallMs`（词面召回）、`vectorRecallMs`（向量检索 + 排序映射）、`fusionMs`（RRF 融合与轮询采样）、`revalidationMs`（`recallByIds` + `availableOffers` + `inventory.stocks` 实时事实复验），并通过 JDBC `PREPARE`、`EXECUTE`、`EXPLAIN FORMAT=TREE` 与 `EXPLAIN ANALYZE` 实测验证 SQL 耗时根因。
5. **补齐 V2 Smoke 持续回归门禁并保留 V1 兼容**：
   - 新增 [verify-evaluation-v2-smoke.py](../../scripts/verify-evaluation-v2-smoke.py) 与已知生产缺陷登记表 [known_production_defects_v2.json](../../ai-service/evaluation/known_production_defects_v2.json)，接入 `.github/workflows/full-release.yml`（`Quick quality gates` 与 `full-stack`），保留全部 V1 门禁命令；严格区分评测器/协议故障、安全越界（永不可豁免）与已定位待修的生产约束缺陷，绝不通过改 Gold 或剔除样本制造全绿。

---

## 二、整改前后指标、分母与评分口径变化对照（Round 1 `v3` vs Round 2 `v4`）

### 1. 推荐评测（`R-RULE` / `R-LLM`）前后对比及口径影响

知识检索实验（`K-B`、`K-D`、`K-H`、`K-D-R`、`K-H-R`）的所有指标、分子与分母在整改前后 **100% 恒等不变**（`dev` 44/144，`test` 61/216，`K-B documents/ndcg@5` 保持 `0.8339` / `0.8318`）。推荐与流式实验变化如下：

| 数据集划分 / 实验 | 指标 | 整改前 (`scorerVersion=3`) | 整改后 (`scorerVersion=4`) | 分母 (`scored/planned`) 与变化原因说明 |
|---|---|---:|---:|---|
| `local-dev` / `R-RULE` | `recommendationCoverage` | `0.6071` (`51/84`) | **`0.4881` (`41/84`)** | 分母不变（`84/144`）；分子 `-10`：剔除 7 例 `SINGLE` 多推次优门店/多规格凑数 + 3 例 `ALTERNATIVES` 混入 `grade=0` 无关商品 |
| `local-dev` / `R-RULE` | `requestSuccess` | `0.6250` (`90/144`) | **`0.5556` (`80/144`)** | 分母不变（`144/144`）；分子 `-10`（同上 10 例更严格真实扣分，未提高模型分数） |
| `local-dev` / `R-RULE` | `bundleGroupCoverage` | *(未统计)* | **`0.3000` (`5/144`, 组累计 `3/10`)** | 新增指标（仅对 5 例 `BUNDLE` `RECOMMEND` 计分，如 `case-v2-071` 仅覆盖吐司 1/2 组，故 `recommendationCoverage=0.0`） |
| `local-dev` / `R-RULE` | `singleItemExact` | *(未统计)* | **`0.5085` (`30/59`)** | 新增指标（仅对 59 例 `SINGLE` `RECOMMEND` 计分，要求唯一单品且全约束合规） |
| `controlled-dev` / `R-LLM` | `requestSuccess` | `0.6181` (`267/432`) | **`0.5486` (`237/432`)** | 3 次重复分母不变（`432/432`）；与 `R-RULE` 同步按真实采购语义扣减 `-30/432` |
| `local-test` / `R-RULE` | `recommendationCoverage` | `0.6032` (`76/126`) | **`0.5238` (`66/126`)** | 分母不变（`126/216`）；分子 `-10`：剔除 7 例 `SINGLE` 多推门店凑数 + 2 例 `ALTERNATIVES` 混入无关项 + 1 例 `BUNDLE`（`case-v2-098`）双品组合多塞第 3 件重复品类 |
| `local-test` / `R-RULE` | `requestSuccess` | `0.6389` (`138/216`) | **`0.5926` (`128/216`)** | 分母不变（`216/216`）；分子 `-10` |
| `local-test` / `R-RULE` | `bundleGroupCoverage` | *(未统计)* | **`0.4167` (`6/216`, 组累计 `5/12`)** | 新增指标（对 `test` 集 6 例 `BUNDLE` `RECOMMEND` 计分） |
| `local-test` / `R-RULE` | `singleItemExact` | *(未统计)* | **`0.5385` (`49/91`)** | 新增指标（对 `test` 集 91 例 `SINGLE` `RECOMMEND` 计分） |

**按采购模式（`purchaseMode`）拆解的 `R-RULE requestSuccess` 变化**：
- `SINGLE`（单品采购）：`dev` 从 `43/68 (0.6324)` 变为 **`36/68 (0.5294)`**，`test` 从 `69/109 (0.6330)` 变为 **`62/109 (0.5688)`**——真实暴露生产引擎在 `cross-merchant-compare`（如 `case-v2-161, 163, 165, 168, 169, 174, 178` 要求“挑最便宜有现货的那一家”）及未带阿拉伯数字的精确单品购买（如 `case-v2-004, 018, 021, 028`）上一次返回 2～3 个 SKU 而未收敛到唯一目标单品。
- `ALTERNATIVES`（备选推荐）：`dev` 从 `18/32 (0.5625)` 变为 **`15/32 (0.4688)`**，`test` 从 `25/46 (0.5435)` 变为 **`23/46 (0.5000)`**——真实暴露 `fuzzy-need-scenario`（`case-v2-031, 038, 039, 064, 070`）在 Top-1 命中正例后，第 2/3 备选位被 `grade=0` 无关高词频商品填充的问题。
- `BUNDLE`（组合购买）：`dev` 保持 `1/6 (0.1667)`、`test` 从 `2/6 (0.3333)` 降至 **`1/6 (0.1667)`**（`case-v2-098` 因在双品文具组合中塞入第 3 件同组便利贴被严格扣为 `0`），同时新增 `bundleGroupCoverage` 精确量化半套组合（`0.5`）与完整组合（`1.0`），彻底封堵“两款吐司冒充吐司+燕麦奶套餐”及“整单组合额外塞入冗余商品”的评测漏洞。

### 2. 流式评测（`S-SSE`）前后变化

- **协议与一致性核验**：`local-dev`（144 例）、`controlled-dev`（144 例）与 `local-test`（216 例）的 `streamCompleted`、`streamCleanTermination`、`streamEventOrderValid`、`streamAnswerConsistent` 均为 **`1.0000`**，全量 `delta` 与非 `completed` 帧合并检查后 `unauthorizedDisclosure = 0.0000`。
- **新增流式推荐硬约束门禁**：整改前 `S-SSE` 未核验流式推荐商品的 `constraint.*`，导致 `local-dev` 仅报告 `R-RULE` 的 5 条违规；整改后 `S-SSE` 同步检出相同的 **5 条 `dev`（`case-v2-002, 009, 079, 166, 167`）** 与 **7 条 `test`** 生产数量/属性/预算硬违规，使全套违规记录从 `5 / 7` 增至更完整的 **`10 / 14` 条**。

---

## 三、Java/MySQL 分阶段计时修正与真实 SQL 执行计划瓶颈归因

### 1. 分阶段耗时对比（`campus-shopping-v2 --split smoke`，24 例 × 5 实验 = 120 次真实 MySQL 执行）

质量指标（`product.fused/recall@50`、`hit@20`、`sku.pool/recall@300`）与整改前 **100% 一致**；计时拆分与纯向量隔离前后的 P50 / P95（ms）对比如下：

| 实验 | 整改前整轮 `latencyMs` P50 / P95 | 词面召回 `lexicalRecallMs` | 向量召回 `vectorRecallMs` | RRF 融合 `fusionMs` | 事实复验 `revalidationMs` | 整改后召回复验合计 `pipelineTotalMs` |
|---|---:|---:|---:|---:|---:|---:|
| **`P-D`（纯向量召回 + 事实复验）** | `4806.03 / 5016.21` *(误含词面SQL)* | **`SKIPPED` (`0` 次执行)** | **`0.27 / 0.33`** | **`0.07 / 0.25`** | **`7.30 / 10.58`** | **`7.74 / 10.90`** |
| `P-L`（纯 MySQL 词面召回） | `4725.78 / 4996.71` | `4373.62 / 4759.57` | `SKIPPED` (`0` 次执行) | `0.06 / 0.28` | `2.15 / 4.90` | `4373.70 / 4764.54` |
| `P-H`（词面 + 向量混合召回） | `4812.56 / 5135.20` | `4325.36 / 4823.25` | `0.26 / 0.32` | `0.09 / 0.32` | `8.71 / 17.15` | `4335.08 / 4841.45` |
| `P-H-R`（多轮改写混合召回） | `4794.62 / 5113.71` | `4351.46 / 4665.88` | `0.27 / 0.37` | `0.10 / 0.29` | `9.06 / 13.83` | `4359.10 / 4675.73` |
| `P-TERMS`（动态词元混合召回） | `4768.68 / 5129.92` | `4402.02 / 4732.36` | `0.27 / 0.30` | `0.09 / 0.30` | `8.87 / 14.13` | `4415.14 / 4741.68` |

- **关键结论**：消除 `P-D` 中多余的词面 SQL 调用后，`P-D` 召回+实时 MySQL 复验耗时从被污染的 **`4,806.03 ms`** 还原至真实的 **`7.74 ms`（P50）/ `10.90 ms`（P95）**，证实 Java/MySQL 对 80 个候选商品主键、有效 SKU 报价与实时可用库存的事实复验本身仅耗时 **`7～17 ms`**，完全不是性能瓶颈。

### 2. 真实 MySQL 8.0.31 `PREPARE` / `EXECUTE` / `EXPLAIN ANALYZE` 根因修正（推翻首轮优化器耗时假设）

在隔离 MySQL 8.0.31 实例（480 商品 / 1,020 SKU）上对 `ICatalogQueryDao.recall`（8 词元 vs 2 词元）与 `publicByIds` 执行真实编译与执行计划剖析：

| SQL 路径 | `PREPARE` 优化编译耗时 | 纯 `EXECUTE` 执行耗时 | `EXPLAIN ANALYZE` 墙钟 | 优化器估算 `Last_query_cost` | 实测核心算子行为 |
|---|---:|---:|---:|---:|---|
| `recall`（8 词元） | **`0.59 ms`** | **`4,709.37 ms`** | `5,405.63 ms` | `14,390.55` | 16 个关联 `dependent subquery` 触发 `cat_sku` 全表扫描（`rows=1020` × 合计 `~3,332` 次循环） |
| `recall`（2 词元） | **`0.41 ms`** | **`946.74 ms`** | `1,134.10 ms` | `3,690.85` | 4 个关联 `dependent subquery` 触发 `cat_sku` 全表扫描（耗时随词元数近似线性成倍增长） |
| `publicByIds`（40 ID） | **`0.48 ms`** | **`1.11 ms`** | **`1.20 ms`**（算子内耗时 `0.24 ms`） | `36.98` | `uk_sku_spec` 索引范围扫描 + `cat_product`/`mer_merchant` 主键单行精确查找 |

- **实证修正首轮假设**：
  - 首轮报告推测慢查询源于“MySQL 8 优化器枚举 20 张表连接顺序开销”；本轮实测 `PREPARE` 编译优化仅耗时 **`0.59 ms`**，**99.98% 的耗时发生在 `EXECUTE` 算子执行期（`4,709.37 ms`）**。
  - 真实 `EXPLAIN ANALYZE` 揭示精确根因：`WHERE (... OR EXISTS (...))` 与 `ORDER BY (CASE WHEN EXISTS (...) ...)` 无法被半连接去关联化，生成 `Select #3..#18` 共 **16 个关联依赖子查询**；由于唯一索引 `uk_sku_spec(product_id, spec_key)` 未覆盖 `status` 列，MySQL 优化器受 `LIMIT 1` 乐观代价启发影响选择 `Table scan on s (rows=1020)` 而非 `uk_sku_spec` 前缀查找，在词元未命中 `spec_key`（`rows=0`）时无法提前短路，导致单次查询执行 `~3,332 × 1,020 ≈ 340 万` 次全表行扫描与 `LOWER(s.spec_key)` 计算。
  - 后续生产优化方向因此更加精准：只需为 `cat_sku` 建立覆盖索引 `(product_id, status, spec_key)` 或先将每商品活跃 `spec_key` 预聚合为单行派生表再执行一次连接，即可将 `4.4s` 降至毫秒级。

---

## 四、门禁核验与未完成范围诚实声明

- **已通过自动测试与门禁**：
  - `ai-service` 全量测试：**`448 passed`**（含 `case-v2-071` 双吐司负向测试、`S-SSE` `delta` 泄漏/中途断流/乱序对抗测试、`holdout` 隔离测试与 `P-D` 纯向量守卫测试）。
  - `scripts/tests` 单测：**`46 passed`**（含 `test_verify_evaluation_v2_smoke.py`）。
  - `python scripts/verify-evaluation-v2-smoke.py --include-dev`：**`PASS`**（同时覆盖 V1 兼容、V2 `smoke` 本地/受控 + `S-SSE`、24 例 `challenge` `UNSUPPORTED` 及 `dev` 已知生产缺陷精确核算）。
  - 隔离真实 MySQL 8 全量验证（`verify-mysql-isolated.py --dataset campus-shopping-v2`）：**8 模块 `BUILD SUCCESS`**（`476` 项测试 `0` 失败，`SAFE` 安全套件 `10/10 PASS`，临时库销毁核验通过）。
- **继续保留的未完成阻塞项（绝不伪造验收）**：
  - **人工 Gold 复核**：`campus-shopping-v2` 全部 360 条保持 `AI_ASSISTED` / `DRAFT`（`reviewed = 0 / 360`，`disputed = 22`），回答语义支撑度 `citationGrounded` 保持 `PENDING`。
  - **外部真实供应商实验**：`real-embedding`、`real-llm`、`real-milvus` 保持 `NOT_RUN`（外部请求 `0` 次，成本 `$0.00`）。
  - **仓库外 Holdout 盲测集**：本次制定完成治理协议与评测器 `--split holdout` 支持，独立人工盲测语料待里程碑评审阶段在仓库外受控构建。
