# R1 本地运行、验收与合并手册

> 本机 Spring/MySQL、真实模型与浏览器闭环已按[2026-10-29 报告](../testing/LOCAL-LIVE-20261029.md)验收；下列 Docker 步骤仍未在本轮执行。不要覆盖本地改动。本轮数据库重建由用户明确授权，备份与 SQL 执行记录见报告。

## 1. 推荐：独立目录启动全栈

将完整源码解压到新目录，与现有工程比较。需要Docker Engine、Compose，以及可下载Maven/Python依赖和镜像的网络。

```bash
python scripts/dev-up.py
```

脚本先检查Docker，缺少则明确失败；首次创建随机`.env`，不会覆盖已有凭据。Docker首次建空库会应用schema.sql/data.sql。启动后地址`http://127.0.0.1:8091`，管理员凭据在本地`.env`。

```bash
python scripts/smoke-full.py
```

这会在本地库创建独立测试账号、商户、商品和交易，记录真实HTTP结果；**不会自动删除这些测试数据**。仅允许localhost，不能对真实生产账号/资金运行。`--skip-ai`明确标为部分验收，不等于全通过。

## 2. 不使用Docker：本机Java和MySQL

要求 JDK17、Node 22.16.0、MySQL8、Python3.11；使用仓库 Maven Wrapper 3.9.9。先创建空库；已有库先按[迁移手册](../database/migrations/README.md)显式升级并登记校验和：

```sql
-- 执行 docs/dev-ops/mysql/sql/00_r1_schema.sql，包含建库与选库。
-- 随后在 campus_shopping 库执行 app/resources/data.sql。
```

PowerShell示例；密码用你自己的安全值，不复制示意文字：

```powershell
$env:DB_URL = 'jdbc:mysql://127.0.0.1:3306/campus_shopping?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'
$env:DB_USERNAME = '你的应用数据库账号'
$env:DB_PASSWORD = '你的数据库密码'
$env:AI_SERVICE_KEY = '自行生成至少24位随机服务密钥'
$env:ADMIN_USERNAME = 'campus_admin'
$env:ADMIN_PASSWORD = '自行生成的管理员密码'
$env:BOOTSTRAP_ADMIN = 'true'
$env:SESSION_COOKIE_SECURE = 'false'
.\mvnw.cmd -B -ntp clean verify
java -jar .\campus-shopping-app\target\campus-shopping-app.jar --spring.profiles.active=dev
```

在另一终端（同一个AI_SERVICE_KEY）：

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --require-hashes -r requirements.lock
python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8100
```

首次没有业务商品是正常的：注册经营者→提交入驻→平台审核→商户建商品/补货/上架；生产界面没有自动塞入假的成交数据。完整HTTP脚本可准备一组明确标记的验收数据。

## 3. 真实模型和Qdrant

在`.env`设置一组`LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`，地址按供应商要求包含`/v1`或`/v2`等路径；Embedding同理。讯飞 MaaS 示例：`LLM_BASE_URL=https://maas-api.cn-huabei-1.xf-yun.com/v2`、`LLM_MODEL=spark-x2.6`，模型 ID 仍以控制台服务授权为准，`LLM_API_KEY` 仅填写本地私有 `.env`。三个字段必须成组，凭据不写进前端或Git。

`LLM_TIMEOUT_SECONDS` 控制模型读取超时，允许 5–60 秒、默认 60；其他 HTTP 超时保留 30 秒。真实验收观察到超过原 30 秒的回答；超时仍显式降级，不把降级结果记为真实 LLM 通过。

Qdrant可通过`QDRANT_URL=http://qdrant:6333`和随机`QDRANT_API_KEY`启用，再执行：

```bash
python scripts/dev-up.py --vector
```

未配置模型时，界面明确显示本地检索演示；模型失败则降级并显示实际模式。更换Embedding模型或维度必须使用新的QDRANT_COLLECTION并重建文档索引，不能让不同维度混进同一集合。NVIDIA/Milvus/讯飞的独立真实 AI 验收已补充，见[验收报告](../testing/AI-LIVE-20261029.md)；Qdrant 与 Java/MySQL 全栈仍未验收。

已配置完整模型及安全 Milvus 连接时，在仓库根目录使用安装了 `ai-service/requirements.lock` 的 Python 执行：

