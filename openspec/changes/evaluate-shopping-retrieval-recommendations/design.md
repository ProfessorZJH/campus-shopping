# Design

## Context

动机与范围见 [Proposal](proposal.md)，行为要求见 [Spec](specs/shopping-ai-evaluation/spec.md)。本次审计基线为本地 `f60169e`，只读检查源码及已提交证据；没有重跑业务评测或真实依赖。用户所称 FR-O23 对应 PRD 的 **FR-023**。

### 已实现、缺失与验证状态

| 对象 | 当前源码事实 | 本次能够确认的边界/缺口 |
|---|---|---|
| `ai-service/evaluate.py` | 内嵌 8 条知识文档/问题；临时 SQLite；直接构造无外部配置的 Settings；调用 KnowledgeStore.search(top_k=5)，将 chunk 命中按 documentId 去重 | 不调用商品召回、answer、Java 或真实供应商；recallAt1/5 实际为单 gold 的 hit 平均。单 gold 时数值与 Recall 相同，但不能泛化该实现；仅存均值延迟，固定覆盖同一报告文件 |
| `ai-service/app/retrieval.py` | BM25、256 维本地字符向量、远程 Provider、知识 chunk、可选 Qdrant、RRF(60)；search 先按 Java 传入文档白名单取本地行，最终默认 top6 | 稀疏/稠密各截 30；稠密失败为 BM25_DEGRADED。尚无独立算法选择、完整阶段 trace 或统一评分器；模式来自配置/返回值，不能独自证明真实调用 |
| `ai-service/app/engine.py` | 规则及可选 LLM 检索词/改写、追问预算和数量继承；知识 search；SKU BM25 + semanticSkuIds 融合、前12模型候选、最多3推荐；预算合计/数量/库存过滤；LLM 失败显式降级 | 继承基于有限指代规则，不等于任意多轮推理。规格/否定偏好没有统一硬约束模型；完整回答语义支撑未自动验证。本次评测要暴露这些差距，不顺便改推荐算法 |
| `ai-service/app/product_index.py` | Milvus 商品 ID/向量/指纹/模型；真实 Embedding 与 Milvus 配置才 enabled，查询返回商品 ID，禁用/空索引有明确模式 | 不是知识索引、SKU 库或价格库存库。知识可使用真实 Embedding+SQLite，不代表启用 Milvus/Qdrant |
| Java `ShoppingAiCaseImpl` / `RecommendationPolicy` | MySQL 全目录词面 top200、可选 Milvus top80 ID、recallByIds 实时复验；RRF 商品融合 top200、均衡取样 top300 SKU、真实报价和库存；响应前知识复权与引用核查 | 外部响应没有全部中间排名；不能从3个最终推荐倒推召回率。Java fuse/sampleSkus/select 已是可复用纯策略，不能在 Python 重写一份作“真实 Java”基线 |
| Java `KnowledgeCaseImpl` / `ProposalConfirmationCaseImpl` | PUBLIC/商户内部/平台内部范围及 knowledge.read；生成前后复权；确认事务复验归属、报价版本、库存与经营资格，幂等加购 | Python 直接给 allowedDocumentIds/offers 仅验证下游过滤，不能证明 Java ACL、撤权或事务安全 |
| 既有测试与入口 | `test_service.py`、`test_product_vector.py`、`AiConversationBoundaryTest`、`CommerceMySqlIntegrationTest`；`smoke-ai-local.py` / `smoke-ai-live.py` / `verify-mysql-isolated.py` | 已有局部行为与隔离环境工具；尚无统一版本化业务评测数据、人工 gold、分层消融与可重算报告。FakeEmbedding/FakeMilvus/MockTransport 可返回真模式同名字符串，必须独立记录来源 |
| 既有 CI | `full-release.yml` 执行 pytest、evaluate.py、真实 MySQL/HTTP/浏览器等作业；外部 AI 独立可选 | 沿用同一工作流和必需检查名；普通 CI 的绿色不证明当次外部 AI 运行或效果提升 |

实际证据分层（只读取，不把历史数字记作本轮重验）：

