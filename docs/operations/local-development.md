# Windows 本地开发与工程初始化检查单

> 版本 v1.1 · 2026-10-27 · **操作指导，未经本地真实 Maven/MySQL 构建验证**。  
> 适用于 `G:\develop\campus-shopping` 官方 JDK17 六模块脚手架；本文件不替代上游 `docs/dev-ops/`。

## 1. 准备环境

| 工具 | 建议要求 | 检查 |
|---|---|---|
| JDK | Temurin/OpenJDK 17 | `java -version` 输出 17 |
| Maven | 3.8+ / 3.9+，兼容 JDK17 | `mvn -v` Java home 指向 17 |
| IDEA | 导入根 `pom.xml` | Maven Project SDK 和语言目标 17 |
| MySQL | MySQL 8 | 本地独立测试数据库，账号最小权限 |
| Git | 初始化并提交实际工程 | 不提交 Secret、IDE 个人设置 |
| Docker（可选） | Docker Desktop | 确保端口与资源可用 |

Windows PowerShell：

```powershell
Set-Location 'G:\develop\campus-shopping'
java -version
mvn -version
mvn clean verify
```

**注意**：原脚手架 POM 编译插件存在老版本、测试跳过等配置；需先检查真实 POM 并修复，不要误以为 `mvn verify` 的退出码 0 就证明测试被正确发现。运行实际测试之前先确认 POM 中没有跳过测试的设置。

## 2. 现有官方目录

```text
campus-shopping/
├── campus-shopping-api/
├── campus-shopping-app/
├── campus-shopping-domain/
├── campus-shopping-infrastructure/
├── campus-shopping-trigger/
├── campus-shopping-types/
├── docs/dev-ops/         # 官方环境和部署样例，保持原状
├── docs/                # 本次新增项目需求与设计文档
├── AGENTS.md            # Codex 项目指引
└── pom.xml
```

已存在 `.codex/` 和 `.github/` 时，保留当前配置，不随意覆盖。

## 3. 数据库初始化

1. 先检查 `docs/dev-ops/mysql/sql/` 中的官方模板表，确认是否与目标 `campus_shopping` 存在同名/数据冲突。
2. P1 的建库建表草案在 [`docs/database/p1-schema-draft.deprecated.txt`](../database/p1-schema-draft.deprecated.txt)。**此 SQL 只是一份独立设计草案，未经实际执行验证**；先备份并检查业务列/约束、决定是否引入 Flyway 迁移。
3. 注意当前独立商户申请练习在 `docs/dev-ops/mysql/sql/01_merchant_application.sql` 有另一份 `mer_application` 表结构（仅 `merchantName` 等简化列）；**不能将该练习 SQL 与完整 P1 `p1-schema-draft.deprecated.txt` 不经对齐直接在同一库重复执行**。正式推进 P1 时先做版本迁移/差异评审。
4. 开发数据库使用独立用户和环境变量注入密码，不把 root/生产密码写入 application.yml 或版本库。
5. 如果决定使用 Flyway，先建立 `V1__identity_merchant.sql` 等迁移，不要既在 Docker 初始化 SQL 里建表又在 Flyway 中重复建表。

## 4. 脚手架部署模板的安全提示

检查过上传的原始 `campus-shopping.zip`：`docs/dev-ops/docker-compose-environment.yml` 中有演示用 MySQL root 密码和可预测管理账号。**不要直接把此文件部署在公网，也不要继续使用这些默认口令**。先复制成个人本地配置并替换为本地密钥（从环境变量或 Secret 文件读取），数据库端口只绑定本地或受控网络，不对公网暴露 Redis/MySQL/管理后台。

## 5. 第一条纵向业务 P1

读取 [Identity](../domains/identity.md)、[Merchant](../domains/merchant.md)、[P1 验收](../domains/P1-acceptance.md)，以用户注册登录 → 申请 → 管理员审核 → 原子开通商户/门店/Owner → 查询授权商户为第一条完整链路。开发过程中需要 Case 时再添加 `campus-shopping-case` Maven 模块和对应 POM 依赖；不创建重复的空控制器。

## 6. 每次功能提交的最小动作

1. 先对照当前 FR/领域文档，列出要实现的业务规则和失败情形。
2. 在 Domain 编写单测，复杂场景在 MySQL 编写事务/并发集成测试。
3. 先读 [工程风格对齐](../architecture/engineering-alignment.md)，按 `xfg-ddd-skills` + 真实 `group-buy-market` 编码、添加中文业务注释；API/Trigger 接口实现、Spring Boot 3 的 `jakarta` 注入、`AppException/ResponseCode/Response<T>` 要一致。
4. 运行具体测试与 `mvn clean verify`，逐条记录实际结果；失败不伪称通过。
5. 更新 API、领域文档、测试计划对应条目，提交 Git。
