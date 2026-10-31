# SDD-12 Redis 运行与回退

正常启动默认启用 Redis。共享身份和限流使用安全实例，公开展示使用缓存实例；建议分别部署，安全实例 noeviction + AOF everysec，缓存实例 allkeys-lru。Compose 已提供两个不公开端口的实例及健康检查。现有 .env 不自动覆盖，应把 .env.example 新增字段合并到本地私有配置；密码不要提交或打印。

## 本地配置

配置 REDIS_SECURITY_ADDRESS、REDIS_SECURITY_PASSWORD、REDIS_CACHE_ADDRESS、REDIS_CACHE_PASSWORD 和不同环境的 REDIS_NAMESPACE。默认分别为本机6379/6380。已有的本机6379不会被脚本清空或重配；如只有一个 Redis，可在开发配置中让两个地址指向它，但这仅是命名隔离，无法提供容量隔离。生产跨主机使用 rediss/TLS 和独立 ACL。未经可信代理配置，保持 forward-headers-strategy=none，不能信任来源转发头。

REDIS_ENABLED=false 仅用于单实例开发和隔离测试。运行过程中 Redis 不可用不会自动切换到内存。切换会话存储会要求重新登录；保留 JSESSIONID 不能迁移旧的 JVM 会话。Session 为 Spring Security JSON 序列化，命名空间隔离，不应由任意其他应用写入。

## 数据库升级

先备份现有业务库，在维护窗口运行 python scripts/migrate-database.py（参数见该脚本 --help），应用启动前核验迁移历史。新增 V20261031_01 为对话 owner/到期时间和知识库配额计数；不修改订单、价格、库存或权限数据。不能在运行应用时对业务库执行测试或清表。数据库创建知识库时同事务原子领取全局1000配额；直接手工导入必须维护配额计数，否则应暂停写入核对后修复，不能在线重置配额。

## 限额与故障

登录来源300次/分钟、账号30次/分钟；注册来源30次/5分钟；AI每用户10次/分钟及全局120次/分钟；核销每操作人60次/分钟及每商户300次/分钟。均为初始配置而非容量压测结论。OVERALL共享额度使用短期状态，超限429/A0007/Retry-After，安全依赖不可用503。校园NAT仍需要按真实流量评估来源阈值。

Java请求准入默认4，许可180秒，大于网关每次调用最大120秒。Python实际执行容量由 AI_MAX_CONCURRENT_REQUESTS（默认4）控制，执行真正结束才释放。Java超时不代表模型取消。本次支持多个Java连接单Python；多Python副本、共享SQLite或跨主机上传存储另需部署设计。所有Java实例必须使用相同准入容量；容量变更需排空在途任务后统一切换，不能并行运行不同容量配置。

MySQL对话租约900秒。崩溃后等待到期可重试；过期owner不能写消息/提案，也不能释放新owner。网络故障释放失败依靠到期恢复。索引任务使用非阻塞锁和watchdog，数据库事实复验、幂等索引和下轮重试始终保留。

展示缓存只有显式JSON投影；商品Key带实时数据库版本，类目10分钟、商品约40秒、商户90秒并带抖动。提交后失效失败不改变业务提交结果，短TTL限制陈旧时间；缓存故障短超时回退数据库并记录计数。AOF everysec不保证故障转移中的零数据丢失，生产HA、注销耐久性和峰值容量需单独验收。

## 验证

真实Redis测试需设置 REDIS_TEST_ADDRESS（及可选 REDIS_TEST_PASSWORD）。每次使用随机cs:test命名空间，不使用FLUSHDB/FLUSHALL，不输出凭据。Spring安全隔离测试显式关闭Redis；RedisSessionCrossInstanceTest启动两个真实HTTP实例，身份测试使用H2，不把它当作MySQL事务证据。交易和租约证据来自全新临时MySQL。

Windows复现：设置 REDIS_TEST_ADDRESS=redis://127.0.0.1:6379 和 MAVEN_OPTS=-Dpython.executable=python，然后运行 python scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke --artifact-dir var/redis-sdd/verified-build --output docs/testing/evidence/redis-12/mysql.json。脚本仅操作全新临时库，结束清理。Python执行 cd ai-service && python -m pytest -q。发布还须执行格式、API、边界和schema检查。

Docker Compose与GitHub Actions需分别真实运行后记录证据。CI已加入Redis服务和测试；更新工作流不等于远程CI已经通过。