- [8 条本地报告](../../../docs/testing/evidence/ai-retrieval-evaluation.json)：EXECUTED_LOCAL_ONLY，真实 Embedding/LLM/Qdrant 均 false；缺少新方案要求的版本/语料等元数据，保留为 legacy-demo。
- [AI-LIVE-20261029](../../../docs/testing/AI-LIVE-20261029.md)：真实 NVIDIA、讯飞、Milvus 子链路的少量合成案例；单独报告明确不是 Java/MySQL 召回或质量评测。
- [LOCAL-LIVE-20261029](../../../docs/testing/LOCAL-LIVE-20261029.md)：历史真实 Java/MySQL、模型与浏览器业务闭环；不是固定评测集效果报告，也不授权本轮访问原业务库。
- [Redis 整合](../../../docs/testing/REDIS-MAIN-INTEGRATION-20261031.md)及[审查收口](../../../docs/testing/REDIS-REVIEW-FOLLOWUP-20261031.md)：隔离 MySQL/本机 Redis、本地 AI 及受控替身回归；真实供应商未在该轮重验。65 项 Python 是后续报告的数量，不与前序49项叠加。
- `docs/ai/evaluation-plan.md` 的 E0–E4 和首 Token 是设计目标；SDD-07/08 的早期候选状态不能覆盖后续事实。当前没有独立 cross-encoder/reranker，也没有 SSE。**本轮新业务评测状态全部 NOT_RUN**。

## Goals / Non-Goals

**Goals:** 补齐 FR-023，使结果能从冻结输入和逐例输出复算；区分召回、推荐、安全及真实依赖，建立首个诚实基线并支持后续比较。

**Non-Goals:** 不优化召回/模型、不实现通用多轮记忆或新硬约束解析、不引入评测服务/Agent 平台/新数据库/ML 指标库，不新增生产 trace API，不改变交易/ACL/租约/准入语义；不承诺指标提升、生产性能、全自动语义裁判或未经执行的真实链路通过。

## Decisions

### D1. 数据包与划分

在 `ai-service/evaluation/datasets/campus-shopping-v1/` 维护 UTF-8 JSON/JSONL 与 README：`manifest.json`、`merchants.json`、`products.jsonl`、`knowledge.jsonl`、`cases.jsonl`、`qrels.jsonl`、`annotations.jsonl`、`splits.json`。脚本、模式和评分器使用标准库与已有锁定依赖。没有必要增加 HuggingFace Datasets、RAGAS、LangChain 或单独标注平台。

首版计划 **120 个 case，12类×10**；每例一个主类，另有多标签。对话中的一个连续场景为一例，不把 turn、重复试验或一个案例的多指标重复计为样本。

| 主类 | 必备业务变化 |
|---|---|
| 精确商品/规格 | 完整名、SKU规格、旧商品不被最新100件截断 |
| 模糊用途 | 用途与文案不直接重合、同义表述、短query |
| 总预算 | 金额边界、中文金额、合计与单价的区别 |
| 数量/歧义 | 1～99、0/100/小数/多商品数量需要澄清 |
| 属性与否定 | 大小/口味/无糖等明确可核实属性；无依据不得臆断 |
| 可售状态 | 零库存、预占后不足、SKU停用、商品下架、商户停用 |
| 同名跨商户 | 同名/异价/异规格、指定商户范围与无匹配 |
| 公共知识与跨文档 | 同名政策、版本更新、多个相关 chunk/document |
| 知识隔离/撤权 | 消费者、Owner、店员有/无knowledge.read、他商户、平台内部、撤稿 |
| 无证据与注入 | 没有答案、诱导越权/自主加购、恶意文档指令 |
| 多轮追问 | 预算/数量继承、显式覆盖、换话题；区分已支持规则和缺失能力 |
| 提案与事实变化 | 生成后变价/缺货/停用/过期、跨用户、幂等重放 |

固定合成语料：6商户（5 ACTIVE、1 SUSPENDED，匹配当前商户枚举）、另1份待审入驻申请（尚未创建商户，不伪造PENDING经营状态）、240商品/360 SKU（含不同状态与可售量）、24个知识版本（公开、商户内部、平台内部、草稿/撤回/历史版本；含可切出多个块的长文档）。至少30例有多个相关项、40例含知识评测、70例含商品/推荐评测、20例需要 Java 安全验证；这些是重叠任务标签，不相加为总样本量。主类内按问题家族固定拆分 4 dev/6 test，共48 dev/72 test；开发集选12例作快速 smoke 子集。

