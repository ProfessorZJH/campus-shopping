# Benchmark V2 防泄漏边界与独立 Holdout 盲测治理方案

## 一、仓库内近似检测的真实边界（明确声明）

`ai-service/evaluation/dataset.py` 在加载数据集时执行三项跨 `split` 静态检查：

1. **显式家族隔离（`familyId`）**：强制同一 `familyId` 下的全部改写变体 100% 落在同一 `split`（违者直接抛 `DatasetError("family split leakage")`）。
2. **归一化精确重复拦截**：去除标点空白与大小写差异后完全相同的 `originalQuery` 禁止跨 `split` 出现（违者直接抛 `DatasetError("normalized query split leakage")`）。
3. **词面/字符近似告警（`SequenceMatcher >= 0.92` 与 `_char_bigram_jaccard >= 0.78`）**：输出 `nearDuplicateWarnings` 与 `charBigramOverlapWarnings`。

**边界与局限性声明（`leakageDetectionScope = "LEXICAL_CHAR_SIMILARITY_AND_DECLARED_FAMILY_ONLY"`, `semanticLeakageVerified = false`）**：

- 上述 `SequenceMatcher` 与字符二元组 Jaccard **仅属于表面词面（Lexical / Character-Level）近重复筛查，绝不等同于完整语义等价防泄漏检测**。
- 当两条跨 `split` 查询采用完全不同的校园词汇表达同一需求（例如“早八赶课来不及排队想垫肚子”与“上午第一节课前买点顶饿速食”）且生成阶段未被归入同一 `familyId` 时，字符相似度可低至 `< 0.15`，静态词面筛查无法自动识别此类深层语义同义泄漏。
- 仓库内本地字符哈希向量（`local-char-ngram-v1`）同样基于字符 n-gram 散列，不能替代真实语义嵌入模型进行跨词面同义审查。
- 因此，跨 `split` 语义防泄漏必须同时依赖：（1）人工 Gold 复核阶段对 `familyId` 归并的逐例核查；（2）获得外部模型授权后使用真实高维语义向量的离线余弦复查；（3）物理隔离于主代码仓之外的 **独立 Holdout 盲测集**。

---

## 二、为什么必须设立仓库外独立 Holdout 盲测集

仓库内的 `campus-shopping-v2`（`144 dev` + `216 test`）属于**白盒公开回归集（Open-Box Regression Benchmark）**：

- 开发者与编码智能体在日常阅读仓库、排查回归日志时均可访问 `dev` 与 `test` 的问题原文和规则定义；
- 即便严格遵守“禁止用 `test` 集做参数搜索和 Prompt 调优”的纪律，长期多轮迭代中仍可能产生无意识的分布迎合（Adaptive Overfitting / Goodhart's Law），例如针对已知句式增补特定正则分支而未提升泛化能力。

为从机制上阻断针对测试集过拟合，制定如下 **独立 Holdout 盲测集（`campus-shopping-v2-holdout`）治理规范**。

---

## 三、Holdout 盲测集构建与物理隔离规范

1. **物理存储隔离（Out-of-Repo Sealed Storage）**：
   - `campus-shopping-v2-holdout` **严禁提交至 `ProfessorZJH/campus-shopping` 主代码仓库或公开 PR 产物**，存放于独立的私有评测仓库或离线受控目录。
   - 日常研发、CI `Quick quality gates` 及常规功能 PR 仅运行仓库内 `campus-shopping-v1` 与 `campus-shopping-v2`（`smoke` / `dev` / `test`），不接触 `holdout` 数据。
2. **独立语料与场景构造准则**：
   - **规模与配比**：规划 `120` 条独立盲测场景（12 个主分类各 `10` 条），外加 `12` 条 `UNSUPPORTED` 盲测挑战题；全部放入 `splits.json` 的 `"holdout"` 划分（`dev = []`, `test = []`, `smoke = []`）。
   - **零家族与零句式复用**：所有 `familyId` 使用独立命名空间 `v2-holdout-fam-*`，由未参与当前生产正则/Prompt 编写的人类评审员或独立隔离流程全新撰写校园真实口语表达，禁止从公开 `dev`/`test` 改写派生。
   - **商品名与商户扰动**：盲测集使用重新抽样的商户命名、商品标题及价格梯度（保持相同 Schema 与业务硬约束规则），防止生产代码针对合成品牌名或固定价格点硬编码。
   - **人工冻结门槛**：盲测集进入里程碑门禁前须完成人工逐例复核并通过 `--formal` 校验（`status = "ACCEPTED"`，`reviewStatus = "HUMAN_REVIEWED"`）。

---

## 四、盲测执行协议与严禁调优红线

1. **只读黑盒挂载执行**：
   - 评测器已原生支持 `--split holdout` 及外部目录路径挂载：
     ```powershell
     python ai-service/evaluate.py --dataset <SEALED_HOLDOUT_DIR> --split holdout --profile local --experiments K-B,K-D,K-H,K-D-R,K-H-R,R-RULE,S-SSE --output-dir <SEALED_OUT_OF_REPO_OUTPUT_DIR>
     ```
   - `cli.py` 与 `reports.save()` 在 `split == "holdout"` 时强制校验 `--output-dir` 必须位于主代码仓库目录之外，且只落盘脱敏汇总产物（`manifest.json`、`metrics.json`、`comparisons.json` 与不含逐例题面/错题列表的汇总 `report.md`，**禁止写出 `dataset-snapshot.json`、`cases.jsonl` 与 `review.jsonl`**）。
   - `dataset.py` 在存在混合划分时强制核验 `holdout` 与 `dev`/`test` 零 `caseId`、零 `familyId`、零归一化文本交集。
2. **结果披露最小化（Aggregate-Only Feedback）**：
   - 里程碑盲测只向算法/业务开发侧反馈 **12 大类宏平均指标、安全违规计数与与 `test` 集的泛化落差（$\Delta_{\text{gen}} = \text{Metric}_{\text{test}} - \text{Metric}_{\text{holdout}}$）**；
   - **严禁向开发侧或编码 Agent 导出盲测集的 `cases.jsonl` 原文、逐例失败题面、错题 `originalQuery` 或 `dataset-snapshot.json`**。
3. **泛化落差审计与反迎合门禁**：
   - 当某次算法迭代在 `dev`/`test` 上使 `requestSuccess` 或 `ndcg@5` 提升 `>= +0.05`，但在独立 `holdout` 上提升 `< +0.01` 或发生倒退（或泛化落差 $|\Delta_{\text{gen}}| > 0.10$）时，判定为 **公开基准过拟合（Benchmark Overfitting）**，该算法改动不得作为有效质量提升合入。
4. **污染退役与批次轮换（Retirement on Exposure）**：
   - **绝对禁止使用未来盲测集调整算法、增补正则词表、筛选 Few-Shot 示例或搜索超参数**。
   - 若某条或某批 `holdout` 样本因线上安全事故复盘必须向研发公开题面，该样本立即从盲测集退役（可降级并入下一版公开回归集），并补充全新人工盲测样本替换版本号。
