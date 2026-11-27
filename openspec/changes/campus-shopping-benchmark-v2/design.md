# Design

## Context

第一阶段源码审计确认了现有评测工程在 `main @ 703057f` 上的七类结构性短板：
1. `campus-shopping-v1` 通过 `{商品名}校园系列{n}` 唯一串号和 2 种 `specKey` 构造样本，无法反映同义表达、多维规格冲突与跨店同名比价的真实检索难度。
2. `generate.py` 仅在 `[products[n], products[n+120]]` 双槽位内生成 `qrels`，导致全语料其余合规同品类商品成为假阴性；`public-knowledge` 将其他门店文档标为 `grade=1` 并要求全部命中才算 `evidenceCoverage=1`。
3. 120 个单元素 `familyId` 使跨 split 家族隔离退化为空操作，模板换词样本落在 `SequenceMatcher >= 0.92` 阈值下方。
4. 全部文档均为 `version=1`，缺少撤回旧版与现行新版并存、以及长文档第 2/3 分块（`ordinal >= 1`）承载核心规则的场景。
5. `K-D-R` / `K-H-R` 知识改写实验在 V1 上无多轮知识 Gold 样本；离线推荐 `offers_for()` 预筛 `allowedMerchantIds` 掩盖了消费者对话无门店锁定过滤的事实；Java `ShoppingEvaluationMySqlTest` 写死 `240/360` 行数断言且角色不含店员权限细分。
6. `FAILED` 行的 `unauthorizedDisclosure` 仍保留 `0/1 = 0.0`；`DEGRADED` 快速失败混入延迟分位数；`java_adapter` 不接受 `DEGRADED`；`UNSUPPORTED` 缺独立组计数。
7. 生产已提供 `/v1/query/stream` 与 `/api/v1/ai/chat/stream`，但评测尚无独立流式测量链路。

## Goals / Non-Goals

- **Goals**：
  1. 交付完全独立的 `campus-shopping-v2`（360 主场景 + 24 独立 `UNSUPPORTED` 挑战场景、10 商户、480 商品、1,020 SKU、80 知识文档版本），零串号作弊、全语料确定性打标、真实多案例 `familyId` 划分且 `AI_ASSISTED/DRAFT` 状态诚实可审。
  2. 修复评测器、导入校验与 Java 测试夹具中阻断真实统计和 V2 运行的缺陷，保持 `campus-shopping-v1` 全量测试与门禁 100% 兼容。
  3. 建立真实 SSE 流式链路的首字节/首进度/首文本片段/完成耗时独立测量专项。
  4. 执行本地、受控替身与隔离 MySQL 可比实验，输出逐例结果、分类指标、延迟分位数及 10 类真实错误归因报告。
- **Non-Goals**：
  - 不修改 `ai-service/app/` 或 Java 生产导购/检索/排序/约束算法，不针对 V2 开发集或测试集调参、改 Prompt。
  - 不伪造 `HUMAN_REVIEWED`、`ACCEPTED` 或外部付费模型调用结果；不访问正式业务库或删除既有向量集合。

## Decisions

### D1. V2 语料规模、场景配比与防泄漏家族设计

- **合成语料**：明确在 `manifest.json` 标记 `synthetic: true` 与 `dataOrigin: "SYNTHETIC_BENCHMARK_ONLY"`，使用虚构校园品牌与门店，不含任何真实个人信息。
  - **商户（10 家）**：`m0..m8` 为 `ACTIVE`（覆盖便利超市、文具书屋、轻食水吧、数码工坊、宿管生活馆、体育装备、零食驿站、办公印务、夜宵能量站），`m9` 为 `SUSPENDED`，另含 2 条 `SUBMITTED` 入驻申请。保留 `m0` 为首个活跃商户以兼容 `ShoppingEvaluationFixture` 既有主商户映射。
  - **商品与 SKU（480 商品 / 1,020 SKU）**：覆盖 `convenience`、`stationery`、`food_beverage`、`digital`、`dormitory`、`sports` 六大校园消费类目；构造跨商户同名异价/异规格、相似易混商品、零库存（`onHand=0` 及 `onHand=reserved`）、SKU 停用（`INACTIVE`）、商品下架/草稿（`UNPUBLISHED`/`DRAFT`）、停业商户低价诱饵与多维规格冲突。所有可核实规格同时写入 `specKey` 与 `attributes`，确保 Python 与 Java/MySQL 口径一致。
  - **知识文档（80 个文档版本）**：平台级文档与各商户文档均严格控制在单主体 `< 40` 篇以内（自然满足生产 `IAiDao.reserveIndexRate` 每主体 60 次/分钟配额，无需放宽生产限流）。包含 `PUBLIC`、`MERCHANT_INTERNAL`（含独立合成 canary）、`PLATFORM_INTERNAL`（含独立合成 canary），以及同一 `rootKey` 下旧版 `WITHDRAWN`（`version=1`）与新版 `PUBLISHED`（`version=2`）并存、草稿 `DRAFT` 未发布，以及 `950~1,700` 字跨 2~3 个 chunk（核心证据位于 `ordinal=1` 或 `2`）的长规章文档。
