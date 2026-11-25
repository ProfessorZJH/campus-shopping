# 开题报告逐段修订指南与任务书口径对齐手册

> 对应 Word 开题报告：`张嘉辉_本科毕业设计开题报告_附件6最新模板版.docx`（题目：《基于 Spring Boot 的校园智能导购商品交易系统设计与实现》）  
> 目标：在**尊重任务书方向**的前提下，消除开题报告与项目真实源码之间的冲突，亮出项目真正的工程与算法高分点，避免中期/终期答辩出现“开题承诺与实际系统两张皮”的风险。

---

## 一、核心原则与任务书口径收口（先与指导教师确认）

当前开题报告按任务书原文保留了“基于内容的推荐 + 物品协同过滤（Item-CF）+ 首页猜你喜欢 + Precision@K/Recall@K/覆盖率实验”，以及“待定的 MyBatis-Plus / JWT”描述。建议在**开题定稿或开题答辩前**与指导教师明确以下口径（推荐**方案 A**，若导师强制要求保留协同过滤则启用**方案 B 最小预案**）：

| 议题 | 原开题报告表述 | 推荐修订方案（方案 A：与当前高分工程 100% 一致） | 备选预案（方案 B：若导师强制要求传统推荐） |
|---|---|---|---|
| **持久化框架** | “任务书列出的 MyBatis-Plus 等将结合意见统一” | **直接定论为 MyBatis 3（XML 显式映射）**：说明高并发交易与 RBAC 需要显式控制 `SELECT ... FOR UPDATE` / `FOR SHARE` 锁序并接受全表扫描静态门禁审查，原生 XML 更可控透明。 | 同左（MyBatis 与 MyBatis-Plus 均属 MyBatis 生态，给出清晰工程理由即可获批）。 |
| **认证与会话** | “任务书列出的 JWT 等将结合意见统一” | **直接定论为 HttpOnly Session Cookie + CSRF + Redis Spring Session**：说明多商户存在“管理员停用账号 / 店主撤销店员权限即时生效”的强安全要求，服务端会话配合双 Redis 隔离与跨标签页身份校验更安全。 | 同左（强调即时撤权与防 XSS 窃取令牌的安全性优势）。 |
| **智能推荐 / 导购核心路线** | 同时承诺“内容推荐 + 物品协同过滤 + 首页猜你喜欢 + Precision@K/覆盖率”与“LLM + RAG 导购” | **经导师同意后聚焦单主线**：面向新上线校园商城缺乏大规模历史交互矩阵的实际条件，将“智能导购推荐”聚焦为**全目录词面（MySQL）+ 语义（Milvus）两级 RRF 混合召回 + 中文预算/数量/正负规格确定性硬约束引擎 + 权限感知 RAG + 提案两阶段事务确认**，评测指标统一为 `Recall@K`、`MRR`、`nDCG@K`、`ConstraintPass` 与 `UnauthorizedDisclosure`。 | 若任务书锁死必须包含协同过滤，后期（2027 年 2～3 月）再增补最小闭环：`rec_user_event` 埋点表 + 首页轻量 Item-CF/热门冷启动兜底接口 + 独立离线 `Precision@K / Recall@K / 目录覆盖率` 对比脚本。 |
| **“已有项目/工程”话术** | 出现“已有项目”“现有校园商城的研究基础”“已有工程” | **全部删除上述字眼**，改为“前期需求调研与原型技术预研阶段验证了基础框架可行性”，避免评委误解为拿现成开源项目二次修改。 | 同左。 |

---

## 二、开题报告 3 处系统事实偏差与可直接替换段落

### 2.1 偏差 1：商品“发布前平台审核”与实际规则不符
- **原开题报告（第一部分）**：*“商品以商户发布和审核通过的销售数据为准”“实际购买时需要满足商品审核通过”*
- **源码真实行为**：[ProductStatusEnumVO.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/catalog/model/valobj/ProductStatusEnumVO.java) 仅包含 `DRAFT` / `PUBLISHED` / `UNPUBLISHED`。平台审核对象是**商户入驻申请（`mer_application`）**，入驻获批后的活跃商户可自主发布上架商品，平台拥有对违规商品的**事后强制下架（`forceUnpublish`）**与对违规商户的**暂停营业（`SUSPENDED`）**监管权。
- **可直接替换的表述**：
  > 平台管理员负责审核商户入驻申请、维护基础商品类目，并在发现违规经营时执行商品强制下架或商户暂停营业；获批活跃商户可自主维护商品多规格（SKU）信息与上下架状态，消费端仅展示且允许购买归属活跃商户、处于已上架状态且可售库存充足的 SKU。

### 2.2 偏差 2：售后范围未写明边界
- **原开题报告（第三部分）**：*仅写“基础售后”*
- **源码真实行为**：售后状态机 [AfterSaleAggregate.java](../../campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/trading/model/aggregate/AfterSaleAggregate.java) 为 `REQUESTED → REJECTED → DISPUTED → APPROVED`，明确限定为**已支付未提货订单的整单模拟退款与平台争议裁决**，不含已提货退货和部分退款。
- **可直接替换的表述**：
  > 售后业务限定为已支付未提货订单的整单模拟退款与争议裁决闭环（支持买家发起退款、商户审核或驳回、买家申诉以及平台管理员终审裁决并同事务释放预占库存），不涵盖已提货实物退货与部分金额退款场景。

