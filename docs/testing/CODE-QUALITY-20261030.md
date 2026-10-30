# 代码职责与并发问题修复验收

本轮以 `29220146eb4dd094ddf106e0e640d25558bd22dd` 为基线，在 `codex/integrate-engineering` 工作树实施。保留现有七领域、模块依赖方向、93 条 HTTP 路由、Controller 内业务异常捕获和数据库事务锁顺序。

## 修复内容

| 问题 | 本次处理 |
|---|---|
| Catalog/Cart Controller 跨域组装 | 商品与购物车查询迁入 `ICatalogQueryCase`、`ICartQueryCase`，返回完整读模型；Controller 只依赖 Case。商品列表批量取商户名，库存继续按 500 SKU 分批。 |
| DTO 中途缺少必填字段 | `ApiViews.product/order/cart` 一次构造完整响应，商品/订单/购物车读模型拒绝缺失商户名；商品模型还拒绝缺少 SKU 库存映射。 |
| 商品写入完成后响应读取失败 | 新建响应复用事务内已知商户与零库存；新增 SKU 的响应读取包含在写事务中，读取失败时 SKU、库存初始化及商品版本一起回滚。 |
| 会话进程锁误冲突、实例间无协调 | 删除 64 把哈希分段锁，改为按完整会话 ID 领取数据库租约，完成时按 token 和期限条件更新。无关会话互不拒绝，过期请求不能落库或释放后继租约。 |
| AI 长调用与事务职责混杂 | `chat/index/upload` 使用 `NEVER` 拒绝外层事务；消息与提案由 `ConversationTurnCase` 短事务原子提交，提案确认由独立 `ProposalConfirmationCase` 事务复验并加购。 |
| 索引响应假成功、旧任务覆盖 | `/v1/index` 使用有类型的响应并校验 chunks/mode；每次索引保存独立 `index_attempt`，只接受仍为当前 PENDING 请求的完成结果。 |
| 会话仓储写提案 | 提案创建与冻结报价校验归 `ProposalAggregate`/`IProposalService`，插入归 `IProposalRepository`，会话仓储仅维护会话消息与租约。 |
| 知识授权查询加载全部正文 | 授权列表仅查询 ID、标题与可见性，正文按实际引用 ID 批量读取；返回前仍复核权限快照与引用正文。 |
| 权限规则重复 | `RoleServiceImpl` 使用 `MerchantPermissionEnumVO.validateGrant`。缺参数/缺前置权限保持 `0002`，未知/不可授予权限保持 `A0006`，混合输入不再依赖 Set 遍历顺序。 |
| 封闭状态与遗漏契约 | 商品报价、订单生命周期和知识索引内部使用本领域 EnumVO；为 Admission、CurrentUser、SubmitMerchantApplication 的 status 生成枚举约束并增加非法值反例。 |
| 聚合半更新及迁移残留 | `ProductAggregate.changeInfo` 全部校验成功后才赋值；移除 Cart/Knowledge 未用 Clock，清理相关 import 和含混依赖命名。 |

本次没有根据后缀强拆 `StockBalanceAggregate` 等对象。商品图片仍使用当前受控 `/media/*.png` 引用，未引入对象存储/CDN；更换存储时需要另行确定资源标识与安全策略，不能把本轮计为完成存储解耦。

## 并发与升级边界

会话租约为 10 分钟，领取和完成均由同一 MySQL 的 `CURRENT_TIMESTAMP(3)` 裁决，不依赖 Java 实例时钟。模型调用不持数据库事务。超期结果返回状态冲突且不保存消息；异常释放必须匹配当前 token，进程终止后由租约到期允许重试。消息、提案和租约完成同事务提交，提案创建失败会一起回滚。

新增迁移 [V20261030_01](../database/migrations/V20261030_01__ai_attempt_and_conversation_lease.sql) 增加三个可空字段。已有库应备份、在维护窗口停止旧版请求并按[显式迁移手册](../database/migrations/README.md)升级，再统一启动新版实例。应用启动仍只校验版本和校验和。不要混跑使用进程锁的旧版实例。

