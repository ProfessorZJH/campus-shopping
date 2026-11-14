# 审计日志能力缺口评估（只写不读）

> 日期：2026-11-12。性质：**只读评估**，本轮未实现任何代码。
> 结论：源码盘点有 20 处审计调用、0 个产品读取入口。当前核对的规格要求写入，查询属于能力缺口；这不代表已完成全量合规审查。

## 1. 证据

### 1.1 写入点（20 处，全部为直接调用，无批量）

| 层 | 文件 | 动作 |
|---|---|---|
| case | `MerchantAdmissionCaseImpl:32/40/48/57/75` | `MERCHANT_APPROVED` / `MERCHANT_REJECTED` / `MERCHANT_RESUMED` / `MERCHANT_SUSPENDED` / `MERCHANT_PROFILE_CHANGED` |
| case | `KnowledgeCaseImpl:110/148/167/175` | `KNOWLEDGE_BASE_CREATED` / `AI_EXTERNAL_INDEX_REQUESTED` / `KNOWLEDGE_PUBLISHED` / `KNOWLEDGE_WITHDRAWN` |
| case | `OrderLifecycleCaseImpl:144/224` | `PICKUP_COMPLETED` / `REFUND_APPROVED`、`REFUND_REJECTED` |
| case | `CatalogCaseImpl:129/154` | `PRODUCT_FORCE_UNPUBLISH` / `CATEGORY_CHANGED` |
| domain | `AccessServiceImpl:83/100/116/119` | `MEMBER_INVITED` / `INVITATION_ACCEPTED` / `MEMBER_REVOKED` / `INVITATIONS_CANCELED` |
| domain | `RoleServiceImpl:65/77/91` | `ROLE_CREATED`、`ROLE_CHANGED` / `ROLE_DELETED` / `MEMBER_ROLE_CHANGED` |

调用链：`Case/Domain → IAccessService.audit → IAccessRepository.audit → IAccessDao.audit → iaccessdao_mapper.xml:48 <insert>`。全链路单向，无回读。

### 1.2 读取点为 0

- mapper 层：`sys_audit` 只出现在 `iaccessdao_mapper.xml:49` 的一条 `INSERT`，**没有任何 `SELECT`**。
- `IAccessDao` 只有 `audit(...)` 一个写入方法。
- `campus-shopping-trigger` 中 `audit` 命中数为 0 → **没有 HTTP 入口**。
- `campus-shopping-api` 无审计相关 DTO。
- `frontend/src` 命中数为 0 → 前端无入口。
- 唯一读取者是测试里的原生 JDBC 断言（`CommerceMySqlIntegrationTest:2242-2341`、`MySqlIdentityIntegrationTest:82/90`、`MerchantRbacMySqlIntegrationTest:158-170`）。

### 1.3 索引已经为不存在的查询建好了

```sql
-- campus-shopping-app/src/main/resources/schema.sql:27
KEY ix_audit_merchant(merchant_id, created_at)
```

`(merchant_id, created_at)` 正是"某商户按时间倒序翻页查审计"所需的索引形状。索引建了，查询没写。

同时 `merchant_id` 可为 `NULL`（平台级动作传 `null`：`MERCHANT_REJECTED`、`PRODUCT_FORCE_UNPUBLISH`、`CATEGORY_CHANGED`），所以"平台全局审计"查询用不上该索引前缀——但这部分数据量小，代价可接受。

### 1.4 规格边界：只规定了写

`docs/specs/SDD-RBAC-05.md:61`：

> 所有权限治理操作写入 `sys_audit`；权限变更不能绕过平台角色、知识可见性或交易事务。

只要求"写入"。`docs/database/logical-data-model.md:62` 定义了表结构，同样没有查询契约。所以**没有需求被违反**，这是范围空白。

## 2. 为什么这算问题

1. 出事时无法回答"谁在什么时候通过了这笔退款"。测试能查是因为测试直连 MySQL，运营不能。
2. 数据只增不减、无保留策略、无导出通道 → 一旦需要合规举证或数据迁移，只能连库手工导。
3. `SDD-R1-REMEDIATION-13:43` 明确「审计无原文」原则，但 `detail` 也可能来自用户填写的原因；长度限制不等于脱敏。查询或导出前须重新审查历史数据、权限和字段脱敏。

## 3. 建议方案（未实现）

**最小可用**：一个只读分页查询，不加写入面、不改表、不加迁移。

| 项 | 建议 |
|---|---|
| 权限 | 平台管理员看全部（含 `merchant_id IS NULL`）；商户管理员只看本商户，`merchant_id` 只能取自 URL 当前工作区，不接受请求体传入 |
| 过滤 | `action`（等值）、`target_id`（等值）、`created_at` 区间；按实际查询和数据规模验证索引与执行计划 |
| 排序 | `created_at DESC, id DESC`，游标翻页（与现有列表一致，不用 offset） |
| 字段 | 候选字段 `id/actor/action/target/merchant_id/detail/created_at`；`detail` 限长 1000，展示前仍须审核脱敏与权限 |
| 不做 | 不做修改、不做删除、不做全文检索——审计表必须保持只追加 |

**必须同步改动的位置**（漏一处 CI 就会红）：

1. `scripts/verify-ddd-boundaries.py:69` 的 `OWNERS` 白名单目前把 `sys_audit` 只挂在 `IAccessDao` 下。若新增独立 `IAuditDao`，必须登记该表归属，否则门禁报越界；继续挂在 `IAccessDao` 则白名单无需改动。
2. `python scripts/generate-api-contract.py` + `verify-api-contract.py` + `verify-api-schemas.py`。
3. `scripts/api_response_rules.py`：新增 DTO 的必填字段登记。
4. `docs/api/openapi.json`、`docs/api/http-api.md`、`docs/api/behavior-v1.1.md`。
5. `docs/TRACEABILITY.md`：新增需求行（当前 25 条中无审计查询项）。

## 4. 建议暂缓的理由

这属于**新增业务能力**（新增 API + 新增权限面），不是缺陷修复。按仓库规范，API/权限变化要先补规格或 ADR 再实现；而当前环境无法运行契约生成与集成测试，实现会停在"写完但无法证明"的状态。因此本轮只交付评估。

## 5. 复现方法（供复核）

```
grep -rn "audit" campus-shopping-app/src/main/resources/mybatis/   # 只有 1 条 insert
grep -rn "audit" campus-shopping-trigger/                          # 0
grep -rn "audit" frontend/src/                                     # 0
grep -n "sys_audit" campus-shopping-app/src/main/resources/schema.sql
```
