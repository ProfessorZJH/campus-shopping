# SDD-08 · NVIDIA Embedding + Milvus 商品混合召回：验证记录

- **日期**：2026-10-29
- **来源**：在 v1.2.2 完整 ZIP 的独立副本上实施；无用户电脑上的仓库写入、无生产部署、无迁移、无用户 Milvus 集合删除或修改。
- **状态**：源码集成候选，离线测试通过；**真实外部模型、Milvus、MySQL/Spring 端到端未验证**。

## 已实际执行

| 命令或检查 | 结果 | 验证边界 |
| --- | --- | --- |
| `cd ai-service && python -m pytest -q tests` | **40 passed** | 包含新增 8 项针对 NVIDIA 调用格式、Milvus 幂等/模型维度、HTTP 鉴权、语义召回、预算/库存、明文 HTTP 禁止等；Milvus 为内存替身 |
| `python scripts/smoke-ai-local.py` | **8 项通过** | 实际本地 Uvicorn HTTP，未调用外部供应商 |
| `python frontend/tests/ui_three_pages.py` | **23 项通过** | Chromium + Vue，API 替身，非真实 Spring/MySQL |
| `python scripts/verify-domain.py` | **56 项通过** | 真实 JDK 纯领域规则测试，未加载 Spring/MySQL |
| `python scripts/verify-http-body.py` | **6 项通过** | 真实 JDK HTTP 边界测试 |
| `python scripts/verify-api-contract.py` | **93 条消费者 HTTP 路由一致** | HTTP 静态契约；Python 内网新增两个路由 |
| `python scripts/verify-release.py` | **265 个 Java 源文件静态源码检查** | 非 Maven 编译；另检查 DDD 实现、9 个 MyBatis Mapper、文档链接 |

## 新增源码验证点

1. **双路召回**：Java Catalog SQL 关键词与 Python Milvus 语义搜索独立返回，并在 Java Case 用 RRF(k=60) 融合；最终 SKU/库存与授权仍由 MySQL/Java 提供。
2. **有条件同步**：`ProductVectorSyncJob` 默认关闭、每批 40 商品；Python 指纹一致跳过重复 Embedding；模型与向量维度冲突必须拒绝，不能静默覆写。
3. **Embedding API**：验证 NVIDIA 请求包含 `input_type=passage` 或 `query`、模型 ID、Bearer token，但全部使用测试密钥和 `httpx.MockTransport`。
4. **语义推荐**：SKU 即使与 Query 词面不重合，只要 Java 后端确认为语义候选，也可进入 Python 12 个候选；不可售/超预算仍被过滤。
5. **安全**：Milvus 配置缺失不假装启用；HTTPS 或私网地址才允许访问，公网明文 HTTP 拒绝配置；不在向量库保存真实价格、库存、订单与隐私数据；使用公开 SKU ID 前必须再走 Java SQL。
6. **额外 MySQL JUnit 用例**：`CommerceMySqlIntegrationTest.semanticRecallMustRevalidateCurrentCatalogPublicationAndMerchantStatus` 已写入源码，待有专用 MySQL 测试库与 Maven 时执行。

## 明确未执行

- `mvn clean verify`、Java/MySQL 事务、容器 Compose 全栈联调：本会话执行环境无 Maven、MySQL、Docker。
- NVIDIA/NIM 真实 Embedding、讯飞 MaaS 真实聊天、远端 Milvus 登录/创建集合/检索：容器中三个服务域名 DNS 解析均失败，未请求带有用户密钥的 API、也未使用 root 密码连接公网明文地址。
- `python -m app.smoke_vector` 线上检查：新增只读脚本，可在已连接安全 Milvus 的部署机上运行；当前无真实连接，标记 NOT_RUN。
- 真实商品数据 Recall@K、NDCG、延迟、索引时效和费用测试：未提供线上真实数据集，不能声称精度提升。

## 启用前必须处理的安全条件

用户提供的 Milvus 公网连接示例采用 `http://` 和 root 凭据。**即使密码验证成功，也不能证明链路经过加密。** 首先配置 Milvus 侧 TLS、VPN/SSH 隧道或同一私有 Docker 网络，另建最小权限应用账号，再将新凭据写入服务器私有 `.env`。本工程校验会拒绝使用公网明文 HTTP Milvus 地址。

建议使用 NVIDIA 提供的中文兼容 `nvidia/nemotron-3.5-embed-1b`，而不是弃用的英文侧旧模型；讯飞模型请使用用户控制台真正开通的 ID。服务端配置 NVIDIA 与讯飞密钥时只使用私有环境变量。已在对话中出现的所有密钥和密码建议轮换。

## 后续验收建议（在用户服务器执行）

1. 先生成安全的 Milvus 访问路径和独立低权限账号，配置 `MILVUS_URI/MILVUS_TOKEN`，同时提供 `EMBEDDING_BASE_URL/MODEL/API_KEY` 和 `LLM_BASE_URL/MODEL/API_KEY`，**不要把凭据提交 Git**。
2. 在 ai 容器中执行 `python -m app.smoke_vector`，检查真实模型维度与 Milvus 集合可用性；再开启 `AI_PRODUCT_VECTOR_SYNC_ENABLED=true` 并重启 Java app，检查索引是否建立并重试幂等。
3. 用至少 121 个商品验证语义召回已在最新100以外的老商品，测试停售、商户冻结、库存零和改价后确认拒绝，测量 P95 响应与 Token 费用。
4. 运行 `mvn clean verify`、MySQL 专用集成测试和 `python scripts/smoke-full.py`，拿到真实失败/通过证据再宣布完成验收。