- **主评测集 360 场景与精确划分**：
  - 12 个主类严格满足：`exact-product-spec` (30)、`fuzzy-need-scenario` (40)、`budget-combo-constraint` (35)、`attribute-quantity-negation` (30)、`oos-discontinued-nomatch` (25)、`cross-merchant-compare` (20)、`public-knowledge-multievidence` (35)、`multiturn-clarification` (40)、`colloquial-typo-ambiguity` (25)、`knowledge-acl-privacy` (25)、`prompt-injection-hallucination` (25)、`proposal-safety-mutation` (30)。
  - 每类精确按 40% / 60% 切分为 `144 dev` 与 `216 test`，从 `dev` 均匀抽取每类 2 例共 `24 smoke`。
  - 语义等价改写、口语/错别字变体与同核心诉求的多轮变体归入同一多成员 `familyId`（约 180~210 个家族），整族进入同一 split；校验器同时拒绝跨 split 家族重合、规范化文本重合，并检测跨 split 二元语法 Jaccard 与 `SequenceMatcher` 近重复。
- **独立挑战集（`challenge.jsonl`）**：收录 24 条当前系统明确未实现或未开放的产品能力请求（独立 Reranker、优惠券满减、跨商户合单支付、宿舍配送上楼、已提货退货/部分退款、图片/扫描 PDF OCR、自动下单扣款、消费者强制单店锁定召回等），每条显式标注 `capabilityStatus: "UNSUPPORTED"`，通过 `evaluate.py --dataset campus-shopping-v2 --split challenge` 独立核验报告，不污染 360 条主集分母。

### D2. 全语料确定性 Gold 标注与权限/多版本扩展

- 生成器 `evaluation/generate_v2.py` 基于结构化领域属性（商品语义原型、用途标签、规格集、价格、可用库存、商户/发布状态、文档主题与有效段落定位）对**全量 480 商品 / 1,020 SKU / 80 文档及其分块**做确定性布尔求解：
  - `qrels.product` / `qrels.sku`：`grade=2` 仅赋予同时满足语义核心诉求与全部确定性硬约束的可售项；`grade=1` 赋予同主题但因价格/规格/缺货/次优跨店报价而不作为首选的已上架活跃商户项；下架、草稿、停业商户项不进入正相关集。
  - 消费者场景 `allowedMerchantIds` 统一为全部 `ACTIVE` 商户，彻底消除离线候选池预筛单个门店的 Oracle 泄漏。
  - `qrels.document` / `qrels.evidence`：精确关联授权可读且已发布的文档与对应 `ordinal` 分块 SHA-256；区分回答必需的核心证据（`grade=2`）与同主题背景参考（`grade=1`）。多轮知识追问场景同步标注知识 Gold，使 `K-D-R` / `K-H-R` 产生真实可测的改写对照。
  - 扩展 `actorRef` 支持 `merchant-clerk-read-<mid>`（拥有 `knowledge.read` 权限的店员）与 `merchant-clerk-noread-<mid>`（无 `knowledge.read` 权限的普通店员），在 Python `dataset.validate` 与 Java `ShoppingEvaluationFixture` 中同步使用真实领域 RBAC 能力建模。
  - 扩展 `ShoppingEvaluationFixture` 支持按可选 `rootKey` 在同一知识根下依次创建并演进多版本文档（使 MySQL `ai_document.version` 真实递增），并动态读取数据集商品/SKU 总数做完整性断言。

### D3. 评分统计修复与真实 SSE 首 Token 延迟专项

- **统计口径修复（保持 `SCORER_VERSION = '3'` 既有兼容结构，增量补充诚实字段）**：
  - `FAILED` 案例因未完成输出生成，`unauthorizedDisclosure` 在失败空输出上标为 `status="FAILED", value=None`，不再计入“已验证零泄漏”。
  - `evidenceCoverage` 在存在 `grade == 2` 核心证据分块时要求全部核心分块被合法引用且无任何非法引用（无 `grade == 2` 时退回全部 `grade > 0`），避免全语料背景 `grade=1` 分块造成误判，同时兼容 V1 全部单测。
  - `aggregate()` 增加 `unsupported` 计数与仅统计 `EXECUTED` 样本的 `executedLatency`（保留原 `latency` 字段兼容既有契约，同时消除 `<1ms` 预算耗尽 `DEGRADED` 对真实延迟的掩盖）；`comparisons.paired()` 输出 `leftDegraded` / `rightDegraded` 计数；`java_adapter` 支持保留并传递 `DEGRADED` 状态及 Java 逐例墙钟 `latencyMs`。
- **独立 SSE 首 Token 延迟测量（`S-SSE`）**：
  - 新增 `evaluation/streaming.py` 并在 `evaluate.py` 支持 `S-SSE` 实验：启动隔离临时 SQLite 与真实 `uvicorn` 本地回环 HTTP 服务（或受控 Mock 上游流式 SSE 传输），使用 `httpx.Client.stream("POST", "/v1/query/stream", json={..., "streamText": True})` 逐帧读取真实 SSE 事件流。
  - 逐例独立记录 `startedMs`（`event: started`）、`firstProgressMs`（首个 `event: progress` 上游原始流式字节到达）、`firstDeltaMs`（首个 `event: delta` 用户可见文本块到达）与 `completedMs`（`event: completed`），并在流式实验组的 `latency.firstTokenMs` 报告 nearest-rank P50/P95；非流式实验继续保持 `firstTokenMs = None`。

## Risks / Trade-offs

- **不改生产算法将暴露真实低分案例** → 预期行为：V2 专门设计了跨维规格冲突、无引导词省略追问、口语否定、混合购物+规则提问及单品候选累计预算截断等真实难点，客观记录当前实现瓶颈并形成第五阶段 10 类错误分类，严禁回调 Gold 或偷改生产代码迎合分数。
- **人工复核与外部付费 API 门禁** → 所有 V2 标注保持 `AI_ASSISTED` / `DRAFT`，生成完整 HTML + JSONL 人工复核包与争议清单；未获外部凭据与请求预算授权的 `real-*` 实验诚实保持 `NOT_RUN`。
