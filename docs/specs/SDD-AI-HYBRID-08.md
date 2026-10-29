# SDD-08 · 校园商城商品混合召回（MySQL 关键词 + NVIDIA Embedding + Milvus）

> 2026-10-29，基线 v1.2.2。**源码集成候选版；实际 NVIDIA、讯飞、Milvus、Java/MySQL 联调未完成**。本文不包含任何真实密钥。

## 目标与职责

商品召回以**全部公开商品**为搜索空间，不再依赖“最新 100 件”；同时引入语义向量召回，以覆盖“熬夜时不刺激的饮品”与实际 SKU 文案不完全相同的需求。不得将 Milvus 作为商品报价、库存或权限来源。

- Java `ShoppingAiCaseImpl`: 读取用户与历史、调用意图识别、关键词召回、可选语义召回，使用 RRF(k=60) 融合，最多取 200 件商品/300 SKU，之后通过 Catalog + Inventory 重新取可售事实。
- Python FastAPI: 通过 `Provider.embed(texts, input_type)` 调用 NVIDIA NIM Embedding（建索引必须 `passage`，查询必须 `query`）；通过 `ProductIndex` 对独立 Milvus 集合执行幂等更新和语义搜索。商品只存商品 ID、向量、模型名和文本指纹；不存实时价格、库存、订单或用户隐私。
- Python `/v1/query`: 采用 BM25 SKU 相关性和 Java 传入的 `semanticSkuIds` 进行 RRF 候选融合，语义命中的商品即使没有词面重合也可进入 12 件模型候选。Budget、quantity、available 始终是硬过滤条件。
- Java Proposal: 仍只接受可信 SKU，提交购物车时复核商户、价格版本、库存、身份；**模型不得执行交易**。

## 数据流

```text
消费者问题与历史
  Java 身份与知识 ACL → Python /v1/recall 提取查询词
            ├── Java MySQL Catalog.recall(terms)   [词面 Top200]
            └── Python /v1/products/search → Milvus [语义 Top80 IDs]
                Java Catalog.recallByIds → MySQL 复核公开、有效商户、ACTIVE SKU
                        ↓ RRF(60)，Top200 商品
                  Catalog.offers + Inventory.stocks，Top300 SKU
                        ↓
            Python /v1/query: BM25 + semanticSkuIds → 最多12候选
                   知识库 RAG + 讯飞 LLM JSON 推荐解释
                        ↓
              Java 校验 SKU/报价/库存 → Proposal → 用户确认加购
```

### 增量索引与故障恢复

由 opt-in `ProductVectorSyncJob` 周期扫描 Java 公共 Catalog（每批 40 件）。Java 仅发送商品 ID、名称、公开描述、品类与活动规格，未发布或被停用商户不会被同步。Python 根据文本 + embedding 模型生成 SHA-256 指纹，对 Milvus 已存在的同指纹行不重复调用 Embedding；更新后使用 upsert（不是新建重复数据）。不对未知第三方集合执行 drop/delete。

索引中旧的下架商品可能短期残留，但 `Catalog.recallByIds` 必须按**当前 MySQL 的 PUBLISHED/商户 ACTIVE/规格 ACTIVE**校验并剔除，绝不能因向量命中突破交易规则。索引同步失败时下一次调度重试；向量查询失败时 Java 降级为词面召回，不撤销已完成的事务。**启用商品索引同步时，Python `/v1/products/index` 的 `mode=DISABLED`、非法响应或处理数量与请求数量不符，都视为失败而不是成功；Job 只记录已扫描/成功提交数量和异常类型，不记录凭据、异常消息或商品详情。**该版本尚未增加 tombstone/全量清理，后续可在独立索引任务中处理，不得在不完整扫描后删除整个集合。

Spring 调度线程池不少于 2，避免慢向量索引占住订单到期扫描。默认 `AI_PRODUCT_VECTOR_SYNC_ENABLED=false`，安全配置验证后再明确启用。

### 安全和访问

`/v1/products/index` 与 `/v1/products/search` 仅 Java 内网通过 `X-Service-Key` 调用，FastAPI 对请求 Schema、尺寸、重复 ID、批量数量执行限制。前端不接受任意模型 URL 或 Milvus token。Milvus 只有公开商品文案向量，任何来自 Milvus 的 ID 都必须再由 MySQL 鉴权。

`MILVUS_URI` 与 `MILVUS_TOKEN` 使用环境变量。**禁止在公网裸 HTTP 上发送 root 密码**；只有 HTTPS 或通过 SSH/VPN/私有 Docker 网络的内部 HTTP 才被允许。生产应新建仅具有 `campus_products_v1` 所需操作权限的 Milvus 账号，并轮换已在聊天中暴露的所有密钥。

## Python 内部契约

```jsonc
// POST /v1/products/index (仅 Java 服务调用)
{"products":[{"productId":"p-001","merchantId":"m-001","title":"无糖乌龙茶","description":"乌龙茶","categoryCode":"drink","specs":["500ml"]}]}
// POST /v1/products/search
{"query":"晚上想喝不甜的茶","limit":80}
// 响应
{"productIds":["p-001"],"mode":"MILVUS"}
```

`/v1/query` 额外增加 `semanticSkuIds?: string[]`，最多 300 个。外部用户 HTTP 接口数不变。`EMBEDDING_BASE_URL=https://integrate.api.nvidia.com/v1`、`EMBEDDING_MODEL=nvidia/nemotron-3.5-embed-1b` 是**文档参考值而非本环境已验证的模型权限**；实际部署必须填写 NVIDIA 提供的当前模型 ID。`LLM_BASE_URL=https://maas-api.cn-huabei-1.xf-yun.com/v2` 与 `LLM_MODEL` 由讯飞控制台决定。密钥必须只填本地 .env / secrets，不得入 Git 或文档。

## 验收标准

1. 用 121 件商品验证第 121 件不因创建时间较早被截断；关键词不命中但语义命中时能进入候选；比较 TopK 召回率与延迟。
2. 已下架商品、停业商户、禁用规格和库存不足即使被 Milvus 命中也不能被推荐或加入购物车。
3. 同一批商品重复同步不重复生成向量；改商品名/规格只刷新对应向量，模型维度不一致明确拒绝。
4. Milvus / NVIDIA / LLM 失败可降级，且不延误订单扫描；禁止跨商户读取内部知识。
5. 使用真实 Maven/MySQL、容器运行、讯飞模型和 Milvus 在安全网络内完成全栈 E2E。当前环境未完成此项；静态通过不得替代真实联调。
