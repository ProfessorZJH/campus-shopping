# Tasks

## 1. 契约与领域模型

- [x] 1.1 新增 Agent Run、Scope、状态、工具定义和调用结果的不可变 domain 模型，引用现有会话 `turn_token` 租约；单元测试覆盖空值、过期、终态和工具白名单边界。
- [x] 1.2 定义 `IAgentRunRepository`、`IAgentRuntimePort` 和 Case 接口；编译检查确认 domain 不依赖 infrastructure/trigger。

## 2. 持久化与运行生命周期

- [x] 2.1 新增不可变 `ai_run` 与 `ai_run_invocation` MySQL 迁移、PO、DAO 和 Repository；Run 不创建第二种租约；通过 schema contract 验证结构和索引。
- [x] 2.2 实现 Run 创建、幂等去重、租约校验、状态转换和调用结果重放；单元测试覆盖重复请求、过期租约、终态和并发更新失败。

## 3. 只读 Tool Gateway

- [x] 3.1 实现首个 `search_products` 注册表和参数校验；契约边界拒绝未知工具、缺少 query、超限和伪造工具名。
- [x] 3.2 实现商品搜索 Handler，复用候选、报价、库存和实时权限能力；单元测试覆盖消费者公开范围、明确商户范围、越权和资源义务。
- [x] 3.3 在回执生成前复验商品/SKU/商户状态、价格版本和可售库存；Java 单测覆盖下架、停用、缺货和商户过滤。
- [x] 3.4 保证工具调用不写购物车/订单/库存/支付，对重复调用返回原回执；回归测试和 DAO 写入断言确认无隐式写入。

## 4. 集成验证与交付

- [x] 4.1 运行 OpenSpec 严格校验、Java 编译、相关 JUnit、schema contract 和 DDD 边界检查；保存命令与结果，真实 MySQL/凭据专项扫描留待集成阶段。
- [x] 4.2 更新 `docs/testing/` 的 M2 Gateway 报告，明确代码完成、自动测试通过、真实 Python/Milvus 联调未运行的边界，并完成 `git diff --check`。

## Workflow follow-up

- M2 受控 Java/Python HTTP 联调、公开 Trigger 和真实 Milvus/Java 事实复验另开后续变更。
- M3 直接加购及 Action 账本必须经过独立产品审批、事务、权限和幂等验收后再实施。

