# 本地开发入口

> 适用于 JDK 17、Node 22.16.0、Python 3.11、Maven Wrapper 3.9.9。默认使用隔离数据库和测试 Redis，不连接既有业务库。

## 1. 推荐启动

```powershell
python scripts/dev-up.py
```

脚本按根 `compose.local.yml` 启动本地依赖，首次生成未跟踪 `.env`。启动后访问 `http://127.0.0.1:8091/#/`，需要真实业务链路检查时再运行：

```powershell
python scripts/smoke-full.py
```

不要提交、截图或粘贴 `.env`、Cookie、模型密钥和数据库凭据。

## 2. 源码结构

```text
campus-shopping-api/             API 接口、DTO、Response
campus-shopping-trigger/         HTTP Controller、SSE、定时任务、安全过滤器
campus-shopping-case/            跨域事务与用例编排
campus-shopping-domain/          七域聚合、规则、服务、Repository/Port 接口
campus-shopping-infrastructure/  MyBatis、Redis、HTTP/对象存储适配器
campus-shopping-app/             启动、配置、Mapper、正式 schema 与测试
campus-shopping-types/           公共错误码、异常与类型工具
frontend/                        Vue 3 唯一前端源码
ai-service/                      FastAPI 检索与模型服务
scripts/                         构建、契约、隔离验收与运维脚本
```

生成副本 `frontend/ui.bundle.js` 和 `campus-shopping-app/src/main/resources/static/` 由脚本生成，禁止手改。

## 3. 数据库

- 新库基线：[`campus-shopping-app/src/main/resources/schema.sql`](../../campus-shopping-app/src/main/resources/schema.sql)。
- 已有库按[迁移手册](../database/migrations/README.md)使用 `scripts/migrate-database.py` 显式升级并登记版本/校验和。
- 应用启动只读核验 schema，不执行升级 DDL。
- 未经明确授权，不迁移、清理或复用既有业务数据库；优先使用 `scripts/verify-mysql-isolated.py` 创建临时库。

## 4. 构建与门禁

```powershell
npm run format:check --prefix frontend
npm run typecheck --prefix frontend
npm test --prefix frontend
python scripts/build-ui-bundle.py --check
python scripts/schema_contract.py --check
python scripts/verify-api-contract.py
python scripts/verify-api-schemas.py
python scripts/verify-supply-chain.py
python scripts/verify-java-readability.py
python scripts/verify-release.py
python scripts/verify-domain.py
```

Java 全量构建：

```powershell
.\mvnw.cmd clean verify
```

完整集成需要隔离 MySQL 与 Redis；未提供依赖的测试必须保留为 `NOT_RUN`，不能改成通过。

## 5. AI 服务

```powershell
cd ai-service
python -m pytest -q
python evaluate.py --dataset campus-shopping-v1 --split smoke --profile local
```

真实供应商调用、Milvus/Qdrant 和生产压测按独立环境、预算与授权执行。无凭据时使用明确标识的本地检索或受控替身，不宣称真实模型效果。

## 6. 工作区卫生

- `var/` 是忽略目录，仅保留运行需要的 `var/uploads`；测试和 CI 证据应写入指定记录或 artifact，不应长期堆积临时脚本与 JSON。
- 直接运行浏览器或验收脚本时，截图与 JSON 默认写入 `var/verify/`。只有显式设置 `CAMPUS_EVIDENCE_DIR` 才发布到跟踪目录，避免普通测试污染 Git 工作区。
- `docs/testing/` 只追加任务证据；不要把 AI 对话草稿、内部推理或未采用的方案提交为文档。
- 提交前检查 `git status`、敏感信息、生成产物和嵌套子模块状态。