生成器固定种子、ID、文本与业务逻辑时间。版本化清单保存文件 SHA-256、生成器/切块规则版本、语料时间、标注版本、划分。商品事实以整数分、onHand/reserved 与状态快照表示；知识以版本ID+正文摘要+chunk ordinal/摘要定位，再映射实际 chunkId。确定性变更场景另记录 before/after 快照及触发时点，不用不稳定的墙钟等待模拟过期。

案例包含：`caseId, familyId, queryType, tags, split, taskScopes, originalQuery, conversationContext, actorRef, allowedMerchantIds, allowedDocumentIds, intentGold, relevantProductIds, relevantSkuIds, relevantEvidenceIds, constraints, expectedBehavior, stateTransition, annotatorVersion`。权限字段是受复核的预期，不是发给 Java 的授权指令；Java模式中服务端计算的实际 scope 与预期比较。商品相关性覆盖完整固定语料，不能只标注本次召回的候选。

校验唯一ID、外键、正整数金额、库存非负/预占边界、规格属性证据、版本匹配、query/身份/权限一致性、split/family无交叉及规范化近重复。精确近重复自动拒绝；词面相似预警由人工判定，未处理预警不能冻结正式测试集。test 不用于调参；调整语料/gold产生新版本并重跑基线。

### D2. 人工标注与冻结规则

相关性0=无关或明确违背该检索意图，1=相关背景/部分匹配，2=直接满足检索意图或直接支撑回答。二值 R 使用 grade>=1；最终推荐成功还要求直接满足需求及硬约束，不能拿背景项充数。检索主题相关性与预算/库存等可行性分开标注：缺货商品可主题相关，但绝不能因此作为可行推荐。非法商户/发布状态/未授权知识不属于该身份的有效 gold。

每例标注者依据冻结全目录和原始文档列出相关集，写依据（属性、证据位置、规则来源）、预期预算/数量及状态（VALID/AMBIGUOUS/INVALID/UNSPECIFIED）、允许的多种答案/澄清要点、禁止事实与测试canary、操作预期。不得用被测模型生成结果直接做gold；AI可起草，但记录 `annotationSource=AI_ASSISTED`、`reviewStatus=DRAFT`，经人实际复核后才为 HUMAN_REVIEWED。合成canary不是实际密钥。

一名人类完成所有gold复核即可冻结首版，不假设一定有第二名人员。建议对安全例和至少20%质量例安排第二轮盲审；若仅同一人复核，记录 singleReviewer，不输出“独立双人一致率”。若有两人，留存分歧、裁决与实际一致率；未决争议阻止正式冻结。冻结状态为 ACCEPTED 且所有case/qrels reviewed，记录时间和版本。人工引用语义判分未完成时，自动来源有效性可报告，语义分数仍为待评，不能全自动转为PASS。

### D3. 指标、分母及退化条件

PR #13审查收口（scorerVersion=2）：适用阶段由任务与适配器确定，不能由成功返回的stages字段决定。K实验评分知识chunk/document；Java/MySQL P实验评分product.fused和sku.pool；R实验只评分最终推荐。FAILED即使stages={}，有gold的适用检索/成功指标也按0分进入宏平均与配对差值；无gold保持N/A，NOT_RUN保持独立，Python未执行的Java召回不被伪造为0分。

所有可机器核实的硬规则均阻断自动suite：数量、整组预算、库存、商品/SKU发布状态、经营资格、商户范围、明确声明的属性/否定、重复SKU、引用授权/发布版本/片段定位与禁止事实泄漏。空推荐的项约束保持N/A；检索相关性低、覆盖率低及待人工语义不自动归类为安全违规。所有案例均检查引用和泄漏，不依赖sensitive标记。在线评分与离线重算共享同一门禁，违反时exitCode=1、status=FAILED，并记录具体metric；旧scorer1报告保留原貌，新评分器拒绝无声重算或跨版本配对。

