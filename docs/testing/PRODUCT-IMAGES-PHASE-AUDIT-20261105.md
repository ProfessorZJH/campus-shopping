# 商品多图第一阶段与远端状态核对（2026-11-05）

## 结论与核对版本

第一阶段的主体代码已经通过 PR #51 合入 `main`，但仍有旧客户端编辑丢失副图的缺陷，以及明确未整合的失败项列表/重试能力，不能记为第一阶段全部收尾。第二阶段七牛 Kodo/CDN 尚未实现。

本轮为只读调查与定向单元探针，未修改功能源码，未连接业务数据库，未执行迁移、部署或全量测试。

- 本地分支：`codex/shoppingai-rag-corrections`，核对起点 `3131870fe0297412a8f91ceb31b60a9c14e0da80`。
- GitHub `main`：`ab31f89a2fbff4671bea7aeef67cc8120263e73d`。
- `CatalogServiceImpl.java`、`ProductImageListField.js`、`ProductImageRepository.java` 在上述两个提交间无差异，因此本轮发现适用于当前远端主线对应源码。

## 1. 第一阶段已实现的范围

依据 [IMG-01 规格](../specs/UI-PRODUCT-IMAGES.md)及当前源码，已存在以下完整路径：商户上传 → Java 校验、PNG 重编码与商户登记 → 商品保存 0–8 张有序引用 → 首图兼容字段 → 商品详情多图展示、排序和移除。

后端保留权限、CSRF、对象存在性、商户归属、同库事务、乐观版本、稳定认领锁序及新增 SKU 当前读。图片文件仍通过 `ProductImageRepository` 写入本地上传目录；数据库行固定 `provider=LOCAL`，公开地址为 `/media/<uuid>.png`。`compose.yml` 配置上传持久卷，尚无七牛上传适配或凭据配置链路。

## 2. 已复现：旧客户端普通编辑删除副图引用

