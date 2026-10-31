# 校园智能导购及商品交易平台 · 工程入口

## 项目事实

- Java 17 / Spring Boot 3.4.3 / MyBatis 3.0.4；MySQL 是交易事实库，Redis/Redisson 提供共享会话、限流、展示缓存与任务协调。
- Java 模块：`campus-shopping-api` 定义接口/DTO，`trigger` 提供 HTTP/任务入口，`case` 编排跨域事务，`domain` 维护业务规则与 Port，`infrastructure` 实现数据库/远程适配，`app` 启动配置，`types` 公共错误与类型；后六项使用相同的 `campus-shopping-` 前缀。
- `frontend/` 为 Vue 3，主界面源在 `frontend/src`；`ai-service/` 为 Python FastAPI。构建使用 Node 22.16.0、Python 3.11、Maven Wrapper 3.9.9 和仓库锁文件。
- 当前支持多 Java 实例连接同一 MySQL/Redis 与单 Python 服务；支付均为模拟。生产、多 Python、性能与真实外部 AI 的验证范围以对应报告为准。

## 规范与开发顺序

- 先读 [AI 开发流程](docs/development/AI-WORKFLOW.md)，再读任务相关源码、测试与契约；复用已有能力，完成实际功能链路，不擅自扩大为无关重构。
- 较大需求变更可按 [OpenSpec 试用](docs/development/OPENSPEC.md)管理提案、行为规格和任务；简单修复不强制使用。纳入新能力基线时明确与原 SDD 的归属并更新引用，不重复维护两份规则。
- 业务目标以当前已接受需求、[R1及增量规格](docs/specs/RELEASE-01.md)、[已接受ADR](docs/architecture/decisions.md)为准。源码用于确认当前行为，不能用既有缺陷否定需求；发现冲突先说明并按本次授权范围收口，实质业务决策不确定时再澄清。
- HTTP 以 [生成契约](docs/api/http-api.md)、[OpenAPI](docs/api/openapi.json)、[行为契约](docs/api/behavior-v1.1.md)核对。DDD 遵循现有小傅哥约定及 [Java规范](docs/development/JAVA-STYLE.md)，不重复建立另一套分层标准。
- 普通修复在 PR 写清目标、范围、不变量和验收标准即可；跨域业务、API/数据/权限变化补齐相应规格或 ADR。历史教程、候选决策和测试记录不能自动覆盖当前已接受规则。

## 不得破坏的项目约束

- 价格、库存、经营资格、权限和成交由 Java/MySQL 实时复验；模型和向量索引只能提供建议/检索投影，不拥有交易写权限。全量公开商品召回不得退回“最新100件”的无条件预截断。
- Case 保证同库事务、锁顺序和幂等；查询 Repository/DAO 只允许白名单只读投影。状态/权限字典和聚合规则留在领域层，调用方依赖窄能力，Controller 不编排跨域规则。
- AI 长调用不持有数据库事务/行锁；会话使用 `turn_token` / `turn_expires_at` 的600秒租约，消息、提案与租约完成在短事务内原子提交。旧 `processing_*` 仅兼容迁移，两种租约版本不能混跑，详见 [SDD-12](docs/specs/SDD-REDIS-12.md)。
- 知识索引完成须匹配当前 `index_attempt`；商品索引失败不得更新成功时间。共享准入不等于任务已取消，Python 许可须持有到实际执行结束。
- 保留中文业务注释、`AppException/ResponseCode` 和 Controller 内业务异常捕获；不新增远程密码 Port 或全局业务异常处理器。不削弱响应必填/非空契约来规避失败。

## 安全与数据

- 不提交、打印、截图或写入日志任何真实凭据、提示词或下游异常正文；使用私有 `.env` / secrets。公网 Redis/Milvus 不放开明文凭据连接，测试例外不等于生产授权。
- 未经明确授权，不迁移、清理既有业务库，不替换正在运行的服务；默认使用新建隔离库。Redis 测试禁止 `FLUSHDB/FLUSHALL`；不因本机已有 Redis 就自动复用。仅确认是测试专用实例且显式配置 `REDIS_TEST_ADDRESS` 时可复用，并使用随机命名空间；否则使用隔离测试实例，缺失所需 Redis 的验收不能记为通过。
- 迁移文件发布后不可修改；已有库先备份、维护窗口显式迁移并登记历史。应用启动只读核验版本/校验和，不执行升级 DDL。
- 不绕过服务端权限、CSRF 或交易复验，不通过删除测试、放宽断言、伪造数据或跳过必需检查换取通过。

## 常用检查与交付

- Java/前端格式：`npm run format:check --prefix frontend`；Java 4空格/160列，前端2空格/100列。
- 前端修改后：`python scripts/build-ui-bundle.py`，再用 `--check` 比对；禁止手改生成静态副本。`mvnw clean verify` 会重新从源码构建 UI。
- API/DTO修改后：`python scripts/generate-api-contract.py`、`python scripts/verify-api-contract.py`、`python scripts/verify-api-schemas.py`；响应字段同步 `scripts/api_response_rules.py`。
- 新增迁移后：`python scripts/schema_contract.py`，审查生成结果并执行升级/重放检查。
- 源码与DDD：`python scripts/verify-release.py`；Python：在 `ai-service/` 执行 `python -m pytest -q`。按实际影响补充真实 MySQL/Redis、HTTP、浏览器验证，命令与选择见开发流程。
- PR 使用仓库模板，交付说明修改、实际执行的命令/结果、风险及未验证事项；区分代码完成、测试通过和列明范围业务验收。合并与部署遵循用户授权和仓库门禁，不默认自动合并。
- 报告统一保留在 [docs/testing](docs/testing/)，从 [文档索引](docs/README.md)查当前范围。不要向本文件追加历史测试数量、运行流水或阶段总结。
