# P1 · 身份权限与商户入驻验收契约

> **R1 对齐说明（2026-10-28）**：本文保留需求来源与历史设计；当前冻结规则以 [R1 实施规格](../specs/RELEASE-01.md) 为准，实际实现/验证状态见 [R1 交付清单](../DELIVERY-R1.md)。历史“下一批/待开发/已通过”描述不作为本次执行证据。

> 版本：v1.0 · 2026-10-26  
> 状态：**实现前的验收基线**。所有测试目前属于“计划”，不得宣传为已通过。  
> 相关设计：[Identity](identity.md) · [Merchant](merchant.md) · [PRD](../requirements/PRD.md)

## 1. P1 业务完成标准

**注意：当前仅有独立 dev 商户提交练习，尚不能勾选任何完整 P1 用例已通过。** 该练习只接受 `merchantName`、返回 `SUBMITTED`；以下是完整 P1 待完成的验收契约。业务异常要结合 `Response.code` 判断；未认证/越权路径由安全层按 HTTP 401/403 等处理。

用户可注册、登录；管理员权限通过安全初始化产生.用户能提交入驻申请并查询审核结果。平台管理员能审核通过/驳回；通过后一次事务开通 Merchant、首个 Store、申请人的 OWNER 授权。店员授权 P1b 完成邀请、接受、撤销。所有后端接口按身份与商户范围校验。

**P1a 纵切**：注册 → 登录 → 提交申请 → 平台审核 → 开通商户/门店 → 授予 Owner → 登录后查询本人商户。  
**P1b 纵切**：Owner 邀请 Clerk → Clerk 接受 → Clerk 查看本商户授权 → Owner 撤销 → Clerk 的后续敏感操作被拒绝。

## 2. 测试角色与数据准备

| 测试主体 | 初始授权 | 备注 |
|---|---|---|
| consumerA | 普通账号 | 申请商户 A |
| consumerB | 普通账号 | 申请商户 B；不应读到 A 申请 |
| adminA | PLATFORM_ADMIN | 通过受控初始化得到平台权限 |
| adminB | PLATFORM_ADMIN | 用于并发审核冲突测试 |
| ownerA | 商户 A OWNER | 可以使用 consumerA 授权后的同一账号 |
| clerkA | 商户 A CLERK | P1b 接受邀请后生效 |
| outsider | 无商户授权 | 用于越权读写测试 |

数据库准备不使用提交到仓库的固定明文密码；测试环境应使用独立数据集并在结束后清理。

## 3. P1a 必须通过的验收用例

| ID | Given（前置） | When（操作） | Then（预期） | 测试级别 |
|---|---|---|---|---|
| P1-A01 | username 尚不存在 | 注册有效账号 | 返回用户标识；密码仅安全摘要入库；状态 ACTIVE | API + 数据库 |
| P1-A02 | username 已存在 | 并发重复注册 | 最多创建一个账号；其他请求得到明确冲突 | MySQL 并发 |
| P1-A03 | 普通账号已注册 | 登录 / 登出 | 登录建立有效会话；登出后不能继续访问受保护接口 | HTTP 集成 |
| P1-A04 | 普通账号登录 | 访问平台审核接口 | 返回无权限，数据库无变化 | 授权集成 |
| P1-A05 | adminA 已是平台管理员 | 提交入驻申请后审核自己 | 本人审核被拒绝，申请仍待审 | 授权集成 |
| P1-A06 | consumerA 已登录 | 提交合法申请 | 返回 SUBMITTED 且申请人等于当前主体 | API/Domain |
| P1-A07 | consumerB 已登录 | 查询 consumerA 申请详情 | 不返回申请人私人资料或审核信息 | 授权集成 |
| P1-A08 | adminA 审核 consumerA 申请 | 通过申请 | Merchant、首 Store、Owner 关系及审核事实全部存在 | MySQL 集成 |
| P1-A09 | 申请已 APPROVED | 重复相同通过请求 | 返回既有商户结果，无重复 Merchant/Store/Member | 幂等集成 |
| P1-A10 | 申请待审 | adminA 通过与 adminB 驳回并发 | 只有一个决定生效；不出现通过又驳回 | MySQL 并发 |
| P1-A11 | 申请待审 | 审核开通时模拟 Owner 授权存储失败 | 申请、商户、门店、成员写入全部回滚 | 事务集成 |
| P1-A12 | 申请待审 | 平台驳回并填写原因 | 记录 REJECTED 与非空原因，申请人可查 | API/Domain |
| P1-A13 | 申请已 REJECTED | 再试图直接通过旧申请 | 拒绝；不会创建商户 | Domain + API |
| P1-A14 | 用户属于商户 A OWNER | 查询其他商户的经营后台 | 不暴露其他商户私有信息 | 授权集成 |
| P1-A15 | 商户处于 ACTIVE | 平台管理员停用商户 | 状态 SUSPENDED；新的经营操作被禁止，历史不删除 | Domain + API |
| P1-A16 | 用户被禁用 | 保留原浏览器会话请求敏感写接口 | 拒绝，不依赖前端退出按钮 | 授权集成 |

