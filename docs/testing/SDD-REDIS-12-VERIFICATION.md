# SDD-12 实际验证 · 2026-10-31

最终实现已通过本轮本地隔离验收。本报告不引用历史验收为本轮通过。规格：[SDD-12](../specs/SDD-REDIS-12.md)；运行与迁移：[手册](../operations/REDIS-12-runbook.md)。

后续经用户授权，已完成既有本机业务库备份恢复演练、显式升级与本机 Redis/真实模型/浏览器交易验收，详见[本机升级报告](SDD-REDIS-12-LOCAL.md)。下文“未迁移既有库、未调用真实模型”仍描述本次隔离验收本身，不覆盖后续独立阶段。

本轮不连接既有业务MySQL，不读取本地 .env、不调用真实模型或修改Milvus集合。Redis使用本机服务上的随机测试命名空间，未执行FLUSHDB/FLUSHALL、未更改现有Redis配置。双实例身份验证采用真实Spring HTTP、真实Redis与H2身份夹具；库存/订单/会话租约/配额采用真实临时MySQL，不能混淆两个证据层级。

原始失败与修复原因：[failed-rounds.json](evidence/redis-12/failed-rounds.json)。源码变化期间的构建不能作为最终版本通过，最终结果以 [mysql.json](evidence/redis-12/mysql.json) 的 testedSourceMatchesCheckout 和JUnit统计为准。

## 已实现的契约

共享Spring Session和JSON上下文序列化、登录换ID和CSRF、共享来源/账号/AI/核销限额、独立缓存客户端与显式JSON展示投影、提交后失效与缓存降级、Java可过期准入和Python实际执行上限、索引锁、MySQL会话owner租约及过期写入拒绝、知识库原子全局配额、库存只读权限与撤权、失效候选过滤、售后锁定事务约束。

Compose新增独立安全/缓存实例，凭据生成和CI服务已更新；现有私有配置没有被覆盖，现有业务库没有被迁移。生产使用需备份并维护窗口显式迁移。

## 验收范围

最终 Maven clean verify：**121通过、0失败、0错误、0跳过**；其中身份双实例测试使用H2身份库+真实Redis，其余MySQL测试使用全新临时MySQL。Python：**44通过**。真实 Spring/MySQL/Redis/FastAPI HTTP：**173项通过**；严格响应117份通过；真实Chromium浏览器8项通过，无API mock。AI为本地检索，本轮未调用真实供应商。

格式检查、API契约、41项响应Schema检查、数据库迁移新库/重放/校验和、DDD边界与静态发布门禁通过。dependency:tree 确认 Redisson4.8.0 仅使用 redisson-spring-data-34，Spring Data Redis3.4.3 / Spring Session3.4.2。Compose config检查通过，容器运行NOT_RUN。

[汇总](evidence/redis-12/summary.json) · [隔离MySQL与HTTP原始结果](evidence/redis-12/mysql.json) · [最终源码摘要](evidence/redis-12/tested-sources.json) · [发布清单](evidence/redis-12/tested-release-manifest.json) · [Redis原始JUnit](evidence/redis-12/TEST-cn.bugstack.ai.test.identity.RedisInfrastructureIntegrationTest.xml) · [双实例原始JUnit](evidence/redis-12/TEST-cn.bugstack.ai.test.identity.RedisSessionCrossInstanceTest.xml)

最终 testedSourceMatchesCheckout=true，临时数据库已清理。已测 JAR 与生成清单保存在 var/redis-sdd/verified-build；不会覆盖旧的运行服务或现有业务库。新增迁移尚未在用户业务库执行。

本轮完成的故障场景包括测试客户端连接关闭后的缓存降级、安全限流失败关闭、AI准入拒绝及索引任务跳过；通过真实HTTP验证Session依赖失效返回503。通过真实旧Cookie重放验证注销，登录前后Cookie ID变化和旧CSRF失效均有断言。配额测试在999个知识库时并发创建只允许一个成功。Python报告：[python.xml](evidence/redis-12/python.xml)。格式、API、schema与领域边界静态检查单独记录，不能替代真实事务或网络验收。

Docker Engine本机未运行，Compose仅配置检查，容器启动与故障转移为NOT_RUN；GitHub Actions工作流已更新但未触发远程执行。真实模型、Milvus/Qdrant、生产HA和性能本轮NOT_RUN。支持多个Java连接单Python；多Python副本和跨主机上传存储未验收。Redis故障测试关闭的是测试客户端连接，不能据此声称覆盖物理断网、主从切换、AOF数据丢失或网络分区。