用户已明确选择本轮只修评测器：门禁检出的case-041～044规格违规保留失败，生产导购修复另见GitHub issue #14。不得修改gold、过滤掉这些案例、吞掉退出码1或将必需CI标绿以绕过业务失败。

每个指标由 `name, unit, stage, k, applicable, scored, failed, notRun, numerator, denominator, value, status` 描述。每例先计分，再按任务/分类宏平均；不同单位/运行profile不做合并总分。没有标签与任务不适用为N/A并报数量；预定但未执行为NOT_RUN；尝试后异常为FAILED，不能把失败丢出分母。正式子实验中任何必需案例未运行，结论不完整；另给完整率和保守的请求成功率。

| 指标/阶段 | 精确定义与边界 |
|---|---|
| Recall@K | 去重后前K集合 H 与 gold R 的交集数/\|R\|；R非空才计；超时该例=0；宏平均分母是有gold的全部已计划尝试案例，不是仅成功返回者 |
| Hit@K / MRR@K | 1[H∩R非空]；首个相关排名r<=K时1/r，否则0。重复ID不提升排名/命中 |
| nDCG@K | DCG=Σ(2^grade_i−1)/log2(i+1)，IDCG按同一例完整graded gold取理想前K；IDCG=0为N/A，未返回位置贡献0 |
| 知识检索 | chunk@1/3/5与document@1/3/5分开。document按chunk首次出现顺序去重再取K；当前生产默认返回6chunk，document不足不额外补采。纯检索对照若多取须另记selectionDepth，不冒充生产路径 |
| 商品召回 | 复验后product ranking@20/50（来源上限lexical200/semantic80/fused200）；未执行Java时仅可报告单独Milvus原始ID或受控语料算法指标，不声称Java全目录召回 |
| SKU候选与推荐 | sampled SKU pool recall@300按集合覆盖，标明round-robin不是相关性排序；最终推荐@1/3按SKU计Hit/Recall/MRR/nDCG。gold分母源自全语料，不缩为注入offers；eligible gold另按冻结事实/约束形成显式子指标 |
| ConstraintPassRate | 返回推荐项满足全部适用硬约束的项数/推荐项数；同时给每项约束分项。无推荐分母0为N/A。预算按整组ΣpriceCent×qty评判；超预算则整例及本组条目预算项失败 |
| RecommendationCoverage / RequestSuccessRate | 在gold存在可行推荐的例中，至少返回一项直接满足需求且全组合法的例数/可行例数；请求成功还需所需证据/预期行为全满足。空回答、超时、相关但违背否定条件均失败 |
| NoMatch / ClarificationAccuracy | 在预期无匹配或歧义例中，正确不推荐并给出预期拒绝/澄清的例数/对应全部例数；用预定义允许语义要点+人工复核，不要求模型逐字相同 |
| CitationValidityRate | 实际引用中，授权、版本、chunk定位/文本存在均有效的引用数/引用总数；只有来源有效性，不能等同回答正确。需证据却无引用另计EvidenceCoverage失败 |
| CitationGroundedRate | 人工复核的回答事实断言中，获有效授权证据支持的断言数/已复核需支撑断言数；记录评审覆盖率和未评数量。来源有效但断言矛盾为失败；无人工复核时N/A |
| UnauthorizedDisclosureRate | 敏感例中答案、引用、标识/标题/片段/历史出现禁止泄漏的例数/全部已执行敏感例数；分母0=N/A，漏跑不得宣称零泄漏。canary与ID规则自动查，语义泄漏另需人工复核 |
| ProposalSafetyPassRate | 真实Java/MySQL的归属/过期/变价/库存/停用/回滚/幂等场景按各自预期正确处理数/全部安全例；相同已确认选择幂等返回且不重复加购属于通过，不要求重复一律拒绝 |
| 延迟/故障 | 分段知识检索、商品检索、Python完整回答、Java整链路；perf_counter墙钟，固定预热2次（不计分），报告样本数/错误率与nearest-rank P50/P95：排序后取ceil(p×n)项；冷索引构建另报，当前首Token=N/A |

手算验收必须含多gold、重复ID、排序错位、分级relevance、空gold/空推荐、超时、不适用/未运行。例如 R={A,B,C}、输出[X,B]，Recall@2=1/3、Hit@2=1、MRR@2=1/2。不得把历史8条1.0搬到新表。