## 4. P1b 员工邀请与权限用例

| ID | 前置 | 操作 | 预期 |
|---|---|---|---|
| P1-B01 | ownerA 登录 | 邀请注册用户 clerkA | 创建仅属于商户 A 的待确认邀请 |
| P1-B02 | clerkA 登录 | 接受自己的有效邀请 | 成为商户 A CLERK，不获得其他商户权限 |
| P1-B03 | outsider 登录 | 接受 clerkA 的邀请 | 拒绝，不产生授权 |
| P1-B04 | 有效邀请已被接受 | 重复接受 | 不重复新增成员，不重复授权 |
| P1-B05 | ownerA 登录 | 撤销 clerkA | 成员失效；后续操作立即拒绝 |
| P1-B06 | clerkA 登录 | 访问 Owner-only 邀请/撤销 API | 403，成员数据不变 |
| P1-B07 | ownerA 同时拥有商户 B CLERK 身份 | 管理商户 B 成员 | 仍被拒绝，无权限蔓延 |

## 5. 领域与数据库测试最低集合

**纯领域单测**：

- MerchantApplication 从 SUBMITTED 只能进入 APPROVED 或 REJECTED 一次。
- MerchantApplication 申请人不得审核自己的申请。
- Merchant ACTIVE/SUSPENDED 的合法转换。
- MerchantMembership 的 OWNER/CLERK 范围和撤销规则。
- 邀请不能由非目标用户消费、不可重复接受、过期不能消费。

**MySQL 集成测试**：

- 申请请求幂等唯一索引。
- 商户 `source_application_id` 唯一索引。
- 成员 `(merchant_id,user_id)` 唯一索引。
- 审核并发竞争、事务回滚、申请到商户/门店/Owner 的一致性。

**架构测试**：

- Domain 不直接引用 MyBatis Mapper/PO、Spring Web 或 Infrastructure。
- Repository/Port 在 Domain 定义，实现位于 Infrastructure。
- 跨领域 Case 只能调用公开业务能力，不直接查询 Identity、Merchant 的 Mapper。
- 领域方法使用中文业务注释解释约束，而非只有英文类名翻译。

## 6. 交付检查（Definition of Done）

- [ ] P1a API、聚合行为、Repository、数据库迁移和页面/接口调用全部完成。
- [ ] 注册/登录/退出、平台管理员安全初始化可用，无默认仓库明文密码。
- [ ] 审核通过同事务生成商户、门店、Owner，完成双管理员竞争测试。
- [ ] 身份与商户授权检查由真实后端执行，覆盖非本人审核与越权查询。
- [ ] P1b 邀请/接受/撤销链路（若本批交付）通过对应测试。
- [ ] `mvn clean verify` 在真实 JDK 17 环境成功；失败项有明确说明。
- [ ] MySQL 8 实库集成测试完成，测试用例与结果可追溯。
- [ ] 同步更新 PRD/领域文档、API 接口文档和数据库迁移说明。

## 7. 本阶段不验收的事项

商品销售、真实库存、订单与支付、到店核销、退款、RAG 及 AI 模型推理不计入 P1 完成率。P1 必须为这些领域提供**可信的身份、商户与门店主数据**，但不需要预先制造空控制器、空 Repository 或七个领域的全部数据表。
