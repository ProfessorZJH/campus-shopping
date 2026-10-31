# Issue #14：导购SKU规格过滤与完整CI复验

状态：生产规格/否定过滤已修复，本地Python152项、真实Uvicorn HTTP10项通过；同一120例DRAFT数据的本地与受控实验均退出0/PARTIAL。新提交远端完整CI尚待执行，以PR #13最新HEAD检查为准。没有合并PR、部署或操作业务库。

## 业务目标与范围

修复[Issue #14](https://github.com/ProfessorZJH/campus-shopping/issues/14)：“要标准装，不要家庭装”仍收到家庭装。规则归[SDD-07第7节](../specs/SDD-AI-RECALL-07.md)，与PRD FR-019/020的偏好与推荐对应；FR-023评测仍由[OpenSpec评测规格](../../openspec/changes/evaluate-shopping-retrieval-recommendations/specs/shopping-ai-evaluation/spec.md)拥有。前轮四例FAILED及scorer2门禁证据保留在[审查报告](AI-EVALUATION-REVIEW-20261031.md)，没有改Gold、语料、划分或评分器。

`app/sku_constraints.py`只从用户原文、最近用户历史和可信offers.specKey提取有界字面要求，支持包装/颜色/数字单位与常见规格分隔值。未知或冲突要求澄清；不以描述/模型改写作为规格事实。过滤发生在BM25/语义排序和前12候选之前，本地与LLM结果复验共用规则。规格请求中模型返回候选外SKU时丢弃建议与解释，显式降级为安全本地推荐。指代继承与同类改选有独立回归，正常新话题不继承；无约束请求继续原排序。

没有增加依赖、API字段或DDL。Java/MySQL价格、库存、商户经营资格与权限复验不变，知识白名单、600秒租约和提案确认交易边界不变。本轮默认不调用真实Embedding/LLM/Milvus、不访问现有业务库或替换运行服务。

## 实际本地验证

| 命令/范围 | 结果 |
|---|---|
| `cd ai-service; python -m pytest -q --tb=short` | 152通过，1条既有python_multipart弃用警告，23.59秒；新增27项规格回归 |
| `python scripts/smoke-ai-local.py --output var/evaluation/issue14-http-local.json` | 真实Uvicorn子进程/TCP/SQLite10项通过，含规格压过语义排序和冲突澄清；子进程已停止 |
| local dev：K-B/K-D/K-H/K-D-R/K-H-R/R-RULE | 48例、218执行行，退出0/PARTIAL |
| local test：同上 | 72例、327执行行，退出0/PARTIAL |
| controlled dev：K-B/K-D/K-H/R-RULE/R-LLM | 48例、294执行行，退出0/PARTIAL |
| controlled test：同上 | 72例、441执行行，退出0/PARTIAL |
| 四份报告离线重算 | 指标与原报告完全一致，退出码仍0；无额外供应商调用 |

原case-041～044和剩余case-045～050全部复验，规格指标与有效推荐覆盖率均为1，返回非空符合规格SKU。R-LLM每例三次重复全部保留，来源明确STUB，不代表真实模型推荐效果。正常规格、无规格、未知规格、冲突、指代继承/改选、预算/数量/库存、恶意及失败模型均有回归。

这次也运行了test划分作为探索回归；不能随后宣称该划分从未看过，正式基线仍需人工复核与重新确认冻结范围。

[四份运行摘要与逐例规格结果](evidence/ai-sku-constraints-20261031/runs.json) · [Python结果](evidence/ai-sku-constraints-20261031/python-tests.json) · [真实HTTP证据](evidence/ai-sku-constraints-20261031/http-local.json)

## 原始失败与修正

- 新规格测试首次因夹具共享密钥不足24字符导致22个setup错误，既有48项通过；修正测试密钥长度，没有削弱生产配置校验。
- 首次全套144通过/3失败：两个新增固定排名断言误以为只有两个标准装候选，实际Top3还有合法标准装；改为精确核对三个SKU并同时检查属性与覆盖率。另一个既有来源断言发现生产把商品名“考试黑色签字笔”截成未知颜色规格，已修正提取边界并增加正常商品名回归，保留原来源断言。
- 下一轮147通过/1失败：新测试误以为明确数量的旧规则会返回多项；改为核对非空且数量=2，保留原“明确数量至多一项”的生产行为。最终152通过。
- 文档校验首次在新报告写入前发现引用缺失；补齐报告后重验。前轮业务四例失败、坏返回仍必须失败的评测器测试均保留。

## 交付边界与后续

OpenSpec当前21/25，6.5等待最终完整CI；7.1人工Gold、7.2真实供应商实验、7.3人工语义复核仍PENDING/NOT_RUN。不要求三项全部完成才交付基础设施，但不得宣称FR-023正式业务效果通过或归档。

PR #13仍依赖PR #12，当前均不合并。先核对新HEAD四项必需检查、主作业中的HTTP/Redis/真实后端浏览器步骤，再独立收口#12并按授权安排主线整合。回退本修复会恢复规格缺陷并由未削弱的scorer2门禁阻断；不得通过撤回门禁来合并。
