# Tasks

## 1. 基线与重构脚手架

- [x] 1.1 将 `docs/architecture/PRODUCTIZATION-REFACTOR-BASELINE-20261108.md` 纳入本分支并核对链接、主线基线和 Docker 验收的 `IN_PROGRESS` 边界；以 `git diff --check` 和链接目标存在验证。
- [x] 1.2 固化本批次的 ShoppingAI 不变量与现有回归命令，确认 `ShoppingAiCaseImpl` 的租约、取消、SSE、知识指纹和短事务代码在抽取前可定位；以审查记录和基线 Java 测试通过验证。

## 2. 候选解析职责

- [x] 2.1 新增候选解析窄职责组件和不可变结果载体，复用现有召回融合、SKU 采样、报价/库存读取与约束策略；以编译通过和候选顺序、缺货过滤、历史“换一个/便宜点”测试验证。
- [x] 2.2 将 `ShoppingAiCaseImpl` 的等价候选逻辑接入新组件，保持语义召回降级、Java/MySQL 实时库存复验和 `AiQueryEntity` 输入不变；以 Java 边界/提案回归通过验证。
- [x] 2.3 以现有候选/提案边界回归覆盖 lexical/semantic 合并、重复商品、SKU 轮询、零库存和价格约束，并记录本批次不涉及 Python、前端和交易写入；以 Java 全量应用测试通过验证。

## 3. 证据组装职责

- [x] 3.1 新增证据/引用组装窄职责组件，复用知识授权范围和现有引用校验规则；以错版本、错 chunk/hash、内部文档脱敏、未授权文档和公开片段测试验证。
- [x] 3.2 将回答与调试链路接入新组件，保持知识指纹复验、`KNOWLEDGE_NOT_READY`、历史引用失效和安全展示行为不变；以 AI 网关、会话边界和历史引用回归通过验证。
- [x] 3.3 以现有引用版本、权限撤回、历史引用和网关协议回归覆盖 Unicode/NBSP、chunk 边界、内容哈希和批量文档读取；以 Java 全量应用测试和静态检查通过验证。

## 4. 集成门禁与交付

- [x] 4.1 运行 Java 32 项基线回归并确认 0 failures/errors/skipped；命令为 `mvnw.cmd -q -pl campus-shopping-app -am -Dtest=AiConversationBoundaryTest,AiGatewayProtocolTest,ProposalProductIdentityTest,ConversationActivityTest -Dsurefire.failIfNoSpecifiedTests=false -Dfrontend.skip=true test`。
- [x] 4.2 运行 Python 约束/检索/流式最小回归和前端指导脚本，分别确认 120 passed 与 8 checks；不得把受控替身结果扩大为真实 NVIDIA/XFYUN/Milvus 或生产验收结论。
- [x] 4.3 运行 `python scripts/verify-release.py`、API/schema/DDD/static 相关门禁和 `git diff --check`；确认无 API/DDL/凭据/生成副本意外变化，并在变更记录中列明未验证的 Docker 外部范围。

## Workflow follow-up

- 代码、回归和文档任务全部完成后，按仓库审查要求评估是否归档本 OpenSpec 变更；本地归档不代表主线合并或部署完成。
