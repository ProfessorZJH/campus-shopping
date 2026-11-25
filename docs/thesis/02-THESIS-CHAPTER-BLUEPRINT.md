# 毕业论文全六章写作蓝图、核心公式与源码逐节映射表

本文档提供一份标准本科优秀毕业论文（约 2.2 万～3 万字）的**全六章三级目录结构、核心算法数学公式**，以及**每一节对应的仓库真实源码与设计文档路径**。写作时可直接按表索骥，确保论文表述与工程源码 100% 严丝合缝。

---

## 第 1 章 绪论（约 2,500～3,000 字）

- **1.1 研究背景与问题提出**
  - 校园多商户即时自提零售场景特征；生成式 AI 介入电商导购时的“商业事实幻觉、多租户知识越权、慢推理阻塞事务”三大矛盾。
- **1.2 国内外研究现状**
  - 1.2.1 高一致电商交易系统与领域驱动设计（DDD）研究现状
  - 1.2.2 检索增强生成（RAG）与稀疏—稠密混合检索研究现状
  - 1.2.3 大模型商业应用安全护栏与权限感知检索研究现状
- **1.3 主要研究内容与创新点**
  - 提炼三大创新/特色点：① 基于 Proposal 两阶段复验的“AI 建议—交易裁决”双栈隔离机制；② 面向全量目录的两级 RRF 混合商品召回与口语规格硬约束机制；③ 四重知识防泄漏（含 TOCTOU 三次权限指纹复核）与 600s 零数据库锁会话租约机制。
- **1.4 论文组织结构**
  - 简述第 1～6 章逻辑脉络。

---

## 第 2 章 相关理论与关键技术（约 3,000～3,500 字）

- **2.1 领域驱动设计（DDD）与六边形端口适配器架构**
  - 限界上下文（Bounded Context）、聚合根（Aggregate Root）、值对象（VO）、防腐层与依赖倒置原则（`API → Trigger → Case → Domain ← Infrastructure`）。
  - *参考仓库文档*：[JAVA-STYLE.md](../development/JAVA-STYLE.md)、[business-architecture.md](../architecture/business-architecture.md)、[context-map.md](../architecture/context-map.md)。
