# Tasks

## 1. 候选端口与快照

- [x] 1.1 新增不可变 `ProductCandidateSnapshot`，仅包含商品 ID 和 ACTIVE SKU ID 列表；通过 `ProductCandidateSnapshotTest` 确认集合不可变、顺序保留且不包含写能力。
- [x] 1.2 新增 `ICatalogCandidateQuery`，提供召回、公开复验和当前报价读取，并让 Catalog 实现复用现有公开召回 SQL/事实复验；通过编译确认没有新增 Bean、DDL 或向量索引路径。

## 2. ShoppingAI 候选链路

- [x] 2.1 修改 `CandidateResolver` 使用窄端口和快照完成 lexical/semantic RRF 融合与 ACTIVE SKU 采样；通过编译和 ShoppingAI 边界回归确认去重、语义降级和缺候选行为保持不变。
- [x] 2.2 保持 `availableOffers`、库存读取、库存过滤、换一个/更便宜约束和报价版本语义；通过 `AiConversationBoundaryTest`、`ProposalProductIdentityTest` 和约束回归确认 Java 事实仍是最终依据。

## 3. 验证与交付

- [x] 3.1 运行候选相关定向 Maven 测试和编译，不运行全量测试；记录 semantic 公开状态/商户停用回归的覆盖范围。
- [x] 3.2 运行 `openspec validate shoppingai-candidate-query-boundary --strict`、`git diff --check`，检查变更未触及 HTTP/DTO/DDL/租约并提交逻辑清晰的 Git commit。
