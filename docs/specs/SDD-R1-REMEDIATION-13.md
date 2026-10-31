# R1 审查整改增量约束

本增量承接 R1、SDD-07/12，保留原分层、交易事实源和短事务。按安全、AI、知识、前端、容量、交付六批实施，执行范围与证据见 [整改记录](../testing/R1-REMEDIATION-20261031.md)。不代表生产部署授权。

## A：安全入口

- 登录、注册、AI 和自提核销的配额使用去除 Servlet context-path 后的业务路径；提取商户 ID 使用同一路径。根路径与 `/campus` 行为相同。
- AI 的 LLM、Embedding、Qdrant、Milvus 地址统一拒绝内嵌凭据、查询、片段和非 HTTP(S) 协议。公网凭据传输使用 HTTPS；HTTP 仅允许回环及服务端明确列入 `AI_TRUSTED_HTTP_HOSTS` 的可信内网对端（默认 Compose 的 `milvus,qdrant`）。可信名单不能填公网服务。HTTP 客户端禁止自动重定向和环境代理。
- `prod` 在 Bean 实例创建前拒绝非 Secure Cookie、未启用或未认证的 Redis、开发命名空间和未配置 `sslMode=VERIFY_IDENTITY` 的 MySQL。禁止重复/旧 TLS 属性及自动公钥检索。CA 通过 JVM/JDBC truststore 提供，证书不可验证时连接失败，不降级。
- 根 Compose 采用生产安全默认值；`compose.local.yml` 仅限回环隔离开发/CI，显式采用 dev profile。旧危险模板和替换运行容器的教学脚本移除，不迁移已有库或替换现有服务。
- 真实供应商验收仅允许手动选择受保护 `main` 的当前 HEAD，使用只允许 main 分支的 `external-ai` Environment。密钥仅在真实调用步骤暴露，使用 `LIVE_*` Environment secrets，缺失则失败关闭。依用户单人维护决定，不要求独立审批。第三方 Actions 固定审核版本的 commit SHA。
- 仓库旧 secrets 无法由 API 读出或迁移；需维护者将其重新存入 Environment 后移除仓库副本。在完成迁移前，不能宣称所有历史工作流的仓库密钥已隔离。新工作流不再引用旧名。

## B–F

各批实施时在此补充涉及 API、数据或跨域语义的增量；未实施事项仍以原已接受规格为准。
