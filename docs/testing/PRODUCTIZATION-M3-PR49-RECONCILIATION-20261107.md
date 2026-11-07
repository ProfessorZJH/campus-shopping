# M3：PR #49 与提案商品身份改造衔接记录（2026-11-07）

## 核对范围

本记录对应 `productize-campus-shopping-experience` 的任务 4.1 与 4.2，基于当前远端主干 `origin/main` 的 `6f47a6c`。当前主干已经包含 M2 PR #57 的合并提交 `843a9d1` 及其后续文档 PR #58；本分支在实现提案商品身份后合并了该主干，未继续使用旧的 M2 验证结论作为当前基线。

PR #49 对应分支 `codex/shoppingai-rag-corrections`，当前本地可见提交为 `639c9a3`，相对 `origin/main` 的差异为 69 个文件、2111 行新增、126 行删除。分支不是当前主干的祖先，接口返回状态为 open、base 为 `main`、mergeable 状态为 dirty，因此没有将它整体合入本批改动。

## 有效审查意见与重叠面

PR #49 的审查记录以 COMMENTED 形式存在，没有可复用的正式 APPROVED 结果。与本批最相关的审查意见及后续处理包括：

- `ShoppingAiCaseImpl` 的跟进语义应取最新展示提案，而不是只取 `PENDING` 提案；PR #49 的后续说明称已在 `639c9a3` 处理。
- 生产商品报价需要保留结构化属性，不能在生产路径统一写成空属性；该项仍属于 PR #49 的检索/约束改造范围。
- 引用外发、旧协议字段默认值、复合数词、Unicode 空白、证据块级召回及显式迁移等意见在 PR #49 的后续评论中分别登记了处理提交，但这些结果不替代当前分支的 M3 验证。

与本分支文件重叠的 PR #49 文件只有：

- `campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/ShoppingAiCaseImpl.java`
- `campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/shoppingai/service/RecommendationPolicy.java`

本批保留可信 `productId`、旧 `items_json` 批量解析、详情可用性语义和 DTO/UI 契约；PR #49 的检索、引用和约束行为没有被复制或假定已经整合。后续若合并 PR #49，需要对上述两个重叠 Java 文件逐段重放规则，再重新运行本批定向 Java、API 和前端检查。

## 当前批次验证

- Java 定向组：`ProposalProductIdentityTest`、`DddRulesTest`、`AiConversationBoundaryTest`，23 项通过，0 失败、0 错误、0 跳过。
- API/静态边界：生成契约、API 契约、Schema、Release 验证均通过。
- 前端定向组：Prettier、TypeScript、UI bundle 生成与 `--check`、导购会话 6 项、三页面 23 项、前端契约 20 项、RBAC 回归 14 项均通过。

PR #49 未在本分支执行合并或部署；其远端 CI/审查状态不作为本批通过条件。
