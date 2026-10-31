# Redis 与当前主线整合验收 · 2026-10-31

## 基线和范围

当前主线 `37124d0`，叠加 PR #10 的 `9d16b26`，按能力移植旧 Redis 提交 `7b10d2c`。保留当前主线的领域窄接口、批量查询读模型、严格响应契约、索引 attempt、MySQL `turn_token` / `turn_expires_at` 租约和消息/提案同事务提交。没有把旧分支的大范围历史文件覆盖到新主线。

交付包括 Spring Session 共享身份、共享限流、公开展示缓存、AI 共享准入、Python 实际执行容量限制和 Redisson 索引任务协调，以及库存只读权限、失效推荐候选、知识库并发配额和锁定入口事务约束。规格见 [SDD-12](../specs/SDD-REDIS-12.md)，部署步骤见 [运行手册](../operations/REDIS-12-runbook.md)。

## 本地实际结果

| 验证 | 结果 | 原始证据 |
|---|---|---|
| 全新临时 MySQL 8.0.31 + Maven verify + 本机真实 Redis | 189 项通过，0 失败、0 错误、0 跳过 | [完整汇总](evidence/redis-main-integration/mysql-round-1.json) |
| Python 应用测试 | 49 项通过；1 条已有 python_multipart 弃用提示 | [JUnit XML](evidence/redis-main-integration/python.xml) |
| 真实 Spring → MySQL / FastAPI HTTP | 173 项通过，严格校验117份响应 | [HTTP 原始结果](evidence/redis-main-integration/full-http.json) |
| 两个真实 Java 实例共享 MySQL/Redis | 9 项通过；31次交替节点登录请求验证共享限额 | [双实例结果](evidence/redis-main-integration/redis-shared-http.json) |
| Chromium 真实后端页面 | 8 项通过，未使用接口替身 | [浏览器结果](evidence/redis-main-integration/frontend-live/results.json) |
| 旧 Redis V31 已登记、主线 V30 缺失的升级路径 | 通过；V31校验和/登记时间及历史数据不变，补齐V30 | [单独升级复验](evidence/redis-main-integration/migrations-redis-upgrade.json) |
| 全新库、旧库升级、迁移重放、脏数据拒绝、校验和拒绝 | 通过，升级后字段/索引/约束与全新库相同 | 同上及完整汇总 |
| 格式、UI生成/构建一致性、源码/API/DDD、领域规则、HTTP边界、依赖审计 | 通过；依赖审计0漏洞 | [门禁汇总](evidence/redis-main-integration/local-checks.json) |
| 已测源码和 JAR | 472份源码摘要与工作区一致；JAR内UI与本次源码构建逐文件一致 | [源码摘要](evidence/redis-main-integration/tested-sources.json) |

双实例 HTTP 覆盖 A 登录/B识别、B注销/A旧Cookie失效、仅stock.read允许而product.read拒绝、角色权限变更立即生效、改价版本立即生效、实时库存、下架不可缓存放行、撤销成员立即生效及跨节点规范化账号限流。Maven 中的真实 Redis 测试另覆盖故障失败关闭、许可和任务锁、缓存回滚/提交与不可用回退；MySQL 测试继续覆盖会话令牌过期/竞争及事务规则。具体用例以原始结果和测试源码为准，不将有限用例视为穷尽证明。

验证使用新建临时 MySQL、随机端口、独立命名空间和临时 Java/FastAPI 进程，结束已清理。Redis 使用用户已启动的本机6379，没有启动本机 Docker Redis，没有 FLUSHDB/FLUSHALL。没有连接、迁移或重建现有业务库，也没有替换本机8091/8100应用。

## 复现

PowerShell（需要已有本机 Redis、JDK17、Node22.16、Python3.11、MySQL二进制）：

```powershell
$env:REDIS_TEST_ADDRESS='redis://127.0.0.1:6379'
$env:MAVEN_OPTS='-Dpython.executable=python'
python scripts/verify-mysql-isolated.py --mysql-bin D:/develop/mysql-8.0.31-winx64/bin --maven mvnw.cmd --http-smoke --artifact-dir var/verified-integration --output docs/testing/evidence/redis-main-integration/mysql.json
cd ai-service
python -m pytest -q
```

`--skip-maven` 可单独复验迁移路径。CI复用同一迁移检查及 `scripts/smoke-redis-shared.py`，并运行当前/历史浏览器契约与实际交付镜像验收。

## 失败记录与边界

移植初次编译发现重复 `@Transactional`，已删除重复注解，随后编译和完整verify通过；未将该失败记成测试通过。文档收口时一次源码链接检查因本报告尚未创建而失败，补齐报告后重新检查。原始编译日志保存在本机忽略目录 `var/compile.log`。

本轮AI使用真实FastAPI和本地检索，未重新调用讯飞/NVIDIA/Milvus；不得沿用历史真实模型通过数。本机未执行Docker、生产部署、HA故障转移、性能压力或多Python副本验收。远端CI和镜像结果以PR对应提交的Actions记录为准。

PR #10 的基线验收 [Actions 41159693930](https://github.com/ProfessorZJH/campus-shopping/actions/runs/41159693930) 已成功。整合代码保留在 PR #11 供人工审核，不自动合并主线或删除历史分支。
