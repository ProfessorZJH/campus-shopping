# Tasks

## 1. Java 只读契约与领域 Port

- [x] 1.1 在 domain 定义版本化 `knowledge_qa`、`get_my_orders` 不可变输入/输出模型，限制问题、状态、分页和摘要字段，并用 JUnit 覆盖空值、超长值、边界值、只读标记和不可变集合。
- [x] 1.2 增加消费者只读 Case Port，保持 domain 不依赖 Spring、HTTP、Jackson 或 Python；运行模块依赖检查并确认没有新增公开 Trigger。

## 2. Java Case 权限与事实链路

- [x] 2.1 实现 `knowledge_qa` 消费者只读链路，读取当前 actor 的知识 scope，调用检索引擎，校验回答和引用；覆盖普通消费者、撤销/下架期间 scope 变化、越权引用和 AI 不可用。
- [x] 2.2 实现 `get_my_orders` 的 actor buyer 约束与窄摘要映射；覆盖跨用户/商户参数拒绝、分页/状态边界、空结果和无购物车/订单/库存/支付写入。
- [x] 2.3 将两个 Case 接入现有 Run capability、工具白名单、调用幂等信封和 round-trip 限制；Python schema 同步前保持新工具关闭，并用 Java Case 测试重复 key 重放和不同载荷冲突。

## 3. Runtime 协议同步

- [x] 3.1 在 Python Runtime 注册两个只读 JSON Schema、参数校验、版本号和结果 fixtures；pytest 覆盖原生 Tool Calling、未知/缺失参数、伪造文本、超时、429/5xx 和脱敏。
- [x] 3.2 让 Java Tool Gateway 与 Python fixtures 共享工具名、字段和错误分类；loopback HTTP 测试验证 schema mismatch 安全失败，并保持 `search_products` 兼容。

## 4. 真实验收与交付门禁

- [x] 4.1 在隔离测试依赖上验证消费者知识/订单只读链路、Run 租约、幂等、权限边界和无交易写入；缺少 Java、MySQL、Runtime 或真实模型时记录 `NOT_RUN`/`DEGRADED`。
- [x] 4.2 运行目标 Maven JUnit、Python pytest、`python scripts/verify-release.py`、`git diff --check` 和 OpenSpec strict 校验；在 `docs/testing/` 记录命令、版本、范围、失败矩阵及未验证的 NVIDIA/讯飞/Embedding/Milvus 证据。

## Workflow follow-up

- 通过产品/安全评审并获得实施授权后，按任务 1 → 2 → 3 → 4 分批 apply；Python 同步完成前不得启用新工具。
- 所有任务完成并同步验收证据后再 archive；OpenSpec 完成不等于生产、性能或外部模型验收通过。
