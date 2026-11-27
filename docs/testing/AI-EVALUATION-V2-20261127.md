# Campus Shopping Benchmark V2 体系建设与可比实验报告（2026-11-27）

状态：**PARTIAL（基础设施、V2 数据集、自动测试与隔离真实 MySQL 验收完成；人工 Gold 复核与外部付费模型实验待人工/授权收口）**。  
基线：`main @ 703057f5d3f7a76298223a8cfeac3c3ae1720830`，工作分支：`codex/benchmark-v2-evaluation`。

保留 `ai-service/evaluation/datasets/campus-shopping-v1/` 及历史证据原封不动，新建独立版本化评测集 [campus-shopping-v2](../../ai-service/evaluation/datasets/campus-shopping-v2/README.md)、[Gold 标注手册](../ai/benchmark-v2-annotation-manual.md) 与 [数据分布报告](../ai/benchmark-v2-data-distribution.md)。本轮未修改 `ai-service/app/` 或 Java 生产导购检索/排序/约束算法，未使用 `test` 集调优提示词或参数。

---

## 一、第一阶段现有评测工程审查摘要（含代码依据）

1. **模板化与串号泄漏**：`ai-service/evaluation/generate.py`（L12-40, L109-114, L152-210）仅用 10 个商品名、2 种 `specKey`（标准装/家庭装）和 6 条单句政策循环构造 `campus-shopping-v1`；110 条商品相关案例中有 100 条在问题或上下文直贴唯一串号 `校园系列{n}`，`fuzzy-use`（`case-011..020`）对目标商品专属描述词面重合率仍达 75.3%。
2. **Gold 未覆盖完整语料**：`generate.py`（L225-241）硬编码在 `[products[n], products[n+120]]` 双槽位内打标（例如 `case-011` 漏标其余 20 款合规签字笔、`case-106` 因忽略全库 6 元同款面包误标 `NO_MATCH`）；`public-knowledge` 将他店文档标为 `grade=1` 并受 `metrics.py`（L117-120, L190）全集命中条件限制而误罚精准单店引用。
3. **`familyId` 防泄漏失效**：`generate.py`（L252）为 120 例生成 120 个单元素 `familyId`；`public-knowledge` 测试集 66.7% 复用开发集完全相同的文档对，模板换词跨 split 相似度落在 `0.88~0.89`（卡在 `dataset.py` L156 的 `0.92` 阈值之下）。
4. **文档与分块归因缺口**：V1 全 24 篇均为 `version=1` 且全部 `qrels.evidence` 的 `ordinal=0`；`dataset.py`（L136）与 `metrics.py`（L137）未读取 `manifest.chunking`；旧协议引用落在 80 字重叠区会被 `metrics.py`（L167-173）丢弃。
5. **多轮与身份范围偏差**：V1 无带知识 Gold 的多轮样本，导致 `K-H` vs `K-H-R` 在全集 `meanDelta=0.0` 空转；`runner.py`（L27-32）在离线推荐中按 `allowedMerchantIds` 预筛候选，形成消费者单店锁定的 Oracle 泄漏；`ShoppingEvaluationFixture.java` 缺少店员有无 `knowledge.read` 角色与多版本文档根演进，且 `ShoppingEvaluationMySqlTest.java`（L170-171）硬编码 `240/360` 行数断言。
6. **异常状态统计偏差**：`metrics.py`（L203, L253）在 `FAILED` 空输出上保留 `unauthorizedDisclosure=0.0`；`<1ms` 预算耗尽 `DEGRADED` 混入延迟分位数；`java_adapter.py`（L74-79, L118）不支持保留 `DEGRADED`；`aggregate()` 缺独立 `unsupported` 计数。
7. **能力边界滞后**：生产已提供 `/v1/query/stream` 与 `/api/v1/ai/chat/stream`，但 `reports.py`（L56）仍固定输出非流式 `N/A`；未实现产品能力缺乏独立 `UNSUPPORTED` 挑战集收口。

---

## 二、Benchmark V2 数据治理与评测框架增量

### 1. 数据集规模与 Gold 校验结果

