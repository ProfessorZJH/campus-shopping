# 工程化收敛与验证（2026-10-29）

本次按工程化审查的八项问题修复。验证使用全新临时 MySQL、临时构建目录和随机回环端口，没有读取私有 `.env`，没有连接或修改已有业务库、正式 Milvus 集合或付费模型。

## 改动与持续门禁

| 问题 | 处理 | 持续验证 |
|---|---|---|
| 前端源码、bundle、Spring 静态目录漂移 | Vite 基于 JS 语法树预编译 Vue 模板；Maven 从源码生成资源；旧离线入口统一同步 | `build-ui-bundle.py --check` 对全部受管文件重新构建比对 |
| SQL 手工升级无版本约束 | 迁移版本及 SHA-256 清单、显式迁移 CLI、MySQL 互斥锁、默认开启的启动只读校验 | 新旧库等价、幂等重跑、脏数据阻断、篡改校验和拒绝；SchemaVersionGuardTest |
| AI 故障缺少诊断 | Java → Python 请求 ID、操作/耗时/异常类型/状态日志、内部认证诊断计数 | 故障日志脱敏与请求关联 Python 测试；不记录密钥、提示词和异常正文 |
| CI 与交付镜像脱节 | 独立 delivery-images job 构建实际 Compose 镜像并跑真实 HTTP 交易链路；补齐工作流触发路径 | `verify-containers.py` 使用随机项目名、端口、凭据和临时卷 |
| 依赖与工具链不确定 | Maven Wrapper 3.9.9 及发行包校验和、npm lock、带完整哈希的 Python 3.11 通用锁、Node 22.16.0 | CI 使用 `npm ci`、`pip --require-hashes` 和 wrapper；AI 镜像统一 Python 3.11 |
| 商品索引只增不减 | 周期扫描含下架商品的全目录；由实时 Catalog 复权后决定 upsert/delete | Java 同步作业测试、Python Milvus 删除契约替身；失败后下轮可重试 |
| 密集 Java 与源码字符串断言阻碍维护 | Java/前端统一格式化；去掉绑定循环/变量名的行为断言，保留结构及动态回归 | `format:check`、Maven 行为测试、Chromium 请求乱序/账号商户切换测试 |
| 根目录交付清单陈旧 | 删除手工维护的根清单；Maven verify 生成源码/Git 状态、JAR 摘要、实际 JUnit 统计及证据摘要 | 构建前记录源码摘要，清单标明是否与构建时源码一致；跳过测试标为 PARTIAL |

前端正式编译不再依赖浏览器，不需要 `unsafe-eval`。编译时发现的 Merchant/Platform 模板闭合问题已修正。静态资源仍保留 `/legacy.html`。

## 实际验证

最终隔离 `clean verify`：116 项 Java 测试通过，0 失败、0 跳过；真实 HTTP 173 项通过（117 份响应按 OpenAPI 校验）；真实 Spring + Chromium 8 项通过。迁移专项 6 项通过，覆盖五种非法金额/数量写入拒绝；另逐文件比对了 JAR 中全部 UI 与本次编译输出，交付清单的 `sourceMatchesBuild=true`。原始证据见 [MySQL / Maven / HTTP / 浏览器汇总](evidence/engineering/mysql.json)、[真实 HTTP](evidence/engineering/full-http.json)、[真实页面](evidence/engineering/frontend-live/results.json)。

锁定环境 Python 单测 42 项通过，见 [JUnit XML](evidence/engineering/python.xml)。另有真实 Uvicorn TCP 8 项及真实 JDK HTTP 边界 6 项检查。Chromium 接口替身覆盖旧入口、输入限制、分页、多 SKU、搜索、请求乱序、角色权限、全局排序，见 [脚本汇总](evidence/engineering/browser-contracts.json)；替身不算真实后端通过。测试关闭页面前现在会等待绑定回调结束，避免遗留异步通道异常。