真实 MySQL 测试验证了两个独立服务对象通过不同连接竞争同一会话，并故意让两个 Java 时钟相差两天；只有一个领取成功。也覆盖哈希碰撞的不同会话、旧 token 不能完成/释放新租约、提案失败回滚及外层事务拒绝。这不是生产集群、网络分区或压力测试验收。

## 实际结果

| 验证 | 结果 |
|---|---|
| Maven Wrapper 3.9.9 / JDK 17.0.12 / 隔离 MySQL 8.0.31 `clean verify` | **175 通过，0 失败，0 错误，0 跳过**；其中 40 项真实 MySQL JUnit |
| 真实 Spring/MySQL/FastAPI HTTP | **173 项通过**，117 份严格 Schema 响应通过；本地检索，无远程模型 |
| 真实 Chromium → Spring | **8 项通过**，`apiMockUsed=false` |
| Python | **42 项通过**；保留一项 python_multipart 弃用提示 |
| API/领域/架构门禁 | 93 条路由、58 项 Schema 正反例、56 项领域规则与 5000 步库存序列、13 个架构违规样例拒绝通过 |
| 源码与产物 | 454 个受测源码摘要与最终源码一致；JAR UI 与本次源码编译产物逐文件一致；格式及可读性检查通过 |
| Docker 镜像 | **NOT_RUN**：本机 Docker Engine 不可用 |

[隔离数据库与 JUnit 汇总](evidence/quality-fix-20261030/mysql.json)、[HTTP 原始结果](evidence/quality-fix-20261030/full-http.json)、[真实浏览器](evidence/quality-fix-20261030/frontend-live/results.json)、[Schema 反例](evidence/quality-fix-20261030/api-schemas.json)、[架构拒绝样例](evidence/quality-fix-20261030/boundaries.json)、[其他检查](evidence/quality-fix-20261030/checks.json)、[源码摘要](evidence/quality-fix-20261030/tested-sources.json)、[交付物摘要](evidence/quality-fix-20261030/tested-release-manifest.json)、[Docker 状态](evidence/quality-fix-20261030/containers.json)。

首轮及最终两次完整隔离验收均通过。提交检查清理了迁移文件末尾空行，重新生成校验和后再次完整验证，使最终证据对应提交内容；[首轮结果](evidence/quality-fix-20261030/before-migration-normalization/mysql.json)单独保留。此前开发中的 ProposalVO 编译问题已修正；格式化首次在 Windows 上写两个文件遇到 `UNKNOWN` 错误，重试及随后完整格式检查通过。这些开发检查未计作完整验收。既有历史报告恢复原内容，本轮结果另存上述目录。

测试使用新的临时 MySQL datadir、随机回环端口与独立 Maven 构建目录，未读取私有 `.env`、未操作已有业务库。结束后临时数据库已清理，受测 JAR 保存在忽略目录 `var/quality-fix-20261030/verified-build/`。本轮没有替换运行服务、调用付费模型/Milvus、部署生产或进行性能验收。

## 复现

```powershell
npm run format:check --prefix frontend
python -X utf8 -B scripts/schema_contract.py --check
python -X utf8 -B scripts/verify-api-contract.py
python -X utf8 -B scripts/verify-api-schemas.py --output var/quality-recheck/api-schemas.json
python -X utf8 -B scripts/verify-ddd-boundaries.py --output var/quality-recheck/boundaries.json
$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
python -X utf8 -B scripts/verify-mysql-isolated.py --mysql-bin 'D:\develop\mysql-8.0.31-winx64\bin' --maven .\mvnw.cmd --offline --http-smoke --artifact-dir var/quality-recheck/verified-build --output var/quality-recheck/mysql.json
```

路径按本机调整。`--offline` 要求 Maven 依赖已缓存，HTTP/浏览器阶段需要 Python 依赖、Playwright 与 Chromium。
