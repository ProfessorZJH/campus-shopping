# Tasks

## 1. 第一阶段审查与分支基线

- [x] 1.1 完整审查 `ai-service/evaluation/`、`campus-shopping-v1`、`ai-service/app/`、`ShoppingEvaluation*Test` 及历史报告，输出含精确源码行号与数据实证的七项问题审查报告。
- [x] 1.2 基于 `main @ 703057f` 创建独立分支 `codex/benchmark-v2-evaluation`，建立 OpenSpec 变更提案、设计与规格并通过 `openspec validate --strict`。

## 2. Benchmark V2 语料、360 主场景与独立挑战集构建

- [x] 2.1 实现独立确定性生成器 `ai-service/evaluation/generate_v2.py`（保留 `generate.py` 与 `campus-shopping-v1` 原封不动），构建 10 家合成商户、480 个商品、1,020 个多维规格 SKU 及 80 个多版本/多块知识文档。
- [x] 2.2 构建覆盖 12 主类的 360 条自然中文评测场景（无串号拼接，含多轮 `user`/`assistant` 历史、口语错别字、跨店比较、权限隔离、提示注入与提案状态变化），按多成员 `familyId` 精确划分为 144 `dev` / 216 `test` 及 24 `smoke`，并构建 24 条 `UNSUPPORTED` 独立挑战集 `challenge.jsonl`。
- [x] 2.3 实现基于全量语料的确定性 Gold 求解（`qrels.jsonl` 与 `annotations.jsonl`），区分主题相关（`grade=1`）与硬约束可行推荐/核心证据（`grade=2`），保持 `AI_ASSISTED` / `DRAFT` 状态，生成 HTML 人工复核包、标注手册与数据分布报告。

## 3. 评测器、Java/MySQL 夹具与独立 SSE 流式延迟增量

- [x] 3.1 扩展 `dataset.py` 与 `ShoppingEvaluationFixture.java` / `ShoppingEvaluationMySqlTest.java` 支持店员有无 `knowledge.read` 角色、多版本知识文档根、`challenge.jsonl` 校验、跨 split 近重复检测及动态商品/SKU 计数与耗时采集。
- [x] 3.2 修复 `metrics.py`、`java_adapter.py`、`comparisons.py` 与 `reports.py` 中 `FAILED` 泄漏率、`DEGRADED` 状态传递与延迟/配对标注、`UNSUPPORTED` 计数及全语料核心证据覆盖率口径，补充兼容性回归测试并确保 V1 全套测试继续通过。
- [x] 3.3 实现独立流式测量模块 `evaluation/streaming.py` 并接入 `evaluate.py`（`S-SSE`），通过真实流式接口逐帧测量 `startedMs`、`firstProgressMs`、`firstDeltaMs` 与 `completedMs` 的 P50/P95。

## 4. 可比实验执行、错误分类与门禁交付

- [x] 4.1 在 `campus-shopping-v2` 上执行本地与受控可比实验（`K-B`、`K-D`、`K-H`、`K-D-R`、`K-H-R`、`R-RULE`、`R-LLM` 受控对照、`S-SSE` 流式首字延迟、`challenge` 与 `E4` `UNSUPPORTED` 核验），以及隔离真实 MySQL 的 `P-L`、`P-D`、`P-H`、`P-H-R`、`P-TERMS` 与 `SAFE` 安全回归；未获授权的外部供应商实验诚实保持 `NOT_RUN`。
- [x] 4.2 基于真实失败样本完成 10 类错误归因与 AI 质量瓶颈分析，区分数据、评测器、生产实现与环境问题，汇总正式实验文档至 `docs/testing/AI-EVALUATION-V2-20261127.md`。
- [x] 4.3 执行 Python `pytest`、`verify-release.py`、API/Schema/UI 契约与隔离 MySQL 门禁，清理全部临时数据库、进程与评测临时目录，提交分支并创建或准备 Draft PR。

## 5. 正式业务评测验收（需实际人工复核与外部预算授权，未完成前保持未勾选）

- [ ] 5.1 由人类评审员独立复核 `campus-shopping-v2` 全部 360 条 `cases`/`qrels` 并双人裁决 22 条争议样本后冻结 `ACCEPTED` 数据集（严禁 AI 伪造 `HUMAN_REVIEWED` 或 `ACCEPTED`）。
- [ ] 5.2 在明确外部 API 凭据与请求预算授权后，在隔离环境执行 V2 `real-embedding`、`real-llm`、`real-milvus` 及 Java/MySQL 组合对照实验并记录真实成本与降级率（本轮未获授权，诚实保持 `NOT_RUN`）。
- [ ] 5.3 完成回答断言支撑性（`citationGrounded`）、推荐解释忠实度与语义级隐式泄漏人工评审，重算正式验收报告后再同步 OpenSpec 主规格并归档。
