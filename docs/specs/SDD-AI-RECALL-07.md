# SDD-07 · 校园智能导购商品召回与讯飞模型接入

> 2026-10-29。基线 v1.2.1。独立 Python 内部契约新增 `/v1/recall`；对外 Java HTTP 路由不变。这里区分已实现、已执行离线测试与真实 MySQL/模型待验收。

## 1. 缺陷与范围

原 Java `ShoppingAiCaseImpl.answer` 先读取最新 `100` 个商品，再截取 `300` 个 SKU，导致较老但语义相关的商品永远无法成为 AI 推荐候选。这不是普通分页错误，而是召回错误；只把 `100` 改成更大的固定值不能根治。

目标：在执行 LLM 推荐之前，以当前问题和安全的历史上下文确定召回词；从 **全部公开、商户有效、已上架且拥有 ACTIVE SKU 的商品** 中查询匹配商品，再取可信报价、可售量，由 Python BM25 与可选 LLM 排序，最后 Java 提案复核。消费者、商户和平台 REST 接口保持不变；不改变 Proposal 与购物车事务。

## 2. 当前实现流程

1. Java 校验登录身份、会话所有权，读取该用户最近 12 条安全历史消息及知识权限快照。
2. Java 经 `IAiEnginePort.recall(question, history)` 调用 **仅服务端访问**的 `POST /v1/recall`；Python 输出 `query` 和最多 8 个检索词。模型可补全指代、抽取品类/口味/属性，失败则本地规则提取中文二元词；对模型输出进行格式、字数、数字条件和字符白名单验证。
3. Java Domain Catalog 的 `recall(terms, 200)` 调用 MyBatis `ICatalogDao.recall`：对 `cat_product`、`mer_merchant`、`cat_category`、ACTIVE `cat_sku` 进行参数化关键词搜索；**MySQL 先匹配和排序，再 LIMIT**，按商品名/规格/描述/品类计分。没有关键词时展示最近 30 个公开商品作为宽泛需求的回退。
4. Java 按召回的商品相关性做 SKU 轮询抽样，最多 300 个不同 SKU，避免单商品 20 个规格占满全部候选。取 Catalog 当前报价及 Inventory 可售余额，并剔除无库存选项。
5. Java 发起原 `/v1/query`，新增 `retrievalQuery` 可选字段；Python 用它对候选 BM25 排序、对授权知识执行原 RAG，模型输出最多 3 个推荐。模型异常时返回本地推荐与显式降级状态。
6. Java 复核模型返回的 skuId 必须属于上面的可信候选、数量和库存满足条件；创建本人 PENDING Proposal。用户确认时 Java 再验证商户有效、SKU 现价/版本及库存，并用数据库事务写购物车；**LLM 永不触发自动交易**。

现阶段商品召回是 **MySQL 关键词过滤与加权排序 + Python BM25 候选重排**；它不是已经建成的商品 Qdrant 语义索引，也不使用线上用户行为个性化。文档知识库已有独立的 BM25/向量/RRF 检索能力，但不能误称商品侧也实现了向量混合召回。后续只有在真实 Recall@K 评测显示必要时，才增加商品向量索引与增量同步，避免两个商品事实源。

## 3. 内部契约

`POST /v1/recall` (X-Service-Key 仅 Java 服务持有):

```json
{"question":"预算20元，买两瓶无糖饮料","history":[{"role":"user","content":"我想喝乌龙茶"}]}
```

响应示例（示意，不是已执行的真实模型输出）：

```json
{"query":"预算20元，买两瓶无糖乌龙茶","terms":["无糖乌龙茶","无糖","乌龙茶","饮料"]}
```

`POST /v1/query` 原请求增加可选 `retrievalQuery`，仍有 `allowedDocumentIds` 服务端白名单与至多 300 个可信 SKU 候选。原有 Query 直接调用兼容，不要求修改消费者 HTTP。

## 4. 讯飞模型配置（凭据绝不入库）

项目已有 `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL` 三项环境变量，Java → Python 仍走内网。讯飞星辰 MaaS 的 OpenAI 兼容 base URL 为 `https://maas-api.cn-huabei-1.xf-yun.com/v2`，最终请求为 `/v2/chat/completions`，Bearer Key 必须只保存在服务端私有 `.env` 或密钥服务。模型 ID 请优先使用控制台已授权项；官方示例为 `spark-x2.6`。Spark 适配器不强制传入 `temperature` 或 `response_format=json_object`；提示词要求 JSON，兼容有时返回的 ```json 代码围栏。现有无模型与模型失败的本地降级行为保留。

建议：用户曾在对话中暴露过密钥，部署前轮换；不得将真实值粘贴进代码/文档、测试记录或 Git。

## 5. 安全、规模与限制

- 检索条件仅作为过滤词，不允许模型控制商户 ID、知识权限、SQL、售价或库存。MyBatis 使用 `#{term}` 参数绑定，词长 2–20、最多 8 项；拒绝包含百分号、引号、SQL 语法符号等非法词。
- 对一般数百至低千量级校园商品采用简单词面召回，仍需真实 MySQL `EXPLAIN`、延迟与召回率测量；`LOCATE` 在大表上不走常规 BTree 全文索引。若发展到十万级，另行制定倒排/向量索引与异步增量同步方案。
- 最多 200 个商品、300 个 SKU 是 **候选上限**而非对全量商品的预截断；命中超过 200 个时依 SQL 相关性排序裁剪。它不保证任意复杂语义问题 100% 召回。
- 无新表、无数据库迁移。知识文档 ACL/发布版本和现有多商户 RBAC 不变；不能用模型返回的解释作为商品合规证明。
- 真实讯飞模型、MySQL 索引和 HTTP 联调需要在具备网络、Maven 与 MySQL 的环境执行；本地不能访问讯飞 MaaS DNS 时必须标记 NOT_RUN。

## 6. 验收

- 至少 121 个已上架商品：目标商品在旧 `最新100` 之外，仍能凭标题或规格词召回。
- 过期/未发布商品或已停业商户不能进入候选，库存 0 不产生 Proposal，两个商户的公开商品允许一起推荐但不跨商户读取内部知识。
- 追问“换一个”可继承上轮品类；无模型时仍正常召回；模型失败显示降级状态；模型诱导提交任意 SKU/SQL 均被校验拒绝。
- Python 单测与静态契约、Java17 源码树检查实际运行；真实 MySQL/JUnit 和外部模型应在部署或 CI 执行，未运行不标 PASS。
