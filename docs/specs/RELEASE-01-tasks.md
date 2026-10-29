# R1 SDD 任务与执行记录

规格：[RELEASE-01](RELEASE-01.md)。需求来源：[PRD](../requirements/PRD.md)。执行证据：[R1验证](../testing/R1-verification.md)。

## 规格修订
- [x] 明确完整申请资料、审核开店事务、Owner授权、24小时邀请。
- [x] 明确商品规格/报价版本、库存锁序、15分钟关单、模拟支付、自提令牌、退款互斥。
- [x] 明确AI可见白名单、版本、提案10分钟、真实/演示模式和未实现的SSE。
- [x] 以当前API与DDL替换冲突历史设计的运行依据。

## 实现
- [x] 身份、商户、商品、库存、交易、履约、AI七个领域源码。
- [x] 跨领域Case事务、31张表、Mapper与API/Trigger。
- [x] 消费者/商户/平台三端Vue交互及本地静态资源。
- [x] Python检索/模型客户端、知识权限与文档解析。
- [x] Docker、CI、随机凭据、真实HTTP和MySQL测试入口。

## 实际执行与纠错
- [x] 生产纯领域规则与库存随机序列检查。
- [x] 生产HTTP正文大小/超时真实本机检查。
- [x] FastAPI单测、Uvicorn本机HTTP、8样本检索评测。
- [x] 真实Chromium+Vue契约替身测试；修复列表key与过期请求回写。
- [x] 代码语法、内部接口、Mapper/DDL、文档链接检查。
- [ ] Maven完整依赖解析与编译、全部JUnit。
- [ ] MySQL真实并发与事务回滚。
- [ ] Java/Python/MySQL实际完整HTTP与浏览器验收。
- [ ] Docker构建启动与外部LLM/Embedding/Qdrant。
- [ ] 生产安全、性能、备份恢复。

没有执行的复选框必须保持未勾选；不得因为源码或测试方法存在就标记为通过。

## SDD-02：界面与读模型补丁（2026-10-28）

- [x] 对照当前 API、DOM 和 DDL，修复 A01-A05/B01-B05 的源码缺口。
- [x] 新增订单历史图片快照列，编写旧库增量迁移及同步新库 DDL。
- [x] 添加 `PageResponseDTO` 和 Count 查询、逐页 UI，保留旧 List API 兼容。
- [x] 完成离线 Vue 编译、语法与静态检查、明确标识为替身的 Chromium 回归。
- [x] 追加旧订单无图时禁止使用新商品图片回查的浏览器回归，修正商户页签总数为服务端 total。
- [x] 增加无依赖 Java 17 分页/快照模型检查与迁移 SQL、DTO/Mapper 字段核对。
- [ ] Maven/JUnit 完整构建。
- [ ] 真实 MySQL 迁移和新旧订单快照读取验证。
- [ ] Spring Boot + 前端 Cookie/CSRF + AI 服务完整集成验收。

证据：[`docs/testing/SDD-INTEGRATION-02-VERIFICATION.md`](../testing/SDD-INTEGRATION-02-VERIFICATION.md)。
