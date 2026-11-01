# PR #45 审查收尾 · 2026-11-01

业务目标：解决商品聚合 Product→SKU 与锁定报价 JOIN 的反向锁序风险，以及普通页面 GET+PUT 导致并发增量丢失的问题。沿用 [R1](../specs/RELEASE-01.md) 与[行为契约](../api/behavior-v1.1.md)，无新表、迁移、中间件或通用重试。

本轮在原提交 6013a28 上继续。首版的 10 轮无死锁只代表有限竞争结果，不能排除结构性风险；原报告与 CI 保留历史范围。新增可控交错验证、锁内事实回归、排序回归和增量并发/库存上限回归，最终结果以本报告及新 HEAD CI 为准。

## 验证设计

在真实 MySQL 中暂停已持有 Product 的下架/SKU 停用事务，令结算/增量加购进入锁等待。第三个独立事务以 NOWAIT 探测 SKU，断言消费者尚未抢占 SKU；释放写事务后断言状态复验拒绝、无订单、无购物车新增、无预占。

MyBatis Mapper 的初版 Mockito 钩子误用了抽象方法 callRealMethod，导致测试自身报错，未形成业务结论。已改为继续执行同一 SqlSession 的已注册 Mapper SQL，不替换 SQL 或返回值；旧路径复现在独立 6013a28 副本注入修正测试后运行，不修改当前工作区。

## 旧提交复现

[旧路径证据](evidence/pr45-review-20261101/baseline-red.json)：隔离 MySQL 8.0.31，旧 CatalogRepository、ICatalogDao、Mapper 字节逐一与 6013a28 核对一致，仅注入可控测试。四组均出现 DeadlockLoserDataAccessException（原版普通入口为 cart.set）；因此本次已从结构性风险推进到受控真实复现。修复后普通加购入口改为 cart.add，继续覆盖同一报价锁定链路。

## 实现

CatalogRepository 先用非锁定投影解析不可变归属，再按 ID 锁定所有 Product，然后按 SKU ID 逐行锁定并组装当前事实；移除 DAO 联表查询的锁定参数。商品聚合原有 Product→SKU 加锁路径保留，库存仍最后按稳定 SKU 顺序锁定。

新增 POST /cart 使用独立 CartAddRequestDTO，服务端在购物车锁内累计，再检查库存/99 件上限，失败回滚；PUT 保留目标数量语义。首页与详情页均改用 POST，不再自行 GET 购物车后计算目标量。请求/响应必填约束不削弱，无响应字段改动。

## 测试自身失败与修正

固定实现的首两次全量构建分别出现 3/2 个观测断言失败（264 项，0 error）；诊断运行 4 项同样在 LOCK WAIT 断言失败，均未报告死锁。原因是 20ms 连续读取 INNODB_TRX 保留了 RUNNING 旧快照；改为 200ms 后四组专项 4/4 通过，仍保留原锁等待断言与 SKU NOWAIT 探测。该专项命令本身未运行全套，脚本的总数门禁因此为 FAIL，不能冒充全量通过。各轮摘要见 [验证历史](evidence/pr45-review-20261101/verification-history.json)。

MySQL 提醒事务/锁表与 PROCESSLIST 的数据可能并不同步，诊断不应据单个瞬时字段推断当前拿锁事实，参见 [官方说明](https://docs.oracle.com/cd/E17952_01/mysql-8.0-en/innodb-information-schema-internal-data.html)。

新增双标签页验收首次在 264 JUnit、223 HTTP、9 Redis 双实例均通过后，因 Playwright browser.new_page 的隐式上下文不能再开页而失败。已改为显式共享 BrowserContext，并对其中所有页面收集 JS 错误，未削弱业务断言；最终完整结果见下。

## 实际结果

[最终隔离证据](evidence/pr45-review-20261101/isolated.json)为 PASS，testedSourceMatchesCheckout=true，临时数据库已清理。命令为 `python scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke`，辅助脚本新启随机端口 Redis 并显式配置 REDIS_TEST_ADDRESS，不读取现有业务配置。

| 检查 | 最终结果 |
|---|---|
| Wrapper clean verify / JDK17 / MySQL8.0.31 / 独立 Redis3.2.100 | 264 JUnit，0 失败、0 错误、0 跳过，交易集成 74 项 |
| 四组受控锁序、排序、锁内事实、并发增量与上限 | [专项全部通过](evidence/pr45-review-20261101/fixed-regressions.json)；下架/结算额外竞争 10 轮新增死锁 0 |
| 真实 Spring/MySQL/FastAPI HTTP | [223 项、158 次响应契约通过](evidence/pr45-review-20261101/full-http.json)，本地检索演示 |
| Redis 两 Java 实例 HTTP | [9 项通过](evidence/pr45-review-20261101/redis-shared-http.json) |
| Chromium 真实后端 | [13 项通过](evidence/pr45-review-20261101/browser.json)，无 API mock，双标签页分别 POST 后 1→3；真正同时请求由 MySQL JUnit 覆盖 |
| 格式、UI --check、API/schema、源码边界、领域、供应链、HTTP 正文 | [通过](evidence/pr45-review-20261101/static-checks.json)，95 路由、58 schema、56 领域规则、7 Node 测试 |

首轮新代码 CI（4526d17 / 41268392045）在 current Chromium 契约失败。已读取原始日志，ui_r1_correctness.py:79 的数量断言失败，定位为共享替身未处理 POST。补齐替身的 POST 累计/PUT 目标量，新增页面 POST 断言，同步完整交易浏览器脚本的响应等待方法；[九个契约脚本本地通过](evidence/pr45-review-20261101/browser-contracts.json)。补充只修改浏览器测试及报告，上表实际生产/Java 构建摘要保持一致；不把替身通过当作真实后端通过。

新 HEAD 的完整 CI 结果登记在 PR #45 的“实际测试”表，必须核对该提交，6013a28 的历史绿灯不验证本轮改动。真实外部 AI 验收为 NOT_RUN；未合并或部署。

锁定报价改为按商品/规格逐个主键当前读，数据库往返次数随请求的商品/SKU 数量增长；本轮验证交易正确性，尚未进行性能基准。
