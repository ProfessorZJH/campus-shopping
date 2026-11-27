# Proposal

## Why

[evaluate-shopping-retrieval-recommendations](../evaluate-shopping-retrieval-recommendations/proposal.md) 已完成首版 120 例评测基础设施与真实链路联调，但第一阶段源码审计证明 `campus-shopping-v1` 存在模板串号泄漏（90.9% 商品案例含唯一串号 `校园系列{n}`）、Gold 相关集未扫描全语料（大量假阴性与跨门店 `grade=1` 误罚）、120 个单样本 `familyId` 无法阻断跨 split 语义与模板泄漏、全单版本短文档缺乏多版本/跨块归因、`K-H-R` 改写消融在知识集上 100% 空转、离线候选池按 `allowedMerchantIds` 预筛造成商户范围 Oracle 泄漏，以及流式 SSE 首 Token 延迟仍写死为 `N/A`。为支撑长期 AI 质量回归与工程治理，需要建设独立、无串号作弊、全语料确定性标注且保留完整人工复核链路的 `campus-shopping-v2` 评测体系。

## What Changes

- 新增独立版本化合成评测集 `ai-service/evaluation/datasets/campus-shopping-v2/`，**不修改、不覆盖 `campus-shopping-v1` 及历史测试证据**：覆盖 10 家合成校园商户（9 正常营业、1 停用、2 待审申请）、480 个具区分度商品、1,020 个多维规格 SKU、80 个多版本/长短结合知识文档、360 条主评测场景（12 主类精确配比，按真实多样本问题家族划分为 144 开发集 / 216 测试集，开发集内抽 24 条 smoke），以及独立的未实现能力挑战集 `challenge.jsonl`（显式标记 `UNSUPPORTED`）。
- 建立独立于被测模型输出的确定性全语料 Gold 标注与校验规则：全量扫描商品/SKU/文档/Chunk 区分主题相关性（`grade=1`）与硬约束可行直接推荐（`grade=2`），统一 `specKey` 与 `attributes` 事实表达以消除 Python/Java 规格断层，保持 `AI_ASSISTED` / `DRAFT` 诚实状态，禁止伪造 `HUMAN_REVIEWED` 或 `ACCEPTED`，并导出增强版人工复核包、标注手册与数据分布报告。
- 最小必要修复阻断评测真实性与可复现性的评测器/夹具缺口（**不修改生产检索、排序与推荐算法，不用测试集调优提示词或参数**）：
  - 扩展 `dataset.py` 与 `ShoppingEvaluationFixture.java` 支持店员有无 `knowledge.read` 角色、多版本知识文档根、`challenge.jsonl` 摘要校验及跨 split 词元/二元语法语义近重复检测；参数化 `ShoppingEvaluationMySqlTest` 商品/SKU 数量断言并记录 Java 端逐例耗时。
  - 修复 `metrics.py`、`java_adapter.py` 与 `comparisons.py` 中 `FAILED` 样本泄漏率误记为 `0`、`DEGRADED` 样本混入纯成功延迟与未标记配对比较、`UNSUPPORTED` 缺独立计数、以及全语料 `grade=1` 背景证据块误杀 `evidenceCoverage` 的评分口径缺陷，同时保持 V1 既有回归兼容。
  - 新增独立的真实流式链路首 Token 延迟（SSE TTFT）测量专项，直接连接流式 HTTP/SSE 接口采集 `startedMs`、`firstProgressMs`、`firstDeltaMs` 与 `completedMs`，绝不从非流式响应推导。
- 执行本地、受控替身与隔离真实 MySQL 实验，基于真实失败样本建立 10 类错误分类与瓶颈分析，区分数据问题、评测器问题、生产实现问题和环境问题；外部付费供应商调用在未获本次显式凭据与预算授权时保持 `NOT_RUN`。

## Capabilities

### New Capabilities

- `shopping-ai-evaluation-v2`：Benchmark V2 的全语料合成数据治理、跨家族防泄漏划分、未实现能力独立挑战集、店员/多版本权限复验夹具、真实 SSE 流式首字延迟测量及失败归因规范（在原 `shopping-ai-evaluation` 之上增量演进，保留 V1 兼容）。

### Modified Capabilities

无。`openspec/specs/` 当前无主基线文件；生产导购、权限、会话租约与交易裁决继续由 `RELEASE-01.md`、`SDD-AI-RECALL-07.md`、`SDD-AI-HYBRID-08.md`、`SDD-REDIS-12.md`、`SDD-AI-STREAMING-13.md` 及 `decisions.md` 管理。

## Impact

- 影响范围：`ai-service/evaluation/`、`ai-service/tests/test_evaluation_*`、`campus-shopping-app/src/test/java/cn/bugstack/ai/test/commerce/ShoppingEvaluation*`、`docs/ai/`、`docs/testing/` 与本变更目录。
- 生产代码零算法改动：不修改 `ai-service/app/` 检索排序/约束逻辑、不新增公开 HTTP API、不新增数据库 DDL 迁移、不改变 `.github/rulesets/main-quality-gates.json` 的必需检查名。
- 验收标准：`campus-shopping-v1` 与 `campus-shopping-v2` 均通过确定性摘要与严格 Schema 校验；Python `pytest`、隔离 MySQL Java 评测与安全回归、SSE 独立流式测量及全仓发布门禁通过；人工 Gold 复核与未授权外部供应商实验据实报告阻塞状态。