### 2.3 偏差 3：AI 导购自然语言说明与确定性硬约束的职责表述
- **原开题报告（第一、四部分）**：*“再由模型生成简洁说明与加购提案”*
- **源码真实行为**：系统对**价格、库存、预算总价（含“低于/少于”严格上界）、购买数量及正负向规格排除**实行 Java/Python 双端确定性硬校验，并优先采用受控模型输出与结构化事实复核生成最终可读导购说明；当未配置外部模型或上游超时降级时，平滑回退至本地确定性检索模板并显式标注 `LOCAL_RETRIEVAL_DEMO` / `LOCAL_FALLBACK`，绝不伪造大模型推理结果。
- **可直接替换的表述**：
  > 智能导购采用独立 Python FastAPI 检索推理服务与 Java 核心交易服务协同的双栈架构：自然语言预算、数量与正负向规格条件由确定性规则引擎严格校验，商品候选通过全目录词面检索与可选 Milvus 语义检索的两级倒数秩融合（RRF）生成；回答与加购提案经 Java 端实时复核商品价格版本、可售库存及知识访问权限后返回前端，任何加购与下单写操作均须用户显式确认后由后端数据库事务执行；当外部模型不可用时自动降级为本地混合检索模式，确保商城主链路零受阻。

---

## 三、建议补入开题报告第四/五部分的 6 大真实工程亮点

原开题报告遗漏了仓库中最具答辩区分度的核心工程成果，建议在“研究方案”与“主要特色”中明确补写：

1. **七模块 DDD 六边形模块化单体架构**：以 `types / api / domain / case / infrastructure / trigger / app` 七层依赖倒置划分 7 大限界上下文与 44 张分前缀表，借助静态边界门禁（`verify-ddd-boundaries.py`）禁止跨领域越权写表，单库 ACID 事务零成本保证强一致。
2. **确定性全局锁序与全链路幂等防超卖**：结算、支付、核销、退款与 RBAC 变更严格按固定表/主键升序加锁（消除 InnoDB 死锁与 MVCC 幻读竞态）；下单采用 `Idempotency-Key` + SHA-256 指纹闸门，库存采用 `on_hand` 与 `reserved` 分离模型。
3. **双实例 Redis 语义隔离与零锁长连接流式导购**：将安全会话/限流/AI 准入信号量（`redis-security`，`noeviction` + AOF）与可重建商品展示缓存（`redis-cache`，`allkeys-lru`）物理隔离；AI 流式交互通过 MySQL 600 秒 `turn_token` 租约与 `Propagation.NEVER` 确保慢推理期间零数据库连接占用。
4. **多租户知识库四重防泄漏防线**：内部知识本地 256 维哈希向量不出域 + 查询前置权限白名单 + 外发二次裁剪与 PII 脱敏 + 调用前后三次权限快照指纹比对（防御生成期间撤稿/撤权的 TOCTOU 越权）。
5. **跨标签页身份防串号与有界 SSE 协议**：前端构建五维单调递增代次（Epoch Fencing）与冷/热 CSRF 双重校验，防止多标签页切号后以错误账号执行写操作。
6. **数据库 21 份不可变迁移指纹治理与自动化质量门禁**：应用启动只读校验 `sys_schema_migration` 校验和与历史发布基线结构指纹（已在隔离 MySQL 8.0.31 验证空库与 3 个历史基线升级等价性），配合 OpenAPI 102 路由契约核对与 SQL 全表扫描门禁（订单表 4 项豁免已收窄清零）。

---

## 四、开题报告工作进度表修正版（消除日期冲突与 9 周过载）

原开题报告中“答辩评定止于 `2027-05-23`”与次句“成果完成日期为 `2027-05-25`”衔接略显突兀，且把大量研发与论文写作全部堆在春季 9 周。建议调整为更均衡、真实的节奏：

| 起止时间 | 阶段任务与可检查交付物 |
|---|---|
| `2026年10月19日 — 2026年11月8日` | 明确选题方向与任务书要求，完成校园多商户自提场景需求分析与技术栈选型论证。 |
| `2026年11月9日 — 2026年12月13日` | 检索并研读国内外文献，完成系统总体架构（DDD 模块划分、44 表逻辑模型与双栈协议）设计，定稿开题报告并参加开题答辩。 |
| `2026年12月14日 — 2027年1月17日` | 完善核心交易、多租户 RBAC、数据库 21 份不可变迁移与并发锁序加固，完成工程门禁与阶段性集成验证，提交中期检查材料。 |
| `2027年2月22日 — 2027年3月31日` | 完成校园导购评测数据集去偏差改写与人工复核冻结（Gold Dataset），执行稀疏/稠密/RRF 混合检索消融实验、硬约束合规率与并发竞争压测，汇总实验图表。 |
| `2027年4月1日 — 2027年4月25日` | 完成毕业论文第 1～6 章撰写、图表排版、查重修改与导师审阅定稿，复跑隔离 MySQL/Redis/浏览器全栈回归。 |
| `2027年4月26日 — 2027年5月25日` | 整理答辩 PPT、8 分钟三端演示环境与离线兜底录屏，参加毕业设计终期答辩、成绩评定及论文与源码归档（按任务书于 2027 年 5 月 25 日前完成全部成果提交）。 |