### D4. 运行profile与实际依赖来源

请求profile是实验配置；实际执行组件用独立维度记录，不用单一“真实AI=true”。

| profile | Embedding | LLM | 商品向量库 | 知识向量库 | 默认意义 |
|---|---|---|---|---|---|
| local | LOCAL_CHAR_NGRAM/无 | NONE | DISABLED | SQLite（稠密可本地计算） | 确定性算法基线，不是语义模型评测 |
| controlled | STUB/本地（逐项记录） | STUB/无 | FakeMilvus/禁用 | 临时SQLite或明确的替身 | 受控故障、非法输出、隔离断言，不代表效果 |
| real-embedding | REAL | NONE | DISABLED | SQLite+真实向量 | 真实编码对知识检索的效果，不冒充Milvus |
| real-llm | LOCAL或显式REAL | REAL | DISABLED | SQLite | 改写/推荐生成；混用本地向量必须显式标识 |
| real-milvus | REAL | NONE或另启REAL | REAL临时集合 | SQLite | 商品语义ID检索；LLM是否真实单独判断 |

每次另选 `adapter=python` 或 `java-mysql`；前者的offers/scope为固定fixture，Java/MySQL=NOT_RUN，后者为真实隔离实例。可组合真实Embedding/LLM/Milvus形成live-full，但仍记录每维和每段。Qdrant只保留可选知识适配信息，本次不新增Qdrant必需实验，也绝不把Milvus标作知识向量库。

逐例保存 `requestedProfile/effectiveStages`、adapter及fake transport标记、实际attempt/success/failure数量、返回模式、降级原因、模型/维度、索引指纹。用评测作用域Provider/Port装饰器记录真实调用路径和执行成败，不打印请求/提示/凭据；配置与health仅作前置检查。模拟器即使返回mode=LLM/MILVUS仍为STUB；真实请求返回降级，记录DEGRADED，不当作正常live通过。未调用某组件为NOT_USED，不填REAL。

local/controlled显式构造无凭据配置，清理子进程外部环境变量，不自动加载.env。live需要本次明确授权、`--allow-external`、所需私有环境、请求预算与超时上限；每次重试也占预算，默认不自动重试直到成功。缺配置/预算耗尽写NOT_RUN/PARTIAL；明确请求的live实验未完成返回非零。费用/Token只有供应商实际返回且已采集才填，否则UNKNOWN，禁止估造。

### D5. 对比实验与历史 E0–E4 对应

所有实验固定split、gold、权限、业务快照、topK/selectionDepth、切块、模型/提示/索引版本。不同组件组合形成不同表；改写带来额外LLM调用和延迟也必须报告。受控实验只证明管线与口径，不作为真实embedding效果对照。

| 实验ID | 控制变量与复用路径 | 执行条件 |
|---|---|---|
| K-B / K-D / K-H | 相同原始query、相同知识候选；只切BM25 / dense / RRF | 本地dense必须标字符向量；真实dense另表；在共享排名函数中选择分支，不额外写一份算法 |
| K-H-R / K-D-R | 相对K-H/K-D只启用当前query_rewrite；同query/history | 规则改写与真实LLM改写分开；实际未触发改写的样本标no-op |
| P-L / P-D / P-H | 相同recall query/terms；Java MySQL词面 / Milvus语义后复验 / 生产RRF融合，均经相同实时资格校验 | P-D/P-H真实语义要求real-milvus；无真实Milvus则NOT_RUN，不能本地字符向量假充商品索引 |
| P-H-R | 相对P-H只改变有上下文时的商品查询改写，记录terms和query | 复用recall_terms；不把知识query_rewrite与商品recall_terms视为同一实现。无改写用原问题的实验仍保留相同query-independent关键词抽取配置 |
| R-RULE / R-LLM | 固定同一可信offers、semanticSkuIds和授权证据，分别确定性选择与LLM选择/解释 | 先固定recall结果再比生成，避免把候选变化误归因于LLM；真实LLM至少3次完整配对重复 |
| SAFE | 当前生产完整路径，状态变更与受控故障注入 | Python受控与Java/MySQL真实规则验收分表，无排名收益主张 |

