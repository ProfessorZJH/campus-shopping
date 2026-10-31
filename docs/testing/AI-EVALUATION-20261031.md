# FR-023 智能导购评测实施与验证

当前状态：PR #13审查后评分器已升至v2，修复失败分母和硬约束门禁。门禁正确检出4例既有规格违规，当前业务评测为FAILED/退出1，不能沿用旧版本CI绿色判定可合并；详见[本轮审查收口](AI-EVALUATION-REVIEW-20261031.md)。OpenSpec已重开6.5验收任务，当前21/25，另三项人工/真实依赖验收继续未完成。

以下保留scorer1及提交c6312be/cb65101阶段的历史实现、测试与CI证据，不能作为scorer2门禁已通过的证明。120例标签仍为AI_ASSISTED/DRAFT，人工gold、真实Embedding/LLM/Milvus和回答语义均未完成；变更保持草稿且未归档。

## 范围

新增版本化合成数据、指标评分、本地/受控/显式live执行器、逐例来源与预算、离线重算、Java/MySQL阶段采集和安全场景。生产增加私有Python阶段观察接缝，并按用户补充授权修复Java权限复验的读取时效性；未改变默认排序、Java交易与权限规则、600秒租约或公开API，无DDL迁移。

入口：[操作、公式、实验与复现](../../ai-service/evaluation/README.md)、[数据与人工标注](../../ai-service/evaluation/datasets/campus-shopping-v1/README.md)、[本次规格/任务](../../openspec/changes/evaluate-shopping-retrieval-recommendations/tasks.md)。原SDD-07/08继续管理导购业务；本次OpenSpec只管理评测行为，未归档为主规格。

## 原始失败与定位

| 隔离Maven轮次 | 结果 | 定位与处理 |
|---|---|---|
| 1 | 195项，1失败、1错误、0跳过 | 夹具用户名含非法连字符，已修正；另有撤稿失败 |
| 2 | 195项，1失败、1错误、0跳过 | 夹具order_id超过36字符，已修正；撤稿仍失败 |
| 3 | 195项，1失败、1错误、0跳过 | 平台内部知识夹具错误携带merchantId，数据及验证器已修正；撤稿仍失败 |
| 4 | 195项，1失败、0错误、0跳过 | 仅剩生成期间撤稿后的复权失败；Java P系列60行采集成功 |
| 5 | 195项，2失败、0错误、0跳过 | scope新鲜度断言通过；新增撤稿/撤权断言误将AI0005当作知识未就绪，正确码为AI0003，已按既有码表修正 |
| 6 | 195项，0失败、0错误、0跳过 | 权限与事务回归通过；10份安全场景导出全部通过；随后继续HTTP/Redis/浏览器验收 |
| 7 | 195项，0失败、0错误、0跳过 | 最终LF数据版本：HTTP173、严格响应117、双实例Redis9、真实浏览器8全部通过；临时库已清理，实际已测源码摘要与当前Java/Python生产源码一致 |

各轮原始汇总保存在本报告证据目录，完整日志路径由忽略目录`var/evaluation/verification*/`的验证输出记录。未删除测试、跳过断言或修改gold以换取绿色。

撤稿复现：真实知识Case发布文档，第一次导购成功；第二次生成的模型替身回调调用真实撤稿。JDBC读回确认`ai_document.status=WITHDRAWN`，但同次长调用内的`knowledge.readableScope`仍返回该文档，断言失败。NEVER长调用的空事务同步使MyBatis会话缓存跨查询留存；用户明确授权后，`readableScope`与`citationDocuments`改用REQUIRES_NEW短只读事务。引用读取方法也设置事务边界，保证其类内scope自调用在同一新事务中复权。每次重新装载事实，返回后结束事务，不持事务跨远程调用。

第五轮确认原先的撤稿scope断言已通过，但测试预期错误码写错；按[既有错误码](../api/error-codes.md)更正为`KNOWLEDGE_NOT_READY=AI0003`，没有改变生产错误码或放宽为“任意错误即可”。第六轮撤稿/生成期间knowledge.read撤销均拒绝响应，旧历史隐藏，不新增消息且租约释放；召回、向量检索和生成Port回调均断言无实际数据库事务。

评分器加入安全门禁时，回归发现用户输入的canary在rewrittenQuery中被误计为泄漏；现只检查实际回答、引用、推荐解释与返回历史，增加“输入回显不等于内部资料泄漏”的测试，同时保留回答中canary命中断言。

跨进程dev重复还发现case-071的BM25浮点累加受set哈希顺序影响，候选/推荐顺序不一致。评测CLI现固定PYTHONHASHSEED=20261031，记录实际种子，生产排序算法保持原样。新增两个不同初始种子的独立CLI进程对比完整dev非计时输出，通过后才作为最终可复现版本；之前未固定种子的run仍按原始元数据保留。数据输出另固定LF，Git暂存区7个数据文件的字节摘要均与manifest一致。

## 实际验证