- **2.2 稀疏词法检索与稠密向量混合检索原理（含核心公式）**
  - **（1）BM25 词法相关性评分公式**（对应 [retrieval.py](../../ai-service/app/retrieval.py) 中的 `bm25` 实现，$k_1 = 1.2, b = 0.75$）：
    $$\text{Score}_{\text{BM25}}(Q, D) = \sum_{t \in Q \cap D} \ln\left(1 + \frac{N - n(t) + 0.5}{n(t) + 0.5}\right) \cdot \frac{f(t, D) \cdot (k_1 + 1)}{f(t, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$
    其中 $N$ 为授权候选文档/分块总数，$n(t)$ 为包含词项 $t$ 的分块数，$f(t, D)$ 为词项在分块 $D$ 中的词频（含中文单字与二元词切分），$\text{avgdl}$ 为平均分块长度。
  - **（2）余弦相似度与稠密语义检索**：
    $$\text{sim}(\mathbf{q}, \mathbf{d}) = \frac{\mathbf{q} \cdot \mathbf{d}}{\|\mathbf{q}\|_2 \|\mathbf{d}\|_2}$$
  - **（3）倒数秩融合（Reciprocal Rank Fusion, RRF）公式**（对应 [RecommendationPolicy.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/shoppingai/service/RecommendationPolicy.java) 与 [ranking.py](../../ai-service/app/ranking.py)，平滑常数 $k = 60$）：
    $$\text{RRF}(d) = \sum_{r \in \mathcal{R}} \frac{1}{k + \text{rank}_r(d)}$$
    说明其核心工程优势：**仅依赖各路检索的序数排名 $\text{rank}_r(d)$，不依赖未校准的异构打分尺度（BM25 无界正实数 vs 余弦相似度 $[-1, 1]$）**。
- **2.3 数据库并发控制与分布式协调技术**
  - MySQL InnoDB 行级悲观锁（`SELECT ... FOR UPDATE`）、间隙锁规避、乐观版本号（`version`）并发控制；Spring Session + Redisson 分布式信号量与可重入锁机制。

---

## 第 3 章 系统需求分析与总体架构设计（约 4,000～4,500 字）

- **3.1 业务角色与功能需求分析**
  - 三类核心参与者：**消费者（学生/教职工）**、**商户成员（店主 Owner + 自定义角色店员）**、**平台管理员**。
  - *参考文档*：[PRD.md](../requirements/PRD.md)、[RELEASE-01.md](../specs/RELEASE-01.md)、[TRACEABILITY.md](../TRACEABILITY.md)。
- **3.2 非功能性需求与安全边界约束**
  - 交易金额零误差（统一以整数“分”存储计算）、库存零超卖、内部知识零外发泄漏、会话 CSRF 防护与 CSP 内容安全策略、AI 慢调用隔离。
- **3.3 限界上下文划分与上下文映射设计**
  - 详述 **7 大限界上下文**：身份与访问（Identity）、商户治理（Merchant）、商品目录（Catalog）、库存管理（Inventory）、交易与售后（Trading）、自提履约（Fulfillment）、智能导购与知识库（ShoppingAI）。
- **3.4 系统总体物理与逻辑架构设计**
  - Java 7 模块职责划分、双 Redis 实例隔离设计（安全会话/限流 `noeviction` vs 公开展示缓存 `allkeys-lru`）、Java ↔ Python 内部共享密钥与有界 HTTP/SSE 通信协议。
  - *参考文档*：[decisions.md](../architecture/decisions.md)、[SDD-REDIS-12.md](../specs/SDD-REDIS-12.md)、[streaming.md](../api/streaming.md)。
- **3.5 数据库总体设计与版本迁移治理**
  - 8 大表前缀共 **44 张表**的逻辑划分；不可变迁移脚本（21 个版本）与历史发布基线结构指纹准入机制（[schema_contract.py](../../scripts/schema_contract.py)）。

---

## 第 4 章 核心业务模块详细设计与实现（约 6,500～7,500 字，重头戏）

下表给出了第 4 章各小节与**项目真实源码**的一一对应关系，写论文画类图、时序图、贴关键代码片段（每次精选 15～25 行核心逻辑，切勿大段贴 Getter/Setter）时直接打开对应文件即可：

| 论文章节建议标题 | 核心设计亮点与算法/机制 | 对应仓库核心源码文件 |
|---|---|---|
| **4.1 身份认证与商户多租户自定义 RBAC 实现** | 同源 HttpOnly Session + 登录换会话 ID + 全接口 CSRF 校验；停用账号过滤器实时拦截；商户 15 项权限码自定义角色与跨商户严格复权 | [SessionSecurityConfig.java](../../campus-shopping-app/src/main/java/cn/bugstack/ai/config/SessionSecurityConfig.java)<br>[AccessServiceImpl.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/impl/AccessServiceImpl.java)<br>[SDD-RBAC-05.md](../specs/SDD-RBAC-05.md) |
| **4.2 商品多规格目录、图片安全与缓存自愈设计** | 商品/SKU 乐观版本控制；空相册跳过 `DELETE` 规避 InnoDB 间隙锁；图片像素校验重编码 PNG + 七牛受控重定向与动态 CSP；`DisplayCache` 事务提交后淘汰与 CAS 自愈 | [CatalogServiceImpl.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/catalog/service/impl/CatalogServiceImpl.java)<br>[QiniuPublicHttpPolicy.java](../../campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/config/QiniuPublicHttpPolicy.java)<br>[DisplayCache.java](../../campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/redis/DisplayCache.java) |
| **4.3 强一致交易结算、模拟支付、自提核销与售后裁决** | 全局固定锁序防死锁；`Idempotency-Key` 请求指纹幂等闸门；`on_hand / reserved` 分离库存模型；付款与自提任务同事务创建；动态令牌 SHA-256 摘要核销；退款申请—商户审核—平台争议三级裁决 + 15 分钟游标逾期关单 | [CheckoutCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/trading/impl/CheckoutCaseImpl.java)<br>[OrderLifecycleCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/trading/impl/OrderLifecycleCaseImpl.java)<br>[OrderExpiryJob.java](../../campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/job/OrderExpiryJob.java) |
| **4.4 全量商品两级混合召回与口语规格硬约束引擎** | 游标增量同步商品向量索引；MySQL 全表词面打分 Top 200 + Milvus 语义 Top 80 实时反查 + 商品级 RRF + 跨商品 Round-Robin SKU 采样 300 项；Python 中文预算/数量状态机与正负向规格过滤 + 二次 RRF | [CandidateResolver.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/CandidateResolver.java)<br>[ProductVectorSyncJob.java](../../campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/job/ProductVectorSyncJob.java)<br>[engine.py](../../ai-service/app/engine.py) · [sku_constraints.py](../../ai-service/app/sku_constraints.py) |
| **4.5 权限感知知识库检索与零锁流式会话提案机制** | 不可变文档版本与 `index_attempt` 租约；内部知识本地哈希特征 vs 外发双白名单 + PII 脱敏；AI 调用前后三次权限快照指纹比对（防 TOCTOU）与 UUIDv5/SHA-256 分块校验；`turn_token` 600s 租约 + `Propagation.NEVER` + 独立 SSE 断线恢复 + 提案同事务确认加购 | [ShoppingAiCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/ShoppingAiCaseImpl.java)<br>[EvidenceAssembler.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/EvidenceAssembler.java)<br>[ProposalConfirmationCaseImpl.java](../../campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/ProposalConfirmationCaseImpl.java)<br>[retrieval.py](../../ai-service/app/retrieval.py) |
| **4.6 同源三端前端状态隔离与自动化契约工程门禁** | 五维代次（Epoch Fencing）阻断切号/切店异步串号；有界流式帧解析；Controller → OpenAPI 102 路由自动生成与 SQL 全表扫描到期熔断门禁 | [store.js](../../frontend/src/services/store.js) · [api.js](../../frontend/src/services/api.js)<br>[guide-conversation.js](../../frontend/src/services/guide-conversation.js)<br>[verify-api-contract.py](../../scripts/verify-api-contract.py) |

---

## 第 5 章 智能导购评测实验与系统测试（约 4,000～5,000 字，冲优核心章）

- **5.1 系统测试环境与多层次自动化门禁验证**
  - 单元测试（Java 领域规则 56 项 + 5000 步随机库存不变量序列、JUnit 套件、Python 408 项 pytest、前端 35 项 Node 单测）；
  - 数据库真实迁移校验（空库初始化、3 个历史发布基线升级、重放幂等与结构漂移拒绝）；
  - 跨服务真实 HTTP 端到端与 Chromium 浏览器契约/全栈验证。
- **5.2 智能导购评测数据集构建与评价指标定义**
  - 数据集划分（`campus-shopping-v1`：240 商品 / 360 SKU / 24 篇多可见性知识文档 / 120 条覆盖多轮指代、模糊需求、预算数量、规格排除与越权探测的测试案例）。
  - **评价指标数学定义**（对应 [metrics.py](../../ai-service/evaluation/metrics.py)）：
    1. **召回率 $\text{Recall}@K$**：$\text{Recall}@K = \frac{|H_K \cap R|}{|R|}$，其中 $H_K$ 为去重前 $K$ 命中集合，$R$ 为相关性标注 $\text{grade} > 0$ 的真值集合。
    2. **平均倒数排名 $\text{MRR}$**：$\text{MRR} = \frac{1}{|Q|} \sum_{q \in Q} \frac{1}{\text{rank}_1(q)}$。
    3. **归一化折损累计增益 $\text{nDCG}@K$**：
       $$\text{DCG}@K = \sum_{i=1}^{K} \frac{2^{\text{rel}_i} - 1}{\log_2(i + 1)}, \quad \text{nDCG}@K = \frac{\text{DCG}@K}{\text{IDCG}@K}$$
    4. **商业硬约束合规率 $\text{ConstraintPass}$**：校验全部推荐项是否同时满足上架活跃、库存充足、正向规格匹配、负向排除词未出现以及整组总价 $\sum (\text{priceCent}_i \times \text{qty}_i) \le \text{Budget}$。
    5. **越权信息零披露率 $\text{UnauthorizedDisclosure}$**：检验未授权商户内部知识或已撤稿版本在引用与文本中的泄漏比例（硬门禁要求恒为 $0$）。
- **5.3 知识库混合检索消融实验与结果分析**
  - 对比 `K-B`（纯 BM25）、`K-D`（纯稠密向量）、`K-H`（BM25 + 向量 RRF 融合）、`K-H-R`（引入多轮指代查询改写后的混合检索）在 `Recall@1/3/5`、`MRR`、`nDCG@5` 上的表现。
- **5.4 全目录商品召回与硬约束安全实验分析**
  - 对比 `P-L`（MySQL 词面召回）、`P-D`（Milvus 语义召回 + Java 状态复验）、`P-H`（两级 RRF 混合召回）在 `Product Recall@20/50` 与 `SKU Pool Recall@300` 上的互补收益；验证 `SAFE` 撤权/撤稿/变价/超卖竞争下的 100% 拦截结果。
- **5.5 并发事务一致性与响应延迟测试**
  - 展示并发抢购最后库存零超卖、幂等键重放零重复建单、流式响应延迟分位数（P50 / P95）。

---

## 第 6 章 总结与展望（约 1,200～1,500 字）

- **6.1 全文工作总结**
  - 回扣绪论提出的三大痛点与四大研究内容，总结工程实现与评测结论。
- **6.2 系统局限性与未来展望（体现学术诚实度，评委非常认可）**
  1. **多 Python 实例无状态水平扩展**：当前知识分块原文与稀疏语料驻留单节点 SQLite WAL，未来可将分块正文与稀疏向量统一迁入共享存储/Qdrant Hybrid，实现推理层弹性扩缩容；
  2. **受控自然语言对比生成与原生多工具 Agent**：在保持事实槽位由 Java 强校验的前提下，开放更丰富的商品对比解释及多工具受控编排；
  3. **多模态商品理解与校内配送路线协同**：扩展扫描件 OCR、商品实拍图视觉检索及多自提点动态分流。