```bash
python scripts/smoke-ai-live.py --env-file .env --products --output var/ai-live/rerun.json
```

脚本自动读取私有 `.env`，通过真实 Uvicorn TCP 调用真实模型；知识库使用临时 SQLite，商品使用本轮独立 Milvus 集合并清理，不写正式集合。商品报价/库存为合成验收数据，不能替代 Java/MySQL 的复权和交易验收。

## 4. 真实测试和检查命令

```bash
python scripts/verify-release.py
python scripts/verify-domain.py
python scripts/verify-http-body.py
cd ai-service
python -m pip install --require-hashes -r requirements-dev.lock
python -m pytest -q
python evaluate.py
cd ..
python scripts/smoke-ai-local.py
python -m pip install playwright==1.58.0
python -m playwright install chromium
python frontend/tests/contract_ui.py
python frontend/tests/live_ui.py
```

最后一个脚本要求Java/MySQL真正运行，且浏览器允许访问本地端口。契约替身测试不能代替它。

Java真实并发测试连接**独立**`campus_shopping_it`库，设置`MYSQL_TEST_URL/MYSQL_TEST_USERNAME/MYSQL_TEST_PASSWORD`后执行`mvn clean verify`。测试会清空专用库业务表，**严禁使用开发或生产库**。未配置时对应测试类跳过；跳过不算通过。

`.github/workflows/full-release.yml`已定义JDK17+MySQL测试、Python检查、真实HTTP及浏览器检查，但本次没有推送或触发远程CI。

## 5. 从教学版升级

1. 备份数据库和本地Git改动；检查旧表的真实DDL。
2. 仅原IAM-01/P1教学结构：先应用`03_upgrade_teaching_schema.sql`，再应用`00_r1_schema.sql`和data.sql创建缺失表，最后应用`04_case_sensitive_keys.sql`。
3. 旧申请缺经营/门店资料将不能直接审核；重新提交完整资料，不伪造历史字段。
4. 曾执行其他P1草案或有自行改表时，不能直接套这个升级脚本。先比较逻辑数据模型和现有列/索引，写单独迁移。
5. 删除清单中的旧演示安全配置、模板Mapper、空占位包等不要留在新工程，否则可能产生重复Bean或错误Mapper。

## 6. 上线前仍需做

完成真实Maven/MySQL/浏览器验收、依赖漏洞检查、HTTPS反代与Secure Cookie、数据库备份/恢复演练、日志脱敏、实际压测和真实模型评测。当前默认单实例内存会话，应用重启会退出登录；需要多副本时另行引入共享会话，而不是临时添加JWT。

不要执行`docker compose down -v`删除已有数据库卷。普通停止只使用`docker compose down`。

## SDD-02 升级：历史订单图片快照

此版本增加 `trd_order_item.image_url`，现有库**必须先备份和运行** `docs/database/migrations/V20261028_01__order_item_image_snapshot.sql`，再部署 Java。全新库的 `docs/dev-ops/mysql/sql/00_r1_schema.sql` 已包含此字段。不要重新建库、清表或给历史订单回填当前商品图。完整规格见 [SDD-02](../specs/SDD-INTEGRATION-02.md)。

升级后先确认 `SHOW COLUMNS FROM trd_order_item LIKE 'image_url'`，再用测试账号上传图片、创建订单、替换商品图、检查订单项图片不变。必须使用测试库执行真实 Maven/HTTP 验收；未运行时报告 NOT_RUN。

### SDD-07 真实模型联通单独验收（需要可访问外网）

在 Compose 的私有 `.env` 中配置讯飞 `LLM_BASE_URL`、`LLM_API_KEY` 和控制台实际授权的 `LLM_MODEL` 后，重建 AI 容器并执行：

```bash
docker compose up -d --build ai
docker compose exec ai python -m app.smoke_model
```

只有控制台有该模型权限、DNS/网络畅通且返回 `LLM_SMOKE=PASS` 时，才算真实模型连接通过；代码仅输出状态和模型 ID，绝不打印密钥。后续还要执行 Java/AI/数据库全链路联调与真实商品效果评测。`/v1/recall` 为 Python 内部接口，不能暴露到公网。若密钥曾出现在聊天记录中，先在控制台轮换。