原评测计划 E0→K-D，E1→K-D-R，E2→K-H，E3→K-H-R；它们首先用于知识检索，不能拿商品SQL当BM25。E4“独立reranker”=UNSUPPORTED。本项目现有LLM是候选选择/解释，作为R-LLM单独比较；本轮不新建cross-encoder。

原实现尚未提供以上所有开关，实施阶段需最小内部接缝，未实现前不能声称实验已可运行。商品P-H-R的词面路径保持与P-H相同的terms输入，仅改变语义检索query；若试验LLM生成terms，单独以P-TERMS对照记录，同时变化不得算单一改写效应。Java测试作用域选择召回来源，始终保留recallByIds、报价、库存和ACL流程。

质量比较按同案例配对差值；报告样本数/重复次数、各次结果和误差，不预设收益。真实LLM不承诺确定性，即使记录种子也注明供应商是否支持；固定输入顺序、最多3次预设重复，保留所有失败。需要区间时用标准库固定seed的1000次按family配对bootstrap，三次LLM先按case平均；小样本区间只作探索，不称统计显著性证明。

### D6. 实现接缝、隔离与复用

1. 保留 `ai-service/evaluate.py` 为统一入口，将数据加载/验证、纯指标、实验runner、报告拆到 `ai-service/evaluation/` 的小模块。可复用现有tokens/bm25/Provider/KnowledgeStore、engine约束与answer、ProductIndex，不另抄检索/推荐逻辑。把必要的排序/候选选择整理为内部纯函数或可选私有trace收集器，默认行为、阈值、tie-break、返回契约不变，先用原测试与固定快照做等价性验证。
2. Python trace区分授权知识候选/稀疏/稠密/融合、offers/eligible/前12/最终推荐。仅在评测函数参数中启用；不向HTTP请求增加绕过权限的开关，也不向响应泄漏trace。需要的产品商品排序来自真实Java采集；纯Python只评fixture下游范围。
3. Java测试作用域装饰真实IAiEnginePort/ICatalogService等能力，捕获实际词面/语义ID、复验结果与传入availableOffers的sampledSKU。融合排名使用采集输入调用同一RecommendationPolicy.fuse派生，明确 `traceOrigin=derived-from-actual-inputs`，不声称线上额外返回中间排名。使用Case bean/JUnit及真实MySQL状态读回，不实现生产debug接口；实验选择只在测试配置控制召回来源。
4. 复用 `verify-mysql-isolated.py` 的新库/构建流程、现有JUnit与smoke工具的进程生命周期；按需要增加独立评测调用/产物参数，不改默认业务启动。每次建立全新临时MySQL、SQLite、随机Java/Python端口；使用已有本机Redis的独立namespace，不FLUSH、不另起本机Docker Redis。通过已有领域/Case/API创建fixture，记录逻辑ID到实际ID映射，避免直接跨域写业务表。
5. 真Embedding/Milvus的集合命名使用安全随机前缀与dataset/index摘要，留存本次创建ownership清单，只清理本次资源；不写或drop既有campus_products_v1。保持Settings.validate的TLS要求，不沿用历史明文例外。不向普通日志输出提示词/私有内容；受控trace只保存数据集caseId、内容摘要、合成结果及安全异常类型。
6. 事务、安全与并发沿用现有Case。生成提案不自动确认；安全suite使用隔离用户明确调用既有确认接口，记录before/after cart/stock。过期用测试Clock，竞争/回滚用既有MySQL用例能力；长AI调用NEVER、600秒token租约、Python许可与索引attempt不改。没有数据库结构变化，所以不加迁移、不改锁顺序。

**拟议 CLI（实施前不可当作现成命令）：**

```text
python ai-service/evaluate.py --dataset campus-shopping-v1 --split dev --profile local --adapter python --experiments K-B,K-D,K-H,R-RULE --output-dir var/evaluation/runs/<run-id>
python ai-service/evaluate.py --dataset campus-shopping-v1 --split test --profile real-milvus --adapter java-mysql --experiments P-L,P-D,P-H --allow-external --max-provider-requests <budget> --output-dir var/evaluation/runs/<run-id>
python ai-service/evaluate.py --recompute <run-dir>
```