- **语料规模**：10 家合成校园商户（`m0..m8` `ACTIVE`、`m9` `SUSPENDED` 七折低价诱饵 + 2 待审申请）、**480 款商品**（6 大类 60 原型，零串号拼接）、**1,020 个多维规格 SKU**（含停用 60、售罄 45、全额预占 35、低库存 30）、**80 个知识文档版本**（含 10 组 `v1 WITHDRAWN -> v2 PUBLISHED` 同根演进、11 篇 `DRAFT`、22 篇 `>=2` 分块长文且关键细则位于 `ordinal=1`）。
- **场景与划分**：**360 条主场景**（精确覆盖 12 主类：`30/40/35/30/25/20/35/40/25/25/25/30`），按 `281` 个问题家族（含 `76` 个多成员家族覆盖 `155` 例）切分为 **144 `dev` / 216 `test`** 及 **24 `smoke`**（取自 `dev`）；另附 **24 条 `challenge.jsonl`** 独立挑战集（显式标记 `UNSUPPORTED`）。
- **校验与人工复核状态**：
  - `dataset.load("campus-shopping-v2")` 通过全部 SHA-256、主外键、库存金额、五类角色 RBAC、分块哈希与家族隔离校验；`nearDuplicateWarnings = []`，`semanticOverlapWarnings = []`。
  - 全部 360 条保持 `annotationSource="AI_ASSISTED"`、`reviewStatus="DRAFT"`（`reviewed = 0 / 360`），其中 **22 条争议边界样本**显式标记 `disputed = true`。
  - `python -m evaluation.review_validation` 结构校验输出：`expected=360, complete=0, pending=360, disputed=22, status="PENDING"`；`--formal` 严格拦截未完成人工复核的数据集（退出码 `2`）。

### 2. 阻断评测真实性的必要评测侧修复（零生产算法改动）

- 扩展 `dataset.py`、`ShoppingEvaluationFixture.java` 与 `ShoppingEvaluationMySqlTest.java`：支持 `merchant-clerk-read-<mid>` / `merchant-clerk-noread-<mid>` 店员角色、同 `rootKey` 多版本文档根演进、`challenge.jsonl` 校验、动态商品/SKU 总数断言及 Java 端逐例墙钟 `latencyMs` 采集。
- 修复 `metrics.py`、`comparisons.py` 与 `java_adapter.py`：`FAILED` 空输出的 `unauthorizedDisclosure` 标为 `FAILED (null)`；授权公开文档中的禁令警示语不再误判为回答越界断言（内部 Canary 与未授权文档在全字段继续严格拦截）；新增 `executed`、`unsupported`、`executedLatency` 及配对 `leftDegraded/rightDegraded`；支持核心证据（`grade=2`）覆盖判定。
- 新增 `evaluation/streaming.py`（实验 `S-SSE`）：通过 `_LiveASGITransport` 连接真实 FastAPI `POST /v1/query/stream`（`streamText=True`）逐帧测量 `startedMs`、`firstProgressMs`、`firstDeltaMs` 与 `completedMs`。

---

## 三、第四阶段可比实验矩阵与实测结果

固定 `PYTHONHASHSEED=20261031`、相同数据集快照与分母口径。

### 1. 知识检索与 Query Rewrite 对照（`local` profile：BM25 vs 本地字符向量 Dense vs RRF vs Rewrite）