最终 Chromium 接口替身回归共 70 项通过，7 个脚本 stderr 均为空。重构期间漂移门禁曾正确拒绝未同步的构建摘要，重建后通过；[原始失败](evidence/engineering/browser-contracts-before-sync.json)与[失败日志](evidence/engineering/ui-audit-before-sync.txt)保留。npm 审计驱动 Vite 升级为 6.4.5、Java 格式插件升级为 2.11.0，并使用兼容的 Prettier 3.9.10；锁定依赖最终[审计结果](evidence/engineering/npm-audit.json)为 0 项已知漏洞。Vite 补丁范围参考[官方公告](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22)。这不等于已经完成全工程安全审计。

Docker Engine 当前不可用，**本地交付镜像验收 NOT_RUN**。CI 已配置镜像验收，但本次没有提交或触发远端 CI，不能写为远端已通过。Qdrant、真实 NVIDIA/讯飞/Milvus 删除、性能和生产部署均未在本次复验；历史真实模型证据仍保留原来的范围。

## 构建与维护

使用 JDK17、Node 22.16.0、Python 3.11；Maven 由仓库 wrapper 固定。Windows 用 `mvnw.cmd`，Linux/macOS 用 `bash ./mvnw`。

```powershell
python -m pip install --require-hashes -r ai-service/requirements-dev.lock
npm ci --prefix frontend
npm run format:check --prefix frontend
python scripts/schema_contract.py --check
python scripts/build-ui-bundle.py --check
.\mvnw.cmd -B -ntp clean verify
```

修改前端后，运行 `python scripts/build-ui-bundle.py` 更新离线兼容快照；正式 Maven 构建总是从源码生成 `target/generated-ui`。禁止手改 Spring 下的生成目录。新增迁移后运行 `python scripts/schema_contract.py` 更新版本清单和 schema 镜像，再审查 SQL。

数据库升级前先备份并在副本验证。凭据通过当前终端的 `DB_USERNAME` / `DB_PASSWORD` 设置；CLI 不读取 `.env`。显式升级步骤见 [迁移手册](../database/migrations/README.md)。以前手工执行过 SQL 的库也需要通过此入口登记和校验版本，幂等 SQL 会保留已有数据。应用启动只读检查，缺失或不匹配就停止启动。

交付清单位于 `campus-shopping-app/target/release-manifest.json`，不提交 Git。`verification.maven` 只统计该构建目录中的报告；没有报告是 NOT_RUN，有跳过是 PARTIAL。`buildSource` 和 `sourceMatchesBuild` 区分构建时源码与之后的工作区变化；临时无 Git 副本的 commit 为 null，源码摘要仍有效。追加实际执行的证据：

```powershell
python scripts/generate-release-manifest.py --require-full-tests --evidence http=docs/testing/evidence/engineering/full-http.json
```

`--require-full-tests` 在没有报告、失败、跳过或源码与构建摘要不一致时返回非零。隔离测试生成的 JAR 和构建时清单位于 Git 忽略的 `var/engineering/verified-build/`，不会覆盖运行中的旧 JAR；每轮清单副本随对应验证报告保留；后续 DDD 重构复验的 [116 项构建清单](evidence/ddd-refactor-20261029/tested-release-manifest.json)及范围见 [DDD 整改验收](DDD-REFACTOR-20261029.md)。

## 边界

MySQL DDL 仍有隐式提交。迁移中断后只登记已成功的脚本，修正阻断原因后可重跑；不自动修改历史脏数据。版本记录不是所有物理表结构漂移的审计，已有同名不同定义的索引仍需人工核对。

商品索引清理覆盖当前业务的软下架、商户停用和无有效 SKU；现无商品物理删除入口，人工直接删库留下的孤立向量不在本轮自动回收范围。同步扫描最多 40,000 件，达到上限明确报错；未声称有高容量性能验收。所有召回和确认仍由 MySQL 与 Java 事务复验商品事实。