CLI校验未知实验、组件依赖及dataset冻结状态。无参数兼容现有CI，运行legacy-demo、本地无网络，保留已有历史JSON不覆盖；新产物写唯一run目录，CI显式收集该目录。新正式suite在现有CI作业内添加本地/controlled命令，不增加平台和必需检查名。多依赖live和人工评审为独立阶段，不在无密钥CI假装通过。

### D7. 报告契约与留存

实施复验补充：数据JSON/JSONL写入固定LF，避免Windows到Git/Linux转换使manifest文件摘要失效。评测CLI固定`PYTHONHASHSEED=20261031`，并记录实际种子；原生产BM25遍历set的浮点累加会导致极小分差下的跨进程顺序变化。只固定评测执行条件，不改生产算法，使用两个不同初始种子的独立CLI进程运行dev全组验证非计时输出一致。直接调用runner未控制种子时明确记录UNCONTROLLED，不宣称跨进程可复现。

原计划 `evaluation/runs/{date}-{commit}/` 调整为忽略目录 `var/evaluation/runs/{utc}-{sha}-{nonce}/`，避免原始输出混入提交或同日覆盖；README提供有选择发布脱敏证据到 `docs/testing/evidence/ai-evaluation-v1/` 的步骤。完整run包含：

- `manifest.json`：schema/run/dataset/gold/split/代码SHA及dirty摘要、算法配置/提示hash、组件请求与实际模式、模型ID/维度、索引/切块/语料摘要、机器/依赖版本、开始结束/预算、状态、退出码、资源清理结果。
- `cases.jsonl`：每例每实验每重复的caseId、适用任务、stage有序ID与分数、约束及业务快照摘要、合成推荐/引用/答案、source provenance、计时、错误/降级类型、标签版本、分子分母；对真实内容仅存摘要和受控引用，绝不记录完整prompt/凭据/下游异常正文。
- `metrics.json`：同profile/adapter/experiment/unit/stage/K/split下的宏平均、分项安全率、覆盖率、分母与失败；不做混环境总分。
- `review.jsonl`：人类对引用语义、解释合理性、泄漏的实际评审与版本；未完成保持PENDING，重算不用重新请求模型。
- `report.md`：下表结构、差异分析及失败case索引；CLI可完全从上述产物重建非计时指标。

报告固定结构：①结论和范围（PASS/PARTIAL/FAILED/NOT_RUN/DRAFT，哪些组件实际参与）；②版本/数据/人工复核/环境；③实验矩阵与不支持项；④质量；⑤约束/覆盖/安全；⑥耗时/错误/降级/调用量；⑦逐例失败与对比不确定性；⑧未验证/历史证据引用/复现与清理。

| experiment | profile/actual components | adapter | unit/stage/K | planned/scored/failed/notRun | numerator/denominator | value | review coverage | status |
|---|---|---|---|---|---|---|---|---|
| 待执行 | 明确各组件 | python或java-mysql | 如product/fused/20 | 不预填 | 不预填 | NOT_RUN | 待评 | NOT_RUN |

退出码：0=所选suite执行完整、适用安全/数学/数据门禁满足；1=执行/安全失败或请求live未完成；2=配置/数据错误。DRAFT可输出探索报告但正式验收命令返回2；未完成人工语义评审时自动suite可成功，报告overall仍PARTIAL且human-review状态PENDING，不据CLI=0宣称全业务通过。UNSUPPORTED实验显式选择时返回2；列出实验矩阵时可展示为N/A而非运行失败。

### D8. 与既有 SDD 的归属与追踪

