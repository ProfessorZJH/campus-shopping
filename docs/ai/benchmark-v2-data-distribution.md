# Campus Shopping Benchmark V2 · 数据规模与分布报告

> 对应数据集版本：`campus-shopping-v2`（`2.0-draft` / `v2-draft-1`，`seed=20261127`）  
> 生成入口：[generate_v2.py](../../ai-service/evaluation/generate_v2.py) · 数据目录：[campus-shopping-v2](../../ai-service/evaluation/datasets/campus-shopping-v2/README.md)

---

## 一、V1 与 V2 核心指标对比

| 指标维度 | `campus-shopping-v1`（保留不改） | `campus-shopping-v2`（本轮新建） | 质量治理提升点 |
|---|---:|---:|---|
| 主评测场景总数 | 120（48 `dev` / 72 `test` / 12 `smoke`） | **360**（**144 `dev` / 216 `test` / 24 `smoke`**） | 3 倍样本容量，每主类严格按 40%/60% 切分 |
| 独立挑战集（`UNSUPPORTED`） | 0（仅 CLI 实验名 `E4`） | **24**（`challenge.jsonl` 覆盖 8 类未实现能力） | 未实现产品能力显式剥离，不污染主集分母 |
| 合成商户数量 | 6（5 `ACTIVE` + 1 `SUSPENDED`） | **10**（9 `ACTIVE` + 1 `SUSPENDED` + 2 待审申请） | 支持真实跨门店多方比价与停业低价诱饵 |
| 商品 / SKU 数量 | 240 / 360（仅 2 种 `specKey`） | **480 / 1,020**（60 原型 × 多维中文规格词元） | 消除标题串号，Python `attributes` 与 MySQL `spec_key` 100% 对齐 |
| 知识文档版本数 | 24（全 `version=1`，仅 2 篇重复套话长文） | **80**（含 10 组 `v1->v2` 演进、22 篇真实多块长文） | 覆盖 `ordinal=1` 深层分块定位、撤回旧版与草稿隔离 |
| 问题家族（`familyId`） | 120 个单样本家族（实质无跨族约束） | **281 个家族**（**76 个多成员家族覆盖 155 例**） | 真正按语义改写/变体整族切分，`0` 跨 split 家族泄漏 |
| 跨 split 词面近似预警 | 模板槽位换名落在 `0.88~0.89` | `nearDuplicateWarnings = []`、`charBigramOverlapWarnings = []` | 仅代表词面/字符二元组筛查（`semanticLeakageVerified=false`），完整防过拟合配合 [独立 Holdout 盲测](benchmark-v2-holdout-protocol.md) |
| 多轮知识改写有效样本 | **0 例**（`K-H` 与 `K-H-R` 全集恒等） | **12 例**（含指代词跨轮次门店/政策追问） | `K-D-R` / `K-H-R` 首次具备真实非空消融对照 |
| 角色权限覆盖 | 3 类（`buyer` / `owner` / `admin`） | **5 类**（新增有/无 `knowledge.read` 店员对照） | 完整检验细粒度店员 RBAC 边界 |
| Gold 审核状态 | `DRAFT`（`reviewed=0/120`） | **`DRAFT`**（`reviewed=0/360`，`disputed=22`） | 保持诚实草稿标记并显式标出 22 条待人工裁决争议样本 |

---

## 二、商品与 SKU 语料分布（480 商品 / 1,020 SKU）

### 1. 六大校园消费类目分布

| 类目编码（`categoryCode`） | 原型数 | 商品数 | 代表消费原型 |
|---|---:|---:|---|
| `convenience`（校园便利超市） | 10 | **80** | 原生木浆抽纸、酒精/纯水湿巾、黑胶晴雨伞、骑行雨衣、洗衣凝珠、去渍笔、碱性电池、防过载插线板、暖贴、驱蚊喷雾 |
| `stationery`（文具学习） | 10 | **85** | 速干按动中性笔、护眼荧光笔、活页笔记本、错题本、科学计算器、风琴文件袋、便携订书机、便利贴、索引贴、考试涂卡2B套组 |
| `food_beverage`（食品饮料） | 11 | **95** | 原叶乌龙茶、鲜柠冰红茶、零卡气泡水、纯牛奶、植物燕麦奶、挂耳黑咖啡、全麦吐司、谷物能量棒、每日混合坚果、卤豆干、非油炸速食桶 |
| `digital`（数码配件） | 10 | **75** | 双Type-C快充线、苹果Lightning快充线、氮化镓多口充电头、自带线充电宝、轻音无线鼠标、无线机械键盘、蓝牙耳机、有线网课耳机、拓展坞、电容笔替芯 |
| `dormitory`（宿舍用品） | 10 | **80** | 无频闪护眼台灯、遮光床帘、床边挂篮、折叠收纳箱、护颈记忆枕、轻音桌面夹扇、限电恒温暖杯垫、速干毛巾浴巾、防滑浴室拖鞋、衣柜除湿袋 |
| `sports`（运动用品） | 9 | **65** | 耐打羽毛球、计数无绳跳绳、防滑瑜伽垫、加压护腕、弹簧支撑护膝、Tritan运动水壶、导汗头带、乒乓球拍套组、训练弹力带 |
| **合计** | **60** | **480** | 覆盖 24 个虚构品牌，含 31 组跨店同名异价竞争商品组 |

