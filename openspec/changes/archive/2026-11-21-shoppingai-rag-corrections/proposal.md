# Proposal

## Why

ShoppingAI 已有实时交易防线，但范围歧义、属性否定、多轮换选与语义排名传递仍可能给出不符合需求的建议；引用合法性也不能代表 Gold 证据覆盖或回答事实支持。本次按用户授权完成批次 A+B，正式效果验收单独安排。

## What Changes

- 统一 Java/Python 的预算区间和模糊数量澄清；区分寻找商品、商品事实、知识问答、交易动作及混合请求。
- AI 候选协议接受可选的结构化 SKU 属性；当前 Catalog 尚未提供属性事实时不声称验证适用性。明确规格与商品名称分开识别，未知否定属性也需澄清。
- 使用同会话既有 Proposal 建立服务端多轮上下文，换选排除之前展示的 SKU，相对价格必须严格比较上一轮报价；Java 对模型返回再次验证。
- 按语义商品排名映射 SKU 排名，保留到 Python RRF，查询结果/ID 顺序不代替相关性。
- 验证引用对应不可变文档版本、确定性 chunk ID 与片段位置；知识回答仅显示可验证相关证据，Python 内部响应也隐藏不可公开片段。
- 将合法引用率、Gold 证据覆盖、回答逐断言支持率分开。评分器升级，原数据/Gold/历史报告不修改；同一冻结数据比较词面、语义、混合路径。

## Capabilities

### New Capabilities

- `shopping-ai-refinement`: 新增结构化事实约束、显式多轮改选与相对价格行为，扩展 SDD-07/08；已有交易/召回基线仍由 SDD 维护。
- `knowledge-evidence-integrity`: 新增分块定位和相关证据输出规则，扩展已有知识授权基线。
- `evaluation-evidence-coverage`: 新增真正的 Gold 证据覆盖与独立支持率口径；既有评测变更和未完成人审保持原状。

### Modified Capabilities

无已建立的 OpenSpec 主能力基线。本次增量仅维护新增行为，不批量迁移既有 SDD。

## Impact

影响 ShoppingAI 的 Domain/Case/适配器、商品 DTO、Python query/检索/评测与契约；本批次不修改 Catalog/MySQL 业务表，也不新增业务迁移。无新外部依赖，模型没有交易写权限；长调用仍在事务外，消息/提案/租约在既有短事务完成。

验收：双语言共享用例、真实隔离 MySQL/HTTP/浏览器、完整 CI；有匹配时仍推荐，含糊或缺可信属性时澄清，禁止项不进入提案；无伪造 chunk、内部正文或错误覆盖率。