| 划分（有效知识 Gold 例数） | 实验 | `documents/ndcg@5` | `documents/recall@5` | `chunks/ndcg@5` | `evidenceRecall` | `evidenceCoverage` | `citationValidity` | P50 / P95 延迟 (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `dev` (`44` scored / `48` planned) | `K-B` (BM25) | **0.8339** | **0.8864** | **0.7452** | **0.8617** | **0.9091** | 1.0000 | 13.55 / 47.68 |
| `dev` (`44` scored / `48` planned) | `K-D` (Local Dense) | 0.4611 | 0.5909 | 0.3697 | 0.4773 | 0.4091 | 1.0000 | 64.38 / 74.92 |
| `dev` (`44` scored / `48` planned) | `K-H` (BM25+Dense RRF) | 0.7197 | 0.8295 | 0.5927 | 0.7670 | 0.7955 | 1.0000 | 67.05 / 73.68 |
| `dev` (`44` scored / `48` planned) | `K-D-R` (Dense+Rewrite) | 0.4727 | 0.6250 | 0.3722 | 0.4924 | 0.4091 | 1.0000 | 67.70 / 76.54 |
| `dev` (`44` scored / `48` planned) | `K-H-R` (Hybrid+Rewrite) | 0.7532 | 0.8750 | 0.6106 | 0.8239 | 0.8409 | 1.0000 | 69.78 / 76.50 |
| `test` (`61` scored / `67` planned) | `K-B` (BM25) | **0.8318** | **0.9180** | **0.7294** | **0.8525** | **0.9344** | 1.0000 | 10.84 / 49.21 |
| `test` (`61` scored / `67` planned) | `K-D` (Local Dense) | 0.6045 | 0.7213 | 0.5088 | 0.6257 | 0.6557 | 1.0000 | 61.41 / 74.82 |
| `test` (`61` scored / `67` planned) | `K-H` (BM25+Dense RRF) | 0.7566 | 0.8443 | 0.6791 | 0.7568 | 0.8197 | 1.0000 | 67.49 / 74.00 |
| `test` (`61` scored / `67` planned) | `K-D-R` (Dense+Rewrite) | 0.6606 | 0.7623 | 0.5445 | 0.6585 | 0.7049 | 1.0000 | 57.15 / 71.32 |
| `test` (`61` scored / `67` planned) | `K-H-R` (Hybrid+Rewrite) | 0.7951 | 0.8607 | 0.7015 | 0.7923 | 0.8525 | 1.0000 | 65.12 / 71.82 |

- **关键实证结论**：
  1. **混合检索并非天然优于稀疏基线**：在无外部语义向量的本地路径（同样对应生产环境中禁止外发的 `MERCHANT_INTERNAL` / `PLATFORM_INTERNAL` 文档路径）上，256 维局部字符哈希向量 `K-D` 无语义泛化能力，经等权 `RRF(60)` 融合后，`K-H` 的 `documents/ndcg@5` 反而低于纯 BM25（`dev`: `0.7197` vs `0.8339`；`test`: `0.7566` vs `0.8318`）。
  2. **Query Rewrite 呈双向效应**：在多轮指代追问样本（如 `case-v2-222` `0.0000 -> 1.0000`、`case-v2-223` `0.0000 -> 0.5000`）上，`K-H-R` 成功补全前序门店主体（`dev` 配对均值 `+0.0335`，`test` 配对均值 `+0.0385`）；但在部分话题切换或子问题细化样本（如 `case-v2-224` `0.9197 -> 0.6934`）上，机械拼接前两轮用户原话引入了旧轮次噪声词。

### 2. 商品词面召回、受控向量融合与隔离真实 Java/MySQL 事实复验（`smoke` 24 例 × 5 实验 = 120 次真实调用）

| 实验（`controlled` + `java-mysql`） | `product.fused/hit@20` | `product.fused/hit@50` | `product.fused/mrr@20` | `product.fused/ndcg@50` | `product.fused/recall@50` | `sku.pool/recall@300` | Java/MySQL P50 / P95 (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `P-L`（MySQL 全目录词面召回） | **0.7500** | 0.7500 | **0.4751** | 0.3374 | 0.3911 | 0.4118 | 4725.78 / 4996.71 |
| `P-D`（STUB 向量 + MySQL `recallByIds` 复验） | 0.1875 | 0.3125 | 0.1875 | 0.1786 | 0.2012 | 0.2077 | 4806.03 / 5016.21 |
| `P-H`（词面 + STUB 向量 RRF + 实时复验） | 0.6875 | **0.8125** | 0.2994 | **0.3601** | **0.4840** | **0.5016** | 4812.56 / 5135.20 |
| `P-H-R`（多轮上下文查询改写） | 0.6875 | **0.8125** | 0.2994 | **0.3601** | **0.4840** | **0.5016** | 4794.62 / 5113.71 |
| `P-TERMS`（受控模型动态词元） | 0.6875 | **0.8125** | 0.2931 | 0.3544 | 0.4751 | **0.5016** | 4768.68 / 5129.92 |

- **事实复验与权限一致性**：全部 480 款商品、1,020 个 SKU、80 篇多版本知识文档及 5 类角色在隔离库 `campus_shopping_it` 上通过领域仓储完整装载；18 款 `m9` 停业低价商品、32 款 `UNPUBLISHED` 商品、20 款 `DRAFT` 商品与 60 个 `INACTIVE` SKU 被 Java 实时复验 100% 剔除；服务端 `KnowledgeCaseImpl.readableScope` 实测结果与预期 `allowedDocumentIds` 100% 吻合。
- **真实 SQL 性能瓶颈暴露**：在 V2 自然长句（`recall_terms` 提取满 8 个词元）下，`icatalogquerydao_mapper.xml`（L68-83）的 `WHERE` 与 `ORDER BY` 展开多达 16 个关联 `EXISTS (SELECT 1 FROM cat_sku ...)` 子查询（合计约 20 张表引用），触发 MySQL 8.0 优化器连接顺序搜索开销，使单次 Java 导购召回在 480 商品规模下出现约 `4.7s～5.1s` 延迟。

### 3. 推荐评测、SSE 流式首字延迟专项、安全回归与不支持/未运行矩阵

| 评测项 | 范围与环境 | 核心结果摘要 | 状态 / 退出码 |
|---|---|---|---|
| `R-RULE` (`local-dev` / `144` 例) | 本地规则推荐 | `requestSuccess=0.6250`，`recommendationCoverage=0.6071`，`clarificationAccuracy=0.5833`，`noMatchAccuracy=0.4000`，`constraintPass=0.9351`（5 例数量提取硬违规），`unauthorizedDisclosure=0.0000`，P50/P95=`192.36 / 372.79 ms` | `FAILED / exit=1`（真实暴露 5 例数量约束缺陷） |
| `R-RULE` (`local-test` / `216` 例) | 本地规则推荐（只读评测） | `requestSuccess=0.6389`，`recommendationCoverage=0.6032`，`clarificationAccuracy=0.7647`，`noMatchAccuracy=0.3889`，`constraintPass=0.9397`（7 例数量/预算/追问/错字硬违规），`unauthorizedDisclosure=0.0000`，P50/P95=`199.15 / 377.42 ms` | `FAILED / exit=1`（真实暴露 7 例生产约束缺陷） |
| `R-LLM` vs `R-RULE` (`controlled-dev` / `432+144` 行) | 受控 MockTransport 3 次重复对照 | `R-LLM`（受控替身）`requestSuccess=0.6181`，与 `R-RULE` 配对差值 `-0.0069`（受控替身仅验证候选固定与协议安全，不代表真实大模型能力） | `FAILED / exit=1` |
| `S-SSE` (`local-dev` / `144` 例) | 真实 `/v1/query/stream`（`FULL_RESPONSE`） | `started` P50/P95=`14.27 / 17.52 ms`，`firstDelta`（首可见文本块）P50/P95=`129.47 / 214.20 ms`，`completed` P50/P95=`131.36 / 216.55 ms` | `EXECUTED` |
| `S-SSE` (`controlled-dev` / `144` 例) | 真实 `/v1/query/stream`（`UPSTREAM_STREAMING_JSON`） | `started` P50/P95=`14.17 / 21.53 ms`，`firstProgress` P50/P95=`156.91 / 237.77 ms`，`firstDelta` P50/P95=`149.41 / 224.96 ms`，`completed` P50/P95=`151.36 / 226.33 ms` | `EXECUTED` |
| `SAFE` (`ShoppingEvaluationSafetyMySqlTest`) | 隔离真实 MySQL 8.0.31 | `proposalSafety=8/8 (1.0)`、`authorizationSafety=2/2 (1.0)`（覆盖过期 `AI0002`、跨用户 `G0001`、变价 `C0002`、缺货 `I0001`、下架 `C0001`、停业 `M0004`、超限回滚 `T0005`、并发幂等重放 `0000`、生成期撤稿 `AI0003` 与撤权 `0000`） | `PASS / exit=0` |
| `E4` & `--split challenge` | 独立 Reranker 与 24 例挑战集 | 24/24 挑战案例与 `E4` 全部显式记录 `status="UNSUPPORTED"`，不计入支持能力分母 | `PARTIAL / exit=2`（符合预期） |
| 真实外部供应商 (`real-embedding` / `real-llm` / `real-milvus`) | 未提供本次外部 API 授权与预算 | Preflight 拦截并诚实标记 `NOT_RUN`（`EXTERNAL_NOT_ENABLED`），外部请求数 `0`，费用 `$0.00` | `NOT_RUN` |
| 共享双实例 Redis 集成套件 | 未显式配置本机专用双测试实例 | 按 `AGENTS.md` 安全规则不自动复用未知 Redis，5 个可选 Redis 套件跳过并显式标注 `NOT_RUN` | `NOT_RUN` |

---

## 四、第五阶段：真实失败样本十类错误归因与瓶颈诊断

基于 `campus-shopping-v2` 真实运行结果，对暴露的失败样本归类如下（严格区分生产实现问题与外部未运行项）：

| 错误类别 | V2 典型失败案例 | 真实观察表现与源码根因定位 | 问题归属 |
|---|---|---|---|
| **1. 意图解析失败** | `case-v2-080`、`116`（混合购置+规则咨询）；`case-v2-136`（超目录买二手电瓶车）；`case-v2-076`（约数预算） | ① `app/engine.py`（L176-180, L195-196）`knowledge_question` 一旦命中“自提/退款/保质+怎么/如果”即清空 `offers=[]`，导致同时买商品并顺带问规则的混合请求丢失全部推荐；② 超目录商品（电瓶车/显卡）因部分通用双字词命中其他商品未被识别为 `NO_MATCH`；③ `"二十五块左右"` 被按硬上限 `<=25元` 直接出单而非澄清。 | 生产实现问题 |
| **2. 约束提取失败** | `case-v2-002`、`009`、`020`、`166`、`167`、`171`、`176`、`270`（复合包装规格误提为件数）；`case-v2-079`（`5小包`）；`case-v2-087`（`总开销控制在45元内`）；`case-v2-001`、`006`（未知自由词过度拒答） | ① `engine.py`（L93-109）`QUANTITY` 正则负向先行断言 `(?!装)` 仅看后 1 字，将规格 `"12支整盒装"`、`"6包家庭装"`、`"12只筒"` 中的包装内数提取为购买件数 `×12`/`×6`；且不支持数词与量词间的形容词 `"5小包"`；② `engine.py`（L63, L66）`budget_intent` 遗漏 `"X元内"`（无“以/之”）与 `"总开销控制在"`，导致 `case-v2-087` 推荐总价达 `102.50` 元超 `45` 元预算；③ `sku_constraints.py`（L94-99）将口语修饰短语误收为未知必选规格触发误拒答。 | 生产实现问题（最高优先级 P1） |
| **3. 召回失败** | `case-v2-032`（遮阳挡光布 -> 床帘）；`case-v2-163`（`P-L` 跨表述未命中） | 模糊场景与口语同义词同商品标题/描述零词面重合时，本地 `local-char-ngram-v1` 与 SQL `LOCATE` 均无法跨词义召回。 | 生产实现问题（需真实语义向量） |
| **4. 排序失败** | `case-v2-040`、`043`；`case-v2-071`、`072`、`084`（组合搭配单一品类霸榜） | ① 无独立 Cross-Encoder 重排，弱匹配高词频商品挤占 Top-3；② 组合搭配请求（如“吐司+燕麦奶”）下单品类多款高分商品占满候选前位，缺少按互补品类槽位分配的多样化排序；③ 单品备选场景仍按累计总价扣减预算上限，排第 1 的单品挤占后续平替报价预算。 | 生产实现问题 |
| **5. 知识引用失败** | `case-v2-181`、`184`、`185`（跨文档双证据漏一）；`case-v2-186`、`189`（长文 `ordinal=1` 深块漏召） | 需同时综合平台总则与门店/天气专项两篇文档，或答案位于第 2 分块（`ordinal=1`）时，局部字符向量噪声拖累 `K-H` Top-6 分块截断，遗漏其一核心分块。 | 生产实现问题 |
| **6. 回答幻觉** | 自动门禁 `0` 例越界执行断言；语义支撑待人工评审（`citationGrounded=PENDING`） | `FAKE_EXEC_ANSWER` 与模板兜底拦截了“已扣款/已下单”伪造断言；但模型自由生成解释是否细粒度扭曲条款仍须通过 `review.jsonl` 人工逐断言核查。 | 待人工语义评审 |
| **7. 权限泄漏** | 自动门禁 `unauthorizedDisclosure = 0.0000`（全 360 例 0 泄漏）；Java 撤稿/撤权 `2/2 PASS` | 服务端 `readableScope` 预过滤、`PUBLIC_ONLY` 外发隔离与生成后 `REQUIRES_NEW` 复权有效阻断了跨店、店员无权、停业店与内部 Canary 泄漏。 | 已验证防线有效（语义级隐式泄漏仍保留人工复核入口） |
| **8. 推荐与实时业务事实不一致** | Java `P-*` 与 `SAFE` 套件 `0` 例陈旧商品穿透（`8/8 PASS`） | Java `recallByIds`、`availableOffers` 与 `ProposalConfirmationCaseImpl` 行锁复验拦截了全部停业商户、下架、停用、预占耗尽与变价提案。 | 已验证防线有效 |
| **9. 模型供应商失败** | 本轮外部供应商 `NOT_RUN`（历史证据见 `AI-EVALUATION-REAL-20261110.md` 36/36 超时降级） | 未获外部凭据与预算授权时不主动发起付费请求；评测框架已验证预算耗尽与上游故障均独立计入 `DEGRADED` 且不污染 `executedLatency`。 | 环境与外部授权边界 |
| **10. 多轮状态丢失** | `case-v2-180`（`"把这几家的价格比一下"`）；`case-v2-216`、`219`、`221`（跨轮规格/数量覆盖） | ① `engine.py`（L45）`FOLLOWUP` 正则未覆盖 `"这几家"`、`"那家"` 及无代词省略追问（如 `"那无糖的呢"`），导致前轮商品与规格上下文完全丢失；② `sku_constraints.py`（L26-33, L130-134）将多种属性合并进单一 `'spec'` 维度，次轮追加新属性时覆盖首轮同轴约束。 | 生产实现问题 |

### 附：流式首 Token 架构瓶颈实证

`S-SSE` 实测证明：`event: started` 在 `~14ms` 内立即到达，但首个可见文本块 `firstDelta`（`149.41 ms`）与整包 `completed`（`151.36 ms`）几乎同时到达（仅差 `~1.95 ms`）。根因在于生产 `engine.py`（L251-255）需缓冲完整上游 JSON 以完成 SKU 白名单与防伪造执行校验后才由 `main.py` 切片推送 `delta`，因此当前流式接口主要改善连接保活与阶段感知（`started`/`progress`），尚未实现边生成边吐字的真实低首字感知延迟。

---

## 五、后续改进优先级建议（供后续独立功能 PR 授权实施）

1. **P0（修复数量与预算解析硬缺陷）**：收紧 `engine.py` 的 `QUANTITY` 规格后缀排除规则（识别 `整盒装/家庭装/整箱装/提装/只筒` 等复合包装词及 `小包/大包` 修饰词），补齐 `budget_intent` 对 `"X元内"` 与 `"总开销/总价控制在"` 的解析，对应回归案例：`case-v2-002, 009, 020, 079, 087, 166, 167, 171, 176, 270`。
2. **P1（解耦混合意图与多轮指代状态机）**：在 `engine.py` 与 `ShoppingAnswerPolicy` 中区分纯政策问答与“买商品+问规则”混合意图（避免一刀切清空 `offers`），扩充省略追问识别并拆分 `sku_constraints.py` 的混杂 `'spec'` 轴，对应回归案例：`case-v2-080, 116, 180, 216, 219, 221`。
3. **P1（优化 MySQL 8 词面召回 SQL 执行计划）**：将 `icatalogquerydao_mapper.xml` 中 `recall` 的多词元重复 `EXISTS (SELECT 1 FROM cat_sku ...)` 改写为单次聚合派生连接或全文/预聚合规格字段匹配，消除 8 词元下的 20 表连接计划枚举（将单次查询从 `~4.8s` 降至毫秒级）。
4. **P2（内部文档检索权重与流式两阶段生成）**：在无外部语义向量时降低或关闭 `local-char-ngram-v1` 在 RRF 中的等权占比以恢复纯 BM25 精度；探索先校验结构化候选再流式生成自然语言解释的两阶段协议以降低真实 `firstDelta` 延迟。

---

## 六、可复现命令与清理核验

```powershell
# 1. Python 全套测试与静态发布门禁
cd ai-service
python -m pytest -q
cd ..
python scripts/verify-release.py
python scripts/verify-api-contract.py
python scripts/verify-api-schemas.py
python scripts/schema_contract.py --check
npm run format:check --prefix frontend

# 2. V2 本地、受控、流式首字延迟与挑战集实验
python ai-service/evaluate.py --dataset campus-shopping-v2 --split dev --profile local --experiments K-B,K-D,K-H,K-D-R,K-H-R,R-RULE,S-SSE
python ai-service/evaluate.py --dataset campus-shopping-v2 --split dev --profile controlled --experiments K-B,K-D,K-H,K-D-R,K-H-R,R-RULE,R-LLM,S-SSE
python ai-service/evaluate.py --dataset campus-shopping-v2 --split challenge --profile local --experiments R-RULE

# 3. 隔离临时 MySQL 8 全量验证 + V2 Java 召回复验 + 10 项安全套件
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
python scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --dataset campus-shopping-v2 --output var/verify/v2-mysql/mysql.json --artifact-dir var/verify/v2-verified-build
python ai-service/evaluate.py --dataset campus-shopping-v2 --split smoke --profile controlled --adapter java-mysql --experiments P-L,P-D,P-H,P-H-R,P-TERMS --java-results var/verify/v2-mysql/evaluation-java.json
python ai-service/evaluate.py --safety-results var/verify/v2-mysql/evaluation-safety
```
