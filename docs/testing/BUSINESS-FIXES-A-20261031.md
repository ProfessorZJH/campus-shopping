# PR-A：退款裁决与商户状态幂等 · 2026-10-31

基线为已合并 PR #16～#21 的 `730c20d`。本批只处理 BUG-01、BUG-02，沿用 RELEASE-01 的“商户拒绝后买家申诉，平台裁决”规则；不扩大为接口重构。

平台开始裁决必须为 DISPUTED，由 AfterSaleAggregate 校验；商户重复驳回不保存售后、不重复审计。已批准且订单已退款的同意请求继续成功重放。平台驳回后的重复裁决返回 T0004（无副作用），因为 REJECTED 不是待裁决状态。商户 changeStatus 返回实际变化与否，Case 仅在变化时审计；原商户行锁、权限、原因校验和事务不变。

HTTP URL、DTO、数据库字段和状态编码不变，无迁移。内部 Java changeStatus/rejectAfterSale/reject 返回 boolean；全部调用者一并编译。

## 实际验证

使用全新临时 MySQL 8.0.31、随机端口独立 Redis 3.2.100，未读取 .env、未连接现有业务库/6379、未替换服务。命令入口：`python var/run-remediation-isolated.py docs/testing/evidence/business-fixes-a/mysql.json`；包装器启动独立 Redis，并运行仓库 `verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke`，最后停止测试实例。

- Maven clean verify：225 项，零失败/错误/跳过；包括并发重复裁决、停用/恢复 version 与审计次数，以及售后、履约、库存、退款、订单、审计六个步骤实际写入后故障的全事务回滚。
- 真实 Spring/MySQL/FastAPI HTTP：199 项通过；新增平台越过申诉、商户争议中审核、申诉后平台裁决及重复同意场景。AI 为本地检索。
- 双 Java 共享隔离 Redis：9 项通过；真实 Chromium 页面：8 项通过。
- API契约、58项schema检查、源码/DDD、56项领域规则及可读性检查通过。UI快照检查发现本地旧工作区占位SVG残留CRLF（Git中为LF），最终批次用生成脚本同步复查。

[最终原始汇总](evidence/business-fixes-a/mysql.json)包含源码摘要一致性、交付物和临时库清理结果。[首轮失败](evidence/business-fixes-a/mysql-initial-failure.json)为新增故障注入测试配置经过MANDATORY代理，225项中6错误；修正为代理内spy后重跑通过，没有降低事务规则或断言。原始Maven日志仍在本机临时目录，包装器输出在忽略目录 var/remediation-a.log。

代码及本地列明范围验收通过；远端最终HEAD CI见本批PR。远程模型/Milvus、生产HA、性能未验收。PR-C/PR-D继续保留为后续治理项。