对应 [PR #50 原始审查](https://github.com/ProfessorZJH/campus-shopping/pull/50)中的 `PRRT_kwDOVbgmwc6y_DuQ`，并未因后续整合自动消失。

触发条件：商品已经有两张或更多图片，旧客户端编辑名称/描述时仅提交原来的 `imageUrl`，省略或传 null 的 `imageUrls`。

当前 `CatalogServiceImpl.edit` 调用 `checkedImages(imageUrls, image)`；当列表为空引用时，辅助方法返回仅包含旧主图的列表。随后 `images.replace` 删除旧图片行并写回单张图。主图保持不变，所以单图客户端无法察觉副图被删除。

本轮使用 Java 17，将**当前源码**的 `CatalogServiceImpl.java` 编译到临时探针目录，并用显式 Repository 替身调用真实 `edit` 方法。结果：

```text
client=current before=2 after=2 unchangedPrimary=true
client=legacy before=2 after=1 unchangedPrimary=true
LEGACY_SECONDARY_IMAGE_LOSS_REPRODUCED (unit probe, no database)
```

这是领域服务调用层的复现，不是数据库或 HTTP 集成验收。修复应区分创建与编辑的旧字段兼容行为：旧客户端未改变主图的元数据编辑保留既有相册；显式 `imageUrls=[]` 继续表示清空。旧主图被主动替换时的有序兼容规则需要在规格及回归中明确，不能靠无条件单图替换处理。

## 3. 未整合能力与文档不一致

1. `UI-PRODUCT-IMAGES-VERIFICATION.md` 顶部及 PR #51 明确说明：followup 开发线的逐项失败列表/重试及对应浏览器用例未纳入整合。当前组件只有全局错误和“放弃本次图片选择”，没有逐文件失败列表或重试入口。
2. 同一报告下文仍保留旧开发线“14 项通过、失败项移除、重复选择只上传一次”的历史结论；这些已被顶部说明限定，不能当作当前主线证据。当前浏览器脚本记录 13 项，重点为契约替身验证。
3. 验收手册要求同批混入非法文件后保留其余成功项；当前组件在上传前检查整批，只要一个文件非法就拒绝整批。网络上传过程中第二张失败时，已经上传的第一张也不会提交到表单，属于部分成功保留的体验缺口；本轮仅作源码核对，未执行该场景的浏览器复现。
4. 规格末尾仍把图片验收报告称作“首版单图历史验收”，而报告本身已包含多图及两线整合说明；`docs/README.md` 仍以 PR #50 的“合并阻塞”报告作为主入口，容易误读已完成的整合状态。

旧开发线记录不是无效证据，但其提交、环境与范围必须单独保留。当前第一阶段的完成声明应以上述实际整合范围为准。

## 4. 远端问题的来龙去脉

- [PR #50](https://github.com/ProfessorZJH/campus-shopping/pull/50)：已关闭、未合并，由 PR #51 取代。它曾有迁移编号与 #49 冲突、生成 UI 不同步、旧客户端编辑等审查问题，现仍保留 10 条未解决线程；关闭 PR 不表示每条意见都已修复。
- [PR #51](https://github.com/ProfessorZJH/campus-shopping/pull/51)：2026-11-04 合入 `main`，合并提交 `ab31f89`。4 条审查线程均已解决，包含历史共享图片归属、新旧库复合主键一致、稳定认领顺序和真实旧库夹具问题。
- PR #51 的 Quick quality gates、Maven/MySQL/FastAPI/Browser E2E、Chromium current/legacy、交付镜像链路均通过；可选真实外部 AI smoke 为 skipped。此为本轮读取的 GitHub 记录，未由本轮重新执行。
- PR #51 的自动审查汇总仍显示 Code Review Failed，随后的机器人消息说明审查额度耗尽。它表示该次自动审查未完成，不能等同功能测试失败，也不能声称最终版本已完成一次无遗漏的自动审查。
- 目前 PR #49 仍是独立的 ShoppingAI/RAG 工作，不能把它的 21 条待解决审查线程都当作商品多图 PR 的遗留问题。

旧报告提到的迁移同号冲突，当前工作分支已拆分为 `V20261102_01__product_images.sql` 与 `V20261105_01__inventory_integrity_and_query_indexes.sql`。本轮仅核对文件状态，不据此授权或宣称既有环境已完成迁移。

## 5. 第二阶段状态与建议顺序

七牛 Kodo/CDN、对象释放/回收及历史对象迁移仍列为第二阶段。现有 `provider` / `object_key` 字段只提供扩展位置，不代表完成云存储接入。

建议先修复旧客户端编辑丢副图，并收敛第一阶段的失败项处理范围与当前报告；再单独制定第二阶段的对象标识、上传/访问策略、旧 `/media` 兼容、商户归属、共享历史引用与回收规则。接入七牛不能替代第一阶段的数据一致性修复。

## 6. 本轮实际验证与限制

| 验证 | 结果及边界 |
|---|---|
| GitHub API 核对 #50/#51、main 与审查线程 | 已完成；状态见第 4 节 |
| 当前图片关键源码与 main 合并提交比较 | 三个关键文件无差异 |
| `ImageLegacyEditProbe`（临时目录、真实领域方法 + Repository 替身） | 复现旧编辑从 2 张变为 1 张；当前列表请求保留 2 张 |
| `node --test frontend/tests/product-image-list.test.mjs` | 6 passed / 0 failed / 0 skipped |
| `python scripts/build-ui-bundle.py --check` | PASS，当前源码与生成静态副本一致 |

临时探针与编译产物位于忽略的 `var/verify/`；它们没有写入业务库或更改仓库功能测试。未执行真实后端浏览器多图专项、业务库迁移、远端部署或七牛服务调用；上述结果不能扩大为这些范围通过。

编排说明：本轮曾通过两个独立的 Pi RPC 执行端委派 PR #49 逐条核对与旧库提案一致性审查，模型为 `wuxian/deepseek-flash`，全局默认思考为 `max`，只开放读取/搜索工具。两项均在 12 分钟截止时未返回完整报告，已结束该轮执行，未把它们计为审查完成或用作本文结论依据。本文商品图片结论来自主控直接读取源码、GitHub API 与上表中的实际探针结果；未接管或改写用户原有两个交互会话。
