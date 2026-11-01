# Redis 缓存与隔离整改 · 2026-11-01

## 目标、范围、不变量与验收标准

修复商户旧值晚回填和损坏 JSON 不自愈，类目改为直接查询 MySQL；prod 启动拒绝安全 Redis 与展示缓存指向同一解析 IP/端口。复用现有框架、数据库版本字段及事务，不新增迁移，不修改已确认正确的 context-path 过滤逻辑。

MySQL 继续裁决状态、权限、价格和交易。商户资料/状态更新原 SQL 已递增版本，Case 原事务同时更新商户和门店；展示请求先查询状态/版本，再使用版本 Key。旧 Key 自然过期。JSON 损坏以 compareAndSet 原值删除，再 setIfAbsent 带 TTL 回填；读取 Redis 失败直接回源，不重试 Redis。保留失败计数和安全诊断。Session 默认仍为30分钟，测试通过 server.servlet.session.timeout 缩短到30秒。

验收要求：旧请求晚写回不能污染新版本；损坏 JSON 能恢复且不删除/覆盖并发新值；回滚不能改变商户展示版本；双 Java 的共享 Session 在空闲后拒绝旧 Cookie；来源登录300/60、注册30/300返回429/A0007/Retry-After；真实独立 Redis 服务端故障互不影响。规则归属 [SDD-12](../specs/SDD-REDIS-12.md)。

## 环境与命令

基于 origin/main `015c6b8` 的 `codex/redis-cache-remediation`。Windows Java17 / MySQL8.0.31 临时数据目录，WSL 从 Redis7.4.2 源码构建两个隔离实例（16479 / 16480），随机命名空间，无既有业务库、无全库清理。服务端故障用例额外启动并只关闭自己拥有的 Redis 子进程。

```powershell
$env:REDIS_TEST_ADDRESS='redis://127.0.0.1:16479'
$env:REDIS_TEST_CACHE_ADDRESS='redis://127.0.0.1:16480'
$env:REDIS_TEST_SERVER_COMMAND='["wsl","-d","Ubuntu","--","/tmp/campus-redis-build/redis-7.4.2/src/redis-server"]'
$env:MAVEN_OPTS='-Dpython.executable=python'
./mvnw.cmd -B -ntp -pl campus-shopping-app -am test '-Dtest=Redis*Test' '-Dsurefire.failIfNoSpecifiedTests=false'
python -X utf8 scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke --artifact-dir var/redis-remediation-build --output docs/testing/evidence/redis-remediation-20261101/mysql.json
npm run format:check --prefix frontend
python scripts/verify-release.py
python scripts/verify-java-readability.py
python scripts/verify-domain.py
python scripts/verify-api-contract.py
python scripts/verify-api-schemas.py
python scripts/schema_contract.py --check
# ai-service 目录
python -m pytest -q
```

REDIS_TEST_SERVER_COMMAND 是测试启动命令的 JSON 数组；CI 使用固定摘要 Redis 镜像的 docker run --rm --network host。仅测试类使用该变量，正常应用不执行它。脚本配置两个 Redis 时强制提供独立的本机测试地址。

## 执行记录

- 专项 Redis 测试首轮缓存用例通过；来源限流顺序请求因密码校验耗时跨过60秒窗口而失败。改为12并发、不同账号，并保留精确的300额度及窗口断言；复验通过。未放宽阈值或跳过鉴权。
- Session 测试为两个真实 HTTP Java 实例 + 两个真实 Redis，身份数据使用 H2；不能据此声称 MySQL 并发通过。单独的 CommerceMySqlIntegrationTest 覆盖真实 MySQL/Redis 商户晚回填、版本递增与事务回滚。
- 注册限流通过非法业务输入避免创建批量测试账号，前30次到达 Controller 并返回业务拒绝，第31次由来源限流返回429；不是30次成功注册的验收。
- 首轮真实 MySQL 全量运行273项，新增缓存测试因对 MyBatis 动态代理调用 callRealMethod 未进入暂停点而失败，其余272项无失败/跳过。改为独立 SqlSession Mapper 执行真实 SQL后重跑；保留 [首次汇总](evidence/redis-remediation-20261101/mysql-first-attempt.json) 和 [失败断言](evidence/redis-remediation-20261101/mysql-cache-first-attempt.txt)。
- 最终 `clean verify`：273项、0失败、0错误、0跳过；其中真实 MySQL 交易测试75项，缓存并发4项、配置2项、服务端故障隔离2项，以及共享 Session/额度测试全部通过。
- 真实 Java/MySQL/FastAPI HTTP：223项通过；双 Java/MySQL/Redis HTTP：9项通过（含账号31次限流尝试）；真实浏览器13项通过、无 API mock。Python：211项通过、1条既有依赖弃用警告。
- 格式、源码/DDD边界、56项领域规则、API生成契约、58项响应schema与数据库版本/校验和检查通过；本轮没有 API 或迁移变更。
- [最终汇总](evidence/redis-remediation-20261101/mysql.json) 与 [已测源码摘要](evidence/redis-remediation-20261101/tested-sources.json)：504个已测文件与当前源码相同，无运行期间源码变化，临时 MySQL 已清理。已测 JAR 与各类 JUnit 原始报告留在 `var/redis-remediation-build/`。两台临时 Redis 在完成验收后关闭。

本轮列明范围业务验收通过。CI 工作流已更新为两台 Redis，但远端 Actions 与 Docker 镜像实际运行未执行，不以本机 WSL 运行替代该证据。

## 边界

生产地址检查覆盖相同 IP、DNS 别名、默认端口与相同端口的不同协议；不能识别不同代理端点映射同一后端，部署须核对物理拓扑。测试不等于容量压测、生产 HA、真实外部 AI 或远端 Actions 通过。当前未提交、推送、合并或部署。
