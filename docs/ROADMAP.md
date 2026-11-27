# 当前状态与剩余工作

> 更新日期：2026-11-27。本页替代早期“下一批/已完成阶段”流水账；历史验收仍见 `docs/testing/`。

## 已完成的主线能力

- Java 七模块模块化单体：身份、商户、商品、库存、交易、履约、购物 AI 七个上下文及跨域 Case。
- 消费者、商户、店员和平台管理员主链路：注册会话、CSRF、入驻审核、RBAC、商品与 SKU、购物车、幂等下单、模拟支付、备货、自提核销、未提货退款与争议。
- Redis/Redisson 共享会话、限流、展示缓存和资源准入；支持多个 Java 实例共享同一 MySQL/Redis，Python 服务当前按单实例设计。
- 商品全量词面召回、可选 Milvus 语义投影、Java 实时事实复验、知识引用白名单、完整 JSON 与独立 SSE 导购入口。
- 自动生成 API、数据库指纹、供应链、Mapper、DDD 边界、UI 可复现构建、Java/Python/浏览器与隔离 MySQL/Redis 门禁。

最近一次记录在案的全栈范围见[答辩前综合修复](testing/DEFENSE-REVIEW-FIXES-20261118.md)与[全链路 UI/UX 验收](testing/UX-CONVERGENCE-POLISH-20261118.md)。这些结果只代表对应提交和环境。

## 尚未完成或仍需单独验收

### P0：正式 AI 质量结论

- `campus-shopping-v2`（360 条主场景 + 24 条 `UNSUPPORTED` 挑战场景、480 商品 / 1,020 SKU / 80 知识版本）与 `campus-shopping-v1`（120 例历史基线）当前均保持 `DRAFT`，需人工复核 `cases`/`qrels`、裁决争议样本（V2 共 22 条争议样本）后方可冻结为 `ACCEPTED`。
- 需人工复核回答断言支撑性（`citationGrounded`）、推荐解释与语义级隐式泄漏，再基于已保存结果重算正式配对报告。
- V2 已完成本地、受控、独立 SSE 流式首字延迟（`S-SSE`）及隔离真实 MySQL 召回复验与 10 项事务/权限安全套件；V2 上的真实外部 Embedding、真实 LLM 与真实 Milvus 实验仍待单独预算与凭据授权执行（保持 `NOT_RUN`）。

对应入口：[评测说明](../ai-service/evaluation/README.md)、[V2 实验报告](testing/AI-EVALUATION-V2-20261127.md)、[Benchmark V2 变更任务](../openspec/changes/campus-shopping-benchmark-v2/tasks.md)、[V1 历史评测变更](../openspec/changes/evaluate-shopping-retrieval-recommendations/tasks.md)。

### P1：生产化与运行治理

- 生产 HTTPS/可信反向代理、网络策略、密钥轮换、备份恢复演练和灾备。
- 持续负载、容量上限、SLO、故障注入和生产级可观测性；现有 80 请求测试与隔离容器验收不等同生产压测。
- 多 Python 副本及其共享状态/幂等协调；当前仅支持单 Python 服务。
- 七牛正式 HTTPS 域名、浏览器展示与备案边界仍需按实际环境验收。
- 平台/商户审计目前只有写入，没有产品查询与导出入口；若需要，应作为新增 API/权限能力立项。

### P2：可选产品演进，不阻塞当前交付

- Agent v1.1 基础协议与只读工具已实现，公开入口和产品化策略仍默认关闭。
- 可将大页面热点继续拆为 Vue SFC/TypeScript，仅为可量化维护收益，不做全仓重写。
- 可继续收窄 `ICatalogService` 等宽接口，但应先有查询成本、并发或职责变更证据。

## 明确不在当前范围

真实资金支付与清结算、物流配送、跨商户合并支付、优惠券/秒杀/积分、评价社区、买卖双方即时聊天、扫描 PDF OCR、已提货退货、部分退款和自动合并/部署。

## 交付判定

“代码完成”“自动/自动化测试通过”“列明范围业务验收通过”是不同状态。当前项目只能按最新提交、实际环境和证据逐项声明；CI 绿色、旧报告或生成文档都不能自动扩大验收范围。
