# 历史部署模板已移除

旧模板来自教学脚手架，包含固定口令、公开管理端口、特权容器及失效挂载，不再保留为可执行配置。历史内容仅可从 Git 历史追溯，不应用于部署。此目录下 SQL 仍为迁移历史，不能随意执行到既有业务库。

受维护入口为仓库根 `compose.yml`。生产默认启用 Secure Cookie 和 MySQL `sslMode=VERIFY_IDENTITY`，需另行配置 HTTPS 反向代理、MySQL 证书及 JVM/JDBC 可信 CA；Redis 认证不能为空。没有完成证书配置时拒绝启动是预期行为。

单机开发运行 `python scripts/dev-up.py`，它显式组合 `compose.yml` 与 `compose.local.yml`。本地覆盖仅适用于隔离、绑定回环地址的开发或 CI，不能用于公网发布。启动不代表完成生产验收。
