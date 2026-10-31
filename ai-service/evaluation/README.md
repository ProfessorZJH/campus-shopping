# 智能导购评测工具

范围与行为以 [OpenSpec变更](../../openspec/changes/evaluate-shopping-retrieval-recommendations/specs/shopping-ai-evaluation/spec.md) 为准。复用生产 KnowledgeStore、engine、ProductIndex 和 Java RecommendationPolicy，不提供交易写接口。数据目前为 **DRAFT，120例均待人工复核**；执行成功不等于正式业务效果通过。

当前评分器为v2，修复异常案例漏出分母和硬约束门禁。门禁曾检出case-041～044规格违规，原始FAILED证据保留在[审查收口](../../docs/testing/AI-EVALUATION-REVIEW-20261031.md)。经补充授权，生产规格/否定过滤已按[SDD-07第7节](../../docs/specs/SDD-AI-RECALL-07.md)修复；同一冻结120例的本地/受控执行退出0，报告仍PARTIAL。最新测试/CI与未验证事项见[Issue #14修复报告](../../docs/testing/AI-SKU-CONSTRAINTS-20261031.md)，不能以历史CI或DRAFT执行成功替代正式业务效果验收。

## 运行

从仓库根目录运行（Python 3.11，使用现有requirements-dev.lock）：

```powershell
python ai-service/evaluate.py
python ai-service/evaluate.py --dataset campus-shopping-v1 --split dev --profile local --experiments K-B,K-D,K-H,K-D-R,K-H-R,R-RULE
python ai-service/evaluate.py --dataset campus-shopping-v1 --split smoke --profile controlled --experiments K-B,K-D,K-H,R-RULE,R-LLM
python ai-service/evaluate.py --recompute var/evaluation/runs/<run-id>
```

无参数运行旧8例演示，但写唯一目录的legacy-demo.json，旧的已提交JSON不会被覆盖。显式 `--output-dir` 必须不存在，防止覆盖证据。`--formal` 要求ACCEPTED数据及完整实际人工评审，否则退出2。退出0表示自动suite执行完整且无硬规则违规；退出1表示执行/安全失败、降级或计划组件未运行；退出2表示输入错误/不支持的实验。DRAFT未发生硬违规时整体PARTIAL，硬违规时FAILED；人工语义评审不能由CLI自动转为通过。

`local/controlled` 不加载.env，显式构造配置并阻断外部socket连接。controlled用生产Provider+MockTransport；原商品索引测试共用的FakeEmbedding/FakeMilvus在stubs.py。它们声称LLM/MILVUS也始终为STUB。

CLI会在`PYTHONHASHSEED=20261031`的子进程中运行，并在manifest.configuration记录实际种子。现有生产BM25对set逐项累加浮点数，未固定种子时可能改变极小分差下的并列顺序；评测固定执行条件，不改生产排序算法。直接在Python进程调用runner时，未设置种子明确记UNCONTROLLED，不能据此承诺跨进程排名一致。数据文件统一LF，文件摘要与Git规范化后字节一致。

## Java/MySQL

复用已有隔离启动器，默认自动准备12条smoke的受控P系列输入，创建临时MySQL、端口、构建目录，使用本机Redis的测试namespace：

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:REDIS_TEST_ADDRESS='redis://127.0.0.1:6379'
python scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke --output var/evaluation/verification/mysql.json --artifact-dir var/evaluation/verified-build
python ai-service/evaluate.py --dataset campus-shopping-v1 --split smoke --profile controlled --adapter java-mysql --experiments P-L,P-D,P-H,P-H-R,P-TERMS --java-results var/evaluation/verification/evaluation-java.json
```

ShoppingEvaluationMySqlTest装饰实际Catalog/Port，执行真实Case、SQL词面召回、recallByIds复验、sampleSkus和ACL；融合trace由同一RecommendationPolicy对实际输入派生。模型回答使用明确替身且不推荐商品，不能算Java生成质量实验。Java质量仅在P系列报告；Python注入offers时不生成product.fused或sku.pool指标，不冒充Java全目录召回。逻辑ID→实际ID映射保留；Java UUID作为生产并列排序规则的一部分，跨全新数据库排名差异须结合映射解释。

`--java-results`只离线导入已有执行结果，不读取供应商配置或重新创建索引；导入进程预热和供应商请求均为0，原执行调用见输入计划。未采集Java耗时则latencyMs=N/A；旧导出未携带inputMeta时，模型及资源清理标为NOT_CAPTURED，不能补推为已验证。

240商品/360 SKU通过Case及所属领域仓储装载；库存初始化/补货/预占通过原领域能力；旧状态只能由测试作用域的商品聚合快照装载，不新增生产导入或debug接口。24知识版本与发布状态通过现有知识能力装载。服务端计算scope与预期逐例核对。安全文件包含真实购物车/库存/提案前后读回和实际错误码；不把模型替身当成真实模型泄漏效果。

自定义输入可先生成：

```powershell
python ai-service/evaluate.py --dataset campus-shopping-v1 --split dev --profile controlled --experiments P-L,P-D,P-H,P-H-R,P-TERMS --prepare-java-input var/evaluation/java-input.json
```

在已有**专用测试实例**的JUnit环境设置EVALUATION_INPUT_PATH、EVALUATION_OUTPUT_PATH、EVALUATION_SAFETY_OUTPUT；禁止指向业务库。隔离启动器支持 `--evaluation-input` 复用这份计划。CI仍在原4个检查内运行，不增加必需检查名。

## 实验与实际来源

| 实验 | 实际路径 | 主要变量 |
|---|---|---|
| K-B | KnowledgeStore sparse | BM25，跳过query embedding |
| K-D / K-H | 同一候选与阈值、dense / RRF(60) | local字符向量或真实embedding分表 |
| K-D-R / K-H-R | 当前query_rewrite | 规则/真实LLM分表，保存no-op |
| P-L / P-D / P-H | 真实Java/MySQL、词面 / 语义复验 / RRF | 语义来源STUB或REAL单独保存 |
| P-H-R | 固定P-H的terms，仅改变语义query | 当前recall_terms的上下文改写 |
| P-TERMS | 单列可选模型terms变化 | 不能归因于仅query改写 |
| R-RULE / R-LLM | 固定offers、query、semantic和授权证据 | 只切推荐/解释；LLM预设3次均保留 |
| SAFE | JUnit真实事务/ACL + 标明模型替身 | 撤权、撤稿、旧历史、陈旧确认、竞争、回滚 |
| E4 / reranker | UNSUPPORTED | 当前没有独立reranker |

旧E0→K-D、E1→K-D-R、E2→K-H、E3→K-H-R。知识向量库是SQLite（可选Qdrant不在本轮实验）；商品向量库才是Milvus。R-RULE的fixture候选上限300，不能把注入候选内排序当全语料召回。

真实实验须单独获得本次授权，再显式设置私有进程环境、`--allow-external --max-provider-requests <预算>`；工具不主动加载私有文件。每个HTTP batch和Milvus操作均计预算，超时不自动重试。例：

```powershell
python ai-service/evaluate.py --dataset campus-shopping-v1 --split test --profile real-embedding --experiments K-D,K-H --formal --allow-external --max-provider-requests 250
python ai-service/evaluate.py --dataset campus-shopping-v1 --split test --profile real-llm --experiments R-RULE,R-LLM --formal --allow-external --max-provider-requests 300
python ai-service/evaluate.py --dataset campus-shopping-v1 --split test --profile real-milvus --experiments P-L,P-D,P-H --prepare-java-input var/evaluation/live-java-input.json --formal --allow-external --max-provider-requests 500
```

最后一条产生供Java消费的输入，不能单靠Python计划宣称Java执行过。Milvus使用随机eval_集合并保留ownership/清理结果；绝不drop既有集合，不沿用历史明文例外。预算耗尽仍保留全部计划行；降级单列DEGRADED，不计正常live完成。配置和health不作真实执行证据；HTTP成功/失败与客户端来源分别采集。真实供应商未返回的费用/token为UNKNOWN，不估造。

## 指标与分母

去重后前K为H，全部grade>0相关集为R。Recall=|H∩R|/|R|；Hit=1[交集非空]；MRR=首个相关排名倒数。nDCG使用gain=2^grade−1、discount=log2(rank+1)，IDCG由同例完整gold降序计算。空gold为N/A，空返回而有gold为0；FAILED保留在适用分母并计0，NOT_RUN独立报告。每例计分后宏平均，保留逐例分子分母；不同profile/adapter不合成总分。

适用阶段由任务与适配器确定，FAILED且stages={}仍生成有gold阶段的0分；配对比较保留这些0分。缺gold仍N/A，NOT_RUN不计作执行失败，Python未跑Java召回不生成该阶段的伪分数。

知识chunk和document@1/3/5分开，文档按chunk首次出现去重。chunk标签只从qrels.evidence明确ordinal/hash映射UUID5，不把文档相关性传给所有块。商品product.fused@20/50；SKU pool仅报round-robin集合Recall@300；最终推荐按SKU@1/3。池内分母不替代全语料gold。

ConstraintPass按推荐项计算数量/库存/发布/商户/属性及否定约束；整组ΣpriceCent×quantity超预算使整组预算项失败。没有推荐则分母0=N/A，同时可行gold例的Coverage=0、RequestSuccess=0。Coverage还要求至少一项grade2且整组安全。请求成功还要求所需有效证据。拒绝/澄清用数据集语义要点进行自动初筛，完整语义仍待人工。

CitationValidity只检查授权/发布/版本定位及片段存在。CitationGrounded由人类逐断言判分；无reviewer/time则PENDING且value=null。canary/ID/标题/片段自动泄漏初筛与人工语义泄漏分开，没跑完的安全案例不能宣称零泄漏。

门禁覆盖全部constraint.*、constraintPass、citationValidity和unauthorizedDisclosure。任何适用硬约束低于1或泄漏大于0都返回1/FAILED；同时保留boundaryViolationDetails中的具体指标。无推荐/引用时的N/A不视作硬违规，但覆盖率和请求成功仍可能为0。普通非sensitive案例也检查越权引用与禁止事实。

延迟取perf_counter墙钟，预热2次不计质量/样本；nearest-rank取排序后ceil(p×n)项，空样本=N/A。错误数量独立留存；当前首Token=null，因为无SSE。不是生产压测结论。

## 报告与人工复核

每次在忽略目录var/evaluation/runs/下生成manifest.json、dataset-snapshot.json、cases.jsonl、metrics.json、review.jsonl、report.md。元数据包括源码/输入/prompt/索引hash、环境、版本、请求预算、实际组件、分母/错误和清理。review.jsonl提供PENDING行，实际人类填写reviewer、reviewedAt、assertions[{supported:bool,...}]及semanticLeak后再离线重算。评测程序不会编造人工身份。

```powershell
python ai-service/evaluate.py --dataset campus-shopping-v1 --export-review var/evaluation/new-review/campus-shopping-v1.html
python ai-service/evaluate.py --safety-results var/evaluation/verification/evaluation-safety
```

复核包包含120例、完整语料和DRAFT标注副本。实际完成回答评审时还须填写`reviewStatus=HUMAN_REVIEWED`；数据gold冻结与回答评审是两份独立记录。安全汇总若缺少测试导出会保留NOT_RUN并退出1；必须同时核查JUnit失败，缺文件不能证明测试没有执行或已经通过。

重算核对评分器版本、输入和原始输出摘要，重建逐例指标及Markdown；修改review无需重调模型。comparisons.paired要求可比元数据，先按case平均重复，再按family固定seed bootstrap1000次；区间仅探索。报告按queryType给分类宏平均。

v2不自动改写v1历史报告，跨评分器版本的直接配对会被拒绝。`--recompute`会重新执行相同硬门禁并返回保存结果的退出码；它不会把已失败的suite变成退出0。

发布只选择确认不含私有内容的合成证据到docs/testing/evidence/ai-evaluation-v1/。不要直接发布原始真实提示/凭据/外部异常。历史8例单gold命中率保持原样，不能将其1.0作为新基线。正式ACCEPTED及人工回答语义评审见数据README，本轮不能由自动测试替代。
