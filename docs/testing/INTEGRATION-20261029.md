# 本地与远端工程化整合验收

整合基线为远端 main `de6c595`，分支 `codex/integrate-engineering`。原工作区保留，整合在独立工作树完成。原本地受 Git 管理及未忽略的新增文件另有忽略目录 ZIP 备份。

采用远端角色治理、图片存储、交易/AI 仓储拆分以及向量索引结果校验；保留本地订单批量查询、只读接口、推荐领域规则、严格响应契约、角色名冲突翻译、索引清理、请求关联、依赖锁定、前端源码构建、迁移校验及交付清单。知识发布聚合调用远端发布策略，根行锁和版本切换继续由同一事务保证。移除组合仓储接口和重复的状态服务，全部消费者使用窄能力接口。

新增索引删除结果校验：DISABLED、空响应、非法模式和数量拒绝；EMPTY_INDEX 和幂等删除允许零处理数。新增同步失败不更新成功时间、重试恢复的测试。沿用远端 Java 4 空格/160 列，Prettier 按 Java 单独配置。183 个与远端语法树相同的排版文件已单独提交，不混入功能提交。

| 本轮验证 | 结果 |
|---|---|
| 隔离 MySQL + Maven clean verify | 140 通过，0 失败，0 跳过；含 33 项真实 MySQL JUnit |
| 真实 Spring/MySQL/FastAPI HTTP | 173 项通过；117 份严格 Schema 响应通过 |
| 真实 Chromium → Spring | 8 项通过，apiMockUsed=false |
| Python | 42 项通过；一项 multipart 弃用提示 |
| 领域/契约/架构 | 56 领域检查、5000 步库存序列、41 Schema、93 路由、10 个架构违规样例拒绝通过 |
| 格式与构建 | Prettier、11 个核心类可读性、SDD 读模型/映射检查通过；JAR UI 与本次构建逐文件一致 |
| Docker 交付镜像 | NOT_RUN：本机 Docker Engine 不可用；CI 任务保留，尚未推送运行 |

真实验收使用全新临时 MySQL datadir 和随机回环端口；未读取私有 .env、未使用业务库，临时实例已清理。AI 使用 LOCAL_RETRIEVAL_DEMO，未重新访问付费模型或远程 Milvus，未做性能压测或生产部署。

[完整验收证据](evidence/integration-20261029/mysql.json)、[HTTP](evidence/integration-20261029/full-http.json)、[浏览器](evidence/integration-20261029/frontend-live/results.json)、[Docker 状态](evidence/integration-20261029/containers.json)。受测 436 个源码文件摘要一致，sourceChangedDuringTest 为空。测试过的 JAR 在 `var/integration/verified-build/`，未替换运行中的服务。

首轮隔离构建的 139 项中有一项测试期望仍沿用远端 AppException；当前项目对非法持久化状态使用 IllegalStateException。只调整该断言，保留“必须拒绝非法状态”的要求，并新增一项同步恢复测试后完整复验。原失败汇总保存于 `evidence/integration-20261029/mysql-before-test-adaptation.json`。

复现：

```powershell
npm ci --prefix frontend
npm run format:check --prefix frontend
python -X utf8 -B scripts/verify-release.py
python -X utf8 -B scripts/verify-mysql-isolated.py --mysql-bin 'D:\develop\mysql-8.0.31-winx64\bin' --maven 'D:\develop\Maven\apache-maven-3.8.8\bin\mvn.cmd' --offline --http-smoke --artifact-dir var/integration/verified-build --output docs/testing/evidence/integration-20261029/mysql.json
```

工具链按仓库 Maven Wrapper / Node / Python 锁文件约束；上面验收命令使用本机已缓存的 Maven。交付镜像仍需在有 Docker Engine 的机器或 CI 上运行 `python scripts/verify-containers.py`。