---

## 五、参考文献优化与扩充方案（12 篇 → 16～18 篇 GB/T 7714 规范）

### 5.1 原 12 篇参考文献核查与调整建议
- **建议保留并补齐格式细节（共 8 篇）**：
  - `[1]` ADOMAVICIUS & TUZHILIN (2005) — 推荐系统综述经典，保留。
  - `[2]` BURKE (2002) — 混合推荐分类与融合经典，保留。
  - `[3]` SARWAR et al. (2001) — 补全会议出版地/出版者：`New York: ACM, 2001: 285-295.`（若采用方案 A 不做协同过滤，可仅在综述背景中简述或精简）。
  - `[4]` HU, KOREN & VOLINSKY (2008) — 补全出版地：`Piscataway, NJ: IEEE, 2008: 263-272.`。
  - `[7]` LEWIS et al. (2020) — RAG 奠基论文，保留并补全出版地/出版者（Curran Associates, Inc.）。
  - `[8]` RICCI et al. (2022) — 权威手册，保留。
  - `[10]` 吴国栋等 (2024)、`[11]` 谢广明等 (2025)、`[12]` 吴国栋、谢东辰等 (2026) — 高度契合大语言模型推荐与 RAG 推荐综述，保留（建议不要全部仅集中于《智能系统学报》一刊，可搭配下方其他期刊文献平衡来源）。
- **建议替换（若采用方案 A，共 3 篇与实际代码无关）**：
  - 原 `[5]` 矩阵分解（Koren et al. 2009）、`[6]` 神经协同过滤 NCF（He et al. 2017）、`[9]` 矩阵补全宽度学习协同过滤（史加荣、何攀 2024）——项目未涉及任何评分矩阵分解或深度神经协同过滤，答辩易被追问“引用了为何没用”。

### 5.2 强烈建议补充的本系统核心理论与架构权威文献（均与源码直接对应）
以下国际经典文献作者、年份与出处均经核实，直接支撑本系统的 **BM25、RRF 融合、DDD 架构、稠密检索与 RAG 综述**：

1. **BM25 概率检索经典**（直接对应 `ai-service/app/retrieval.py#bm25`）：
   > ROBERTSON S, ZARAGOZA H. The probabilistic relevance framework: BM25 and beyond[J]. Foundations and Trends in Information Retrieval, 2009, 3(4): 333-389. DOI:10.1561/1500000019.
2. **倒数秩融合 RRF 原始论文**（直接对应 `RecommendationPolicy.java` 与 `ai-service/app/ranking.py` 的 $k=60$）：
   > CORMACK G V, CLARKE C L A, BUETTCHER S. Reciprocal rank fusion outperforms condorcet and individual rank learning methods[C]//Proceedings of the 32nd International ACM SIGIR Conference on Research and Development in Information Retrieval. New York: ACM, 2009: 758-759. DOI:10.1145/1571941.1572114.
3. **稠密段落检索 DPR 经典**（直接对应稀疏 BM25 vs 稠密向量检索对比实验）：
   > KARPUKHIN V, OGUZ B, MIN S, et al. Dense passage retrieval for open-domain question answering[C]//Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP). Stroudsburg, PA: Association for Computational Linguistics, 2020: 6769-6781. DOI:10.18653/v1/2020.emnlp-main.550.
4. **领域驱动设计（DDD）奠基与实践专著**（直接对应 7 模块六边形架构与限界上下文）：
   > EVANS E. Domain-Driven Design: Tackling Complexity in the Heart of Software[M]. Boston: Addison-Wesley, 2003.  
   > VERNON V. Implementing Domain-Driven Design[M]. Upper Saddle River, NJ: Addison-Wesley, 2013.
5. **RAG 范式综述**（支撑混合检索、索引构建与幻觉/安全评估框架）：
   > GAO Y, XIONG Y, GAO X, et al. Retrieval-augmented generation for large language models: A survey[J]. arXiv preprint arXiv:2312.10997, 2023.
6. **中文核心期刊补充方向（建议在知网 CNKI 检索并核对准确卷期页码与 DOI 后补入 2～3 篇）**：
   - 在《计算机研究与发展》《软件学报》《计算机学报》或《计算机工程与应用》检索近 3 年主题为**“检索增强生成 权限/安全/幻觉”**、**“领域驱动设计 电商/微服务/模块化单体”**、**“高并发 库存一致性 / 事务锁优化”**的中文文献 2～3 篇，彻底打破原报告 4 篇中文文献全出自《智能系统学报》单一期刊的局限。
