# SKU约束、模型文案与评测证据补强（2026-10-31）

## 目标与范围

针对未知规格被忽略、Java最终提案缺少规格复核、模型answer/reason与SKU冲突、Java评测导入缺失/重复、可选依赖元数据异常及CI成本/审批问题修复。基线为 `codex/shopping-ai-evaluation` 的 `c1f4711`；工作分支 `codex/sku-evaluation-defense`，独立工作区，不替换现有8091/8100服务，不读取业务库或调用真实模型。

不变量：SKU属性只认实时报价specKey；模型改写、描述和评测Gold不能放宽原文约束；价格/库存/权限及确认事务保留原有Java复验；不增加数据库迁移或公开HTTP字段。

## 最终行为与验收标准

- “要大杯签字笔/只要大杯/规格为磨砂/换成大杯/要蓝色/要500ml”在候选只有标准装和家庭装时必须澄清，不静默推荐其他规格。数量、商品名、“有哪些选项/不选其他商户”不误判为未知规格。确定性语法仍不保证解析任意自然语言逻辑。
- Java `SkuConstraintPolicy` 从原文和用户历史独立执行规格策略，`RecommendationPolicy.select` 最终筛选再验证；错误、降级或旧Python不能让错误规格进入Proposal。两端共用19条JSON行为样例，同时验证Java实际筛选。非购买领域不增加跨域依赖。
- 商品answer及reason用已校验报价生成模板，不再传递模型自由文案；即便SKU正确、模型写“建议家庭装”，用户也只看到合法规格。LLM模式表示排序调用成功，模板输出无需冒充调用失败；候选外SKU仍降级。Java也重建商品文案，防御旧服务返回不一致文本。无商品且无规格约束的知识问答维持原有授权资料路径。
- Java导出导入要求预期实验集合，拒绝重复caseId+experiment、缺失或额外case/experiment、未知状态及不完整覆盖；NOT_RUN也必须占据计划记录，不能漏出分母。CLI透传预期集合。
- 缺失pytest等distribution metadata记null，不产生PackageNotFoundError；增加实际CLI报告生成回归。

## 仓库与CI

期望ruleset改为至少1个人工审批，新增提交撤销过期审批。未虚构CODEOWNER名单。每个PR必跑Quick quality gates：格式/构建可复现/静态契约/确定性Java回归/完整Python测试。完整MySQL、Redis、HTTP、浏览器与镜像作业在main、北京时间每日03:00及手动运行；发布前仍需核对待发布提交完整验收。同步修改规则文件、检查名及治理文档。

本轮未更新远端GitHub ruleset、未推送或运行远端Actions；配置文件存在不代表远端已生效，应用时须同步规则和工作流并读回核验。Docker、真实外部模型、生产及性能为NOT_RUN。

原始运行产物继续存于忽略的var/，CI上传artifact保留7天；新增 `python -m evaluation.summary` 导出带SHA-256和最多10条失败样例的摘要。冻结数据集是可复现输入，保留版本管理；DRAFT仍为PARTIAL，正式模式仍拒绝未人工验收标签。历史runs-summary从686781字节压缩至207545字节，保留旧文件SHA-256、Git提交和路径，已验证可从Git恢复原字节。旧规格违规只代表其版本，不能证明当前代码仍失败。

## 实际验证

本轮汇总见 [摘要及哈希](evidence/sku-defense-20261031/summary.json)。

- Python全量pytest：164通过、0失败；协议替身明确不代表真实LLM。
- 全新临时MySQL + 本机Redis隔离命名空间执行 `scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd`，未触碰现有业务库；最终状态PASS，196项零失败零跳过、testedSourceMatchesCheckout=true，临时库已清理。
- 冻结120例在smoke/dev/test、本地及受控两种profile共6轮：本地617条、受控819条，均退出0、硬规则违规0，状态PARTIAL。R-LLM按计划重复3次，不能把结果行数当作独立案例数。
- Java/MySQL受控P系列smoke 60行导出经新增严格导入器复核成功；最终构建60行导出复核退出0、硬规则违规0，DRAFT仍PARTIAL。
- 真实Uvicorn HTTP 10项、纯领域56项及5000步库存序列、真实JDK HTTP正文/超时6项、UI可复现Node测试3项、格式/UI生成/DDL/API契约/源码与DDD检查通过。CI YAML语法、触发条件、必需检查名与审批配置一致性静态检查通过；未执行远端Actions或浏览器。

保留首次隔离运行：Maven BUILD SUCCESS，196项测试零失败零跳过，但构建期间测试文件格式发生变化，源码一致性检查正确拒绝（testedSourceMatchesCheckout=false）。按最终文件重新完整执行，不能将首轮写为最终验收通过。早期Python新增解析规则曾误识别“选项/其他商户”，已修复并重跑全量；另一次从仓库根运行pytest因模块路径失败，正式命令按ai-service工作目录执行。

本轮只证明列明的确定性规则与依赖集成，不是DRAFT人工验收、真实模型效果、容器或生产验收。原始产物路径和文件哈希列入摘要，历史报告保留对应版本事实。
