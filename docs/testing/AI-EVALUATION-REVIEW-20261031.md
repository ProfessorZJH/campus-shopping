# PR #13 评测器审查收口（scorerVersion=2）

状态：两个评测器P1已修复，Python全套125项通过；**当前业务评测仍FAILED/退出1，PR不适合合并**。用户明确要求本轮只修评测器，保留已发现失败，生产导购规格过滤另行修复：[issue #14](https://github.com/ProfessorZJH/campus-shopping/issues/14)。不得为CI绿色缩减用例、修改gold、吞掉退出码或绕过门禁。

OpenSpec当前21/25：2.1/2.2已完成修复回归；6.5完整验收重开，受业务硬门禁失败阻断。7.1人工gold、7.2真实供应商实验、7.3人工语义评审继续未完成。没有归档、合并PR或调整分支依赖，PR仍基于#12。

## P1：失败且无阶段时的分母

适用阶段由任务和适配器确定：知识K实验计算chunk/document，真实Java/MySQL P实验计算product.fused/SKU池，R实验计算推荐。异常返回FAILED、stages={}也生成适用指标；有gold按0进入宏平均和配对差值，无gold仍N/A，NOT_RUN单独记录。Python未执行的Java商品召回不被伪造为0分。

回归包含K-B/K-D/K-H、P-L/P-D/P-H、R-RULE/R-LLM的空阶段失败，以及实际runner接缝抛超时异常。验证planned/scored/failed/notRun、逐例分母、分类与执行状态分表和配对样本覆盖。受控指标夹具中成功Recall@5=1、失败=0、未运行=N/A，planned=3、scored=2、宏平均=0.5；配对成功→失败差值=-1。[分母证据](evidence/ai-evaluation-review-20261031/empty-stage-denominator.json)

## P1：硬约束与引用门禁

runner与离线重算复用同一判定，覆盖所有constraint.*、constraintPass、citationValidity、unauthorizedDisclosure。数量、整组预算、库存、发布/经营状态、商户范围、明确属性/否定、重复SKU及无效/越权/撤回文档引用均触发非零退出，报告FAILED并列出具体指标。普通非sensitive案例也检查引用和禁止事实泄漏。

空推荐/空引用的项约束N/A不误记安全违规，相关性和覆盖率不足仍是质量结果；未完成人工语义不被伪判。回归注入恶意推荐、未授权/撤回/错误chunk引用和非sensitive禁止事实，检查runner及离线重算均退出1。旧manifest即使错误标exit0，重算仍按原始结果重新阻断；输入不支持实验的退出2优先级保留。

评分器由1升2；旧报告保留原貌，v2拒绝无声重算v1报告，跨scorerVersion配对拒绝。历史CI绿色不能替代修复后门禁。

## 真实检出的既有导购缺陷

固定数据与gold未修改。dev的case-041～044明确要求“标准装，不要家庭装”，生产R-RULE仍推荐家庭装；scorer2正确报告constraint.attributes/constraintPass失败，退出1。smoke中case-041亦失败；受控LLM重复的违规分别保留，不合成真实LLM效果结论。[原始合成失败摘录](evidence/ai-evaluation-review-20261031/known-hard-violations.json)

生产app/engine.py与Java权限/交易实现本轮均未修改。后续issue #14须在真实导购链路处理明确规格/否定，不能由评测器代替过滤、读取gold控制生产或以全部空回答掩盖覆盖率。

## 实际验证与范围

- 在ai-service执行`python -m pytest -q`：125通过，1条既有python_multipart弃用警告。[执行摘要](evidence/ai-evaluation-review-20261031/python-tests.json)
- local dev全组：218行，4例硬违规，退出1/FAILED。
- local smoke：case-041违规，退出1/FAILED；受控R-RULE/R-LLM smoke共4条违规（1+3次重复），退出1/FAILED。
- 离线重算local dev仍退出1；前序round7的Java结果以scorer2导入并重算退出0（60行），仅为历史执行结果再评分，本轮未重新启动Java/MySQL。
- 全部数据仍DRAFT，人工复核和真实Embedding/LLM/Milvus本轮NOT_RUN。合成夹具与受控替身不计真实依赖效果。
- 第一轮新增测试有6条夹具断言失败：误用没有知识gold的case-001，期望0而实际应N/A；已改用既有知识gold完整的case-071，未修改gold或放宽指标断言。最终125项全套通过。
- 必需CI按当前HEAD重新执行；业务评测应因保留的规格违规失败，不能宣称四项全绿。实际远端结果以[PR #13 checks](https://github.com/ProfessorZJH/campus-shopping/pull/13/checks)和PR描述中的HEAD/运行链接核对。
- 本轮仅评测代码、测试和文档变化，不重跑本地Java/MySQL全套；前序真实权限/事务验证保留在[历史报告](AI-EVALUATION-20261031.md)，远端必需CI仍保留Maven/MySQL/HTTP/浏览器/镜像命令。