### 2. 商品经营状态与困难负样本 SKU 分布

- **商品级状态（480 款）**：
  - 活跃商户（`m0..m8`）正常上架 `PUBLISHED`：**410 款**（含 890 个 SKU）
  - 停业商户（`m9 SUSPENDED`）上架低价诱饵 `PUBLISHED`：**18 款**（日常价约七折，检验商户资格硬拦截）
  - 活跃商户已下架 `UNPUBLISHED`：**32 款**
  - 活跃商户未发布草稿 `DRAFT`：**20 款**
- **活跃上架商品下的 SKU 库存与启用状态（890 个 SKU）**：
  - 正常在售充足库存（`ACTIVE`，`available ∈ 16..60`）：**720 个**
  - 低库存边界规格（`ACTIVE`，`available ∈ 1..3`，检验多件购买库存核验）：**30 个**
  - 全额预占无可用库存（`ACTIVE`，`onHand > 0` 且 `reserved == onHand`，`available == 0`）：**35 个**
  - 账面售罄规格（`ACTIVE`，`onHand == 0, reserved == 0`）：**45 个**
  - 已停用规格（`INACTIVE`，常设于低价单件装以检验 SKU 级状态过滤）：**60 个**
  - 另内置 **12 组全站确定性缺货属性组合**，专供“商品存在但指定规格全网无货”精准拒答测试。

---

## 三、知识文档版本语料分布（80 个版本）

| 归属主体 | `PUBLIC` (`PUBLISHED`) | `INTERNAL` (`PUBLISHED`) | `WITHDRAWN`（历史撤回版） | `DRAFT`（未发布草稿） | 小计 | 多块长文（`>=2 chunks`） |
|---|---:|---:|---:|---:|---:|---:|
| 平台级（`merchantId=null`） | 14 | 4（`PLATFORM_INTERNAL`） | 4（3 公开旧版 + 1 内部旧版） | 2 | **24** | 7 |
| 活跃商户（`m0..m8`） | 18 | 18（`MERCHANT_INTERNAL`） | 7（`m0..m6` 历史自提旧规） | 9 | **52** | 12 |
| 停业商户（`m9 SUSPENDED`） | 2（因停业被 ACL 排除） | 1（`MERCHANT_INTERNAL`） | 1 | 0 | **4** | 0 |
| **合计** | **34** | **23** | **12** | **11** | **80** | **19+**（实际共 **22** 篇） |

- 单主体文档上限为平台 `24` 篇、单商户 `6` 篇，严格低于生产 MySQL `IAiDao.reserveIndexRate` 每主体 60 次/分钟的索引配额边界。
- 全部 22 篇多块长文档长度介于 `1,087～1,287` 字符（按 `700` 字窗口 / `80` 字重叠切出 2 个分块），第 2 分块（`ordinal=1`）专门承载夜间/周末延时、超时自动退回、冷链离柜时效、数码未拆封换新及宿舍限电瓦数等关键细则，无任何重复灌水文本。

---

## 四、场景动作、角色与挑战集分布

- **采购语义模式（`constraints.purchaseMode`）**：`SINGLE`（单品确定性采购）**177 例**、`ALTERNATIVES`（备选推荐）**78 例**、`BUNDLE`（跨品类组合购买，含必选商品组 `requiredGroups`）**12 例**、纯知识无商品采购 **93 例**。
- **预期行为（`expectedBehavior.action`）**：覆盖 `RECOMMEND`（210 例）、`KNOWLEDGE_ONLY`（93 例）、`CLARIFY`（29 例）与 `NO_MATCH`（28 例）。
- **独立挑战集（`challenge.jsonl`，共 24 例 `UNSUPPORTED`）**：
  1. `INDEPENDENT_NEURAL_RERANKER`：3 例
  2. `COUPON_AND_TIERED_DISCOUNT`：4 例
  3. `CROSS_MERCHANT_COMBINED_PAYMENT`：3 例
  4. `CAMPUS_DORM_DELIVERY_LOGISTICS`：3 例
  5. `POST_PICKUP_RETURN_OR_PARTIAL_REFUND`：3 例
  6. `IMAGE_AND_SCANNED_PDF_OCR`：3 例
  7. `AUTONOMOUS_TRANSACTION_WRITE_AGENT`：3 例
  8. `CONSUMER_STRICT_MERCHANT_LOCK_FILTER`：2 例
