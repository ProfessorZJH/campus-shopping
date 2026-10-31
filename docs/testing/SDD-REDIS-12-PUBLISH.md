# SDD-12 发布分支说明 · 2026-10-31

用户在本机验收通过后明确授权提交 GitHub 并推送远端。发布分支为 `codex/redis-sdd-12-local-acceptance`，仓库为 `ProfessorZJH/campus-shopping`。

拉取远端引用后发现：本地基线为 `e5cd2c1`，远端 `main` 已前进 46 个提交至 `37124d0`，包括后续查询模型、领域事务和提案重构。本分支保存当前已经实际验收的完整工作区版本及其必需的前序改动，未合并到远端 `main`，没有覆盖或回退远端更新。与最新 `main` 的整合需要单独合并、解决差异并重新验收，不能把此次推送当作该整合已经完成。

发布前核对上一轮 435 个受验收源文件摘要，无差异；格式、生成 UI 一致性、schema 校验和、Java/Mapper/DDD 静态边界和文档链接检查通过。扫描全部候选文件，未匹配本机配置中的实际密码、API Key 或服务密钥；私有 `.env`、数据库/SQLite 备份、运行日志、临时脚本和 IDE 文件不提交。原始失败证据与有限验收边界继续保留。

发布审查发现 CI 仅配置了 `REDIS_TEST_ADDRESS`，后续真实 Spring HTTP 进程仍会使用默认 6379/6380，而 CI Redis 监听 16379。本次仅补充工作流部署配置：等待 Redis PONG、把同一实例地址显式传给真实应用、按 run/attempt 隔离命名空间，并在结束时清理 CI Redis 容器。工作流 YAML 和所有 run 步骤的 Bash 语法检查通过；没有修改已验收的应用代码。

此次没有在本机启动 Redis 容器，也未在此发布步骤运行远程 CI。当前工作流的 push 触发器只覆盖 `main`，所以推送这个独立分支不等于自动执行并通过 CI。此前本机应用及数据库证据见[本地报告](SDD-REDIS-12-LOCAL.md)，隔离 Maven/Python 证据见[隔离报告](SDD-REDIS-12-VERIFICATION.md)。
