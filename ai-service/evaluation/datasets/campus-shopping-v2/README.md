# 校园智能导购评测数据集 Campus Shopping Benchmark V2（草稿）

> **数据性质声明**：本目录全部商户、商品、SKU、知识文档、对话场景与识别符（`SYNTH-CANARY-V2-*`）均为**公开合成评测材料**（`synthetic: true`、`dataOrigin: "SYNTHETIC_BENCHMARK_ONLY"`），绝非线上真实经营数据或真实用户日志，不含任何个人隐私信息。  
> **当前治理状态**：`status = "DRAFT"`，`annotationSource = "AI_ASSISTED"`，`reviewed = 0 / 360`，其中 `22` 条边界场景显式标记 `disputed = true` 待人工裁决。禁止伪造 `HUMAN_REVIEWED` 或 `ACCEPTED` 状态；保留 `../campus-shopping-v1/` 及其历史实验证据不变。

## 一、规模与结构概览

| 维度 | 数量 / 配比 | 说明 |
|---|---|---|
| 合成校园商户 | **10 家**（+2 待审申请） | `m0..m8` 正常营业（`ACTIVE`），`m9` 停业整顿（`SUSPENDED` 七折低价与公告诱饵） |
| 商品 / SKU | **480 款商品 / 1,020 个 SKU** | 覆盖便利超市、文具学习、食品饮料、数码配件、宿舍生活、体育运动 6 大类 60 个商品原型；零串号拼接；`specKey` 与 `attributes` 词元严格一致 |
| 知识文档版本 | **80 个版本** | 24 篇平台规则 + 52 篇活跃门店文档 + 4 篇停业门店文档；含 10 组 `v1 WITHDRAWN -> v2 PUBLISHED` 同根演进与 22 篇 `>=2` 分块长文（核心条款分布在 `ordinal=1`） |
| 主评测场景 | **360 条** | 12 个主分类精确配比；按 `281` 个问题家族（含 `76` 个多成员改写/变体家族共 `155` 例）整族切分为 **144 开发集（`dev`）** 与 **216 测试集（`test`）**；从 `dev` 每类抽取 2 例共 **24 条 `smoke`** |
| 独立挑战集 | **24 条**（`challenge.jsonl`） | 覆盖独立神经 Reranker、优惠券满减、跨商户合单支付、外卖配送、已提货退货/部分退款、图片/扫描 PDF OCR、自动写操作 Agent 等未实现能力，显式标记 `UNSUPPORTED` |

完整分布统计见 [V2 数据分布报告](../../../../docs/ai/benchmark-v2-data-distribution.md)，标注规则与争议裁决流程见 [V2 Gold 标注手册](../../../../docs/ai/benchmark-v2-annotation-manual.md)。

## 二、十二主类与划分明细

| 主分类（`queryType`） | 总数 | `dev` | `test` | `smoke`（属 `dev`） | 核心考察点 |
|---|---:|---:|---:|---:|---|
| `exact-product-spec` | 30 | 12 | 18 | 2 | 多维规格精确命中、全目录非截断召回、相近规格区分 |
| `fuzzy-need-scenario` | 40 | 16 | 24 | 2 | 无商品名直露的校园痛点/用途描述检索 |
| `budget-combo-constraint` | 35 | 14 | 21 | 2 | 阿拉伯与中文大写金额、多件/跨品类组合总预算、模糊区间澄清 |
| `attribute-quantity-negation` | 30 | 12 | 18 | 2 | 正向规格+否定排除（无糖/不辣/非插电等）、多件数量与越界澄清 |
| `oos-discontinued-nomatch` | 25 | 10 | 15 | 2 | 售罄、全额预占（`onHand=reserved`）、SKU 停用、下架、停业商户与超目录拒答 |
| `cross-merchant-compare` | 20 | 8 | 12 | 2 | 全活跃商户候选下同名异价/异规格性价比择优（无门店预筛泄漏） |
| `public-knowledge-multievidence` | 35 | 14 | 21 | 2 | 跨文档政策综合、长文第 2 分块（`ordinal=1`）定位、新旧版本区分 |
| `multiturn-clarification` | 40 | 16 | 24 | 2 | 2～4 轮商品约束继承/覆盖、多轮知识追问（激活 `K-D-R`/`K-H-R`）与主动澄清 |
| `colloquial-typo-ambiguity` | 25 | 10 | 15 | 2 | 校园口语黑话、同音错别字容错与真实指代/小数数量歧义 |
| `knowledge-acl-privacy` | 25 | 10 | 15 | 2 | 消费者、普通店员（无 `knowledge.read`）、授权店员、店主、平台管理员五角色隔离 |
| `prompt-injection-hallucination` | 25 | 10 | 15 | 2 | 越权指令覆盖、伪造支付/下单执行拦截、无依据赔付/包邮谣言拒答 |
| `proposal-safety-mutation` | 30 | 12 | 18 | 2 | 确认前变价/售罄/预占耗尽/下架/停业/过期/跨用户/幂等重放与生成期撤稿撤权 |
| **合计** | **360** | **144** | **216** | **24** | 单场景唯一主分类，允许多个辅助 `tags` 与重叠 `taskScopes` |

## 三、确定性生成、校验与复核命令

在仓库根目录执行（固定 `PYTHONHASHSEED=20261031` 与 UTF-8 LF 换行）：

```powershell
# 1. 重新生成并校验 V2 数据集（若已冻结为 ACCEPTED 将自动拒绝覆盖）
cd ai-service
python -m evaluation.generate_v2
cd ..

# 2. 导出 HTML 人工复核包与可编辑 annotations.jsonl（拒绝覆盖已有人工记录）
python ai-service/evaluate.py --dataset campus-shopping-v2 --export-review var/evaluation/review-v2/campus-shopping-v2.html

# 3. 核验人工复核结构完整性（未完成人工复核前返回退出码 1 与 PENDING 统计）
cd ai-service
python -m evaluation.review_validation --dataset campus-shopping-v2 --annotations ../var/evaluation/review-v2/annotations.jsonl
cd ..

# 4. 运行本地检索/推荐、独立 SSE 首 Token 延迟与挑战集核验
python ai-service/evaluate.py --dataset campus-shopping-v2 --split dev --profile local --experiments K-B,K-D,K-H,K-D-R,K-H-R,R-RULE
python ai-service/evaluate.py --dataset campus-shopping-v2 --split smoke --profile controlled --experiments S-SSE
python ai-service/evaluate.py --dataset campus-shopping-v2 --split challenge --profile local --experiments R-RULE
```

**严禁将 `test` 划分用于 Prompt 调优、词表扩充或阈值搜索。** 调整任何语料文本或 `qrels` 标签必须同步升级 `version` / `annotationVersion` 并重算 `manifest.json` 的 SHA-256 摘要。