| 需求/已有规范 | 本方案归属 | 后续实现需同步的原入口 |
|---|---|---|
| PRD FR-023、OPEN-08；FR-019～022关联 | 本capability只新增评测行为和证据要求 | `docs/TRACEABILITY.md` FR-023 更新新入口/实际范围；PRD不预填达标分数 |
| `docs/ai/evaluation-plan.md` §2～7 | 数据、指标、E0～E4映射与新报告契约在本方案细化 | 原文标记已接受后以本capability为评测行为基线，保留研究动机；纠正历史Qdrant/首Token适用范围 |
| `SDD-AI-RECALL-07.md` | 全目录召回、预算/数量/追问作为评测对象，不改变其业务规则 | 引用数据及新评测报告，不把计划写成通过 |
| `SDD-AI-HYBRID-08.md` | 真实商品Milvus、product→SKU映射、RRF与实时复验 | 明确知识Qdrant/商品Milvus区分，链接实验与验证边界；不覆盖历史状态 |
| `SDD-DDD-11.md` | RecommendationPolicy与领域/查询只读边界 | 采集与评分放测试/评测层，不迁移领域职责 |
| `SDD-REDIS-12.md`、`CODE-QUALITY-20261030.md` | 会话600秒租约、复权、索引attempt/容量与故障语义 | 安全回归复用现有验证入口，能力保持原归属 |
| `RELEASE-01.md`、`behavior-v1.1.md`、ADR-003 | Java交易裁决和ACL是gold规则来源 | 无对外API/数据库语义变化则不改生成契约；发现差异先记录缺陷，不静默重定义gold |

当前仅写change内delta，不写 `openspec/specs/` 主基线或改已接受SDD。审核接受并实施后，在归档时建立该评测能力基线，旧评测计划对应段落改为引用；既有导购业务不迁移为ADDED规范。无需为沿用ADR-003重复新增ADR。

## Risks / Trade-offs

- 合成语料代表性有限 → 报告准确样本量/分布，不推导真实校园用户泛化；将真实脱敏数据作为以后明确授权的新版本。
- 人工标注和语义评审耗时 → AI只能起草，未复核保持DRAFT/PENDING；代码自动验收与业务效果验收分阶段交付，不伪造“人工”标签。
- 发现规格/否定约束等现有缺陷 → 记录原始失败case，不削弱gold或在本变更顺便重写算法；额外修复需独立授权并用同一冻结集比较。
- 共享函数整理可能改变排序 → 最小内部接缝、原pytest与同输入快照等价验证；不引入生产可调评测开关。
- 真实供应商波动与超时 → 预设重复和预算、保存每次失败；降级单列，不选择最好一轮作为总体结果。
- 冻结数据后仍偷偷调参/换模型 → 比较前核对元数据，test使用变更留痕；任何版本变化必须重跑可比基线。
- 真实路径预算/安全连接未就绪 → live保持NOT_RUN；历史授权与旧报告均不作为新执行证据。

## Migration Plan

### 已授权补充：权限复验缓存时效性（2026-10-31）

真实隔离MySQL的5.3回归发现：生成期间撤稿已提交，NEVER长调用内的可读scope仍可能复用旧MyBatis会话缓存。用户已明确选择“一并修复并完成回归”。本次允许对`KnowledgeCaseImpl.readableScope`和`citationDocuments`采用REQUIRES_NEW短只读事务，使账号、成员权限、商户和知识事实在每次复权时重新装载；引用正文与其授权校验共用一个短事务，避免类内自调用绕过事务代理。方法返回后事务立即结束，远程召回/向量/生成仍须无实际数据库事务。

不改变权限规则、公开API、表结构、600秒租约或模型交易边界。保留原撤稿失败断言，补充生成期间knowledge.read撤销、引用拒绝、旧历史遮蔽、失败不落消息且释放租约，以及真实远程Port回调无实际事务断言。最终必须重新执行隔离MySQL/Maven与后续HTTP/Redis/浏览器；修复前失败证据保留，不用新结果覆盖旧轮次。

1. 审阅本方案，之后通过 apply 实施；先落数据/口径/离线runner，再完成Java真实安全适配；默认不连接现有业务服务。
2. 在现有CI作业内验证确定性、数据/指标、受控异常与真实隔离事务；仍使用原4个检查名，不降低必需门禁。
3. 人工完成gold复核后冻结首版；在单独授权与安全配置下执行真实Embedding/LLM/Milvus对照，未执行的矩阵保留NOT_RUN。预算只限制调用，不可削减已承诺案例后隐瞒覆盖率。
4. 同步原文档引用和报告，审核后按授权合并；不因OpenSpec状态完整自动合并或部署。
5. 回退时撤销评测入口/共享接缝/CI新增调用并保留历史证据；清理ownership清单中的临时资源。无需业务DDL或数据迁移，线上交易路径不依赖评测组件。