| 检查 | 本轮实际结果 | 范围 |
|---|---|---|
| Python全套 | 95通过，1条既有依赖弃用警告 | 包含指标、来源、跨进程dev确定性、重算、Java导入离线及人工标注防覆盖回归；不是正式效果基线 |
| 真实Uvicorn本机TCP | 8项通过 | 本地检索，不是Spring/MySQL HTTP联调 |
| 第七轮隔离MySQL/Maven | 195项全部通过、0错误、0跳过 | 最终LF数据版本，修复后的撤稿与生成期间撤权；本机Redis使用隔离namespace |
| Java商品召回采集 | 60行完成 | 12smoke×5种P实验；真实Case/MySQL，语义ID和模型为明确替身 |
| 独立安全证据 | 提案8/8；ACL 2/2 | 第七轮真实Java/MySQL读回，模型为明确替身 |
| 本地dev / controlled smoke | 218 / 84行，退出0，整体PARTIAL | 全部DRAFT、人工PENDING，不宣称真实模型质量 |
| Java结果离线汇总 | 60行，整体PARTIAL | 第七轮含inputMeta，模型/资源来源据实记录；没有Java计时则N/A；旧导出的缺失元数据仍NOT_CAPTURED |
| 真实Java/FastAPI HTTP | 173项、严格响应117份通过 | 全新隔离MySQL；本地检索 |
| 双Java实例+本机Redis HTTP | 9项通过 | 会话、配额与隔离namespace；没有FLUSH |
| 真实浏览器 | 8项通过 | 连接本轮隔离Java/MySQL，未使用API替身 |
| 本轮远端CI | 四个必需检查全部通过 | 实现提交c6312be；Maven/MySQL/FastAPI/浏览器、两套Chromium契约、实际交付镜像与隔离Compose链路通过；外部AI作业SKIPPED |
| 本机Docker、生产、性能 | NOT_RUN | 没有自动合并或部署 |
| 真实Embedding / LLM / Milvus | NOT_RUN | 未读取私有供应商配置、未继承历史调用授权 |

命令：在`ai-service/`执行`python -m pytest -q`；在根目录执行`python -X utf8 scripts/smoke-ai-local.py --output var/evaluation/ai-http-after-permission-fix.json`。隔离Maven命令见工具README，最终输出为`var/evaluation/verification-round7/mysql.json`。所有MySQL执行均创建临时实例并清理，不访问既有业务库、不替换服务；Redis禁止FLUSH，不启动Docker Redis。

数据规模240商品、360SKU、24知识版本、120例（12类各10；48dev/72test；12smoke），全部AI_ASSISTED/DRAFT。生成器现固定LF，防止Windows生成摘要在Git规范化或Linux检出后失效；重生草稿的manifest文件摘要相应变化，旧run保留自己的datasetHash，不能跨版本配对。当前人工复核包在本机忽略目录`var/evaluation/review-lf/campus-shopping-v1.html`，不由AI代填复核身份；导出拒绝覆盖已有人工标注。

格式检查、API生成契约与58条schema检查、源码/DDD检查、OpenSpec严格校验已执行通过；这些不代替真实业务验收。历史测试JSON保持原样。合成证据见[运行汇总](evidence/ai-evaluation-v1/runs-summary.json)、[逐例样本](evidence/ai-evaluation-v1/case-examples.jsonl)、[第四轮MySQL](evidence/ai-evaluation-v1/verification-round4-mysql.json)、[安全汇总](evidence/ai-evaluation-v1/safety-summary.json)、[本地HTTP](evidence/ai-evaluation-v1/python-http.json)。运行汇总保留各次code/sourceHash，较早结果不冒充后续代码版本的重验。

最终本地证据：[第七轮隔离验收](evidence/ai-evaluation-v1/verification-round7-mysql.json)、[Python95项](evidence/ai-evaluation-v1/python-tests.json)。远端实现提交验收：[Actions运行41177820251](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41177820251)、[四项检查快照](evidence/ai-evaluation-v1/github-ci.json)。本机Docker仍未执行；GitHub runner执行的镜像/Compose验收独立记录，不能据此宣称本机Docker可用或生产通过。

## 未验证与后续人工工作

- 任务5.3已完成：生成期间撤稿、撤权与旧历史遮蔽的真实MySQL回归通过，保留原失败记录。
- 任务6.5已完成：最终本地Python、隔离Java/MySQL、HTTP/Redis/浏览器及实现提交对应远端四项必需CI已通过。
- 任务7.1：人类逐例核对完整相关集、证据位置、需求约束和争议后才能冻结ACCEPTED；现有120例全部DRAFT。
- 任务7.2：真实Embedding、真实LLM三次配对及真实临时Milvus对照须本次明确授权、私有安全环境和请求预算；当前NOT_RUN。
- 任务7.3：引用来源有效性不等于语义支撑；回答断言、解释及语义泄漏待实际人工评审，正式报告尚未形成。
- 独立reranker不支持，首Token为N/A；本轮不提供生产性能或泛化保证，不自动合并或部署。
