# 商品图片第二阶段（QINIU）实施与本地验证 · 2026-11-05

## 范围

在既有 IMG 基线上增加可选七牛对象存储：provider 默认 LOCAL；QINIU 使用稳定引用 `/media/qiniu/{小写UUID}.png`，读取经应用 302 投影到配置的 HTTPS 下载域名。复用 `cat_product_image` / `cat_product_image_upload`，**无新增数据库迁移**。规则见 [IMG 规格](../specs/UI-PRODUCT-IMAGES.md)、[ADR-018](../architecture/decisions.md)、[配置说明](../operations/QINIU-IMAGES.md)。

## 代码改动（本报告对应的提交内容）

- `QiniuObjectGateway`：SDK 固定 7.19.0；`Auth` 与 `UploadManager` 均为 final 字段，不继承、不反射、不改全局 stderr；上传改用 SDK 异步 `asyncPut(png, key, token, null, "image/png", true, callback)` 并以 `CompletableFuture<Response>` 桥接，替代同步 `put` 内部对响应解析失败的栈输出。
- 新增私有 `awaitUpload`：固定 60 秒有界 `get`；超时、中断、`ExecutionException`、启动 `IOException` 及运行期异常统一转脱敏 `AppException(UN_ERROR)`，不带 cause 或异常正文，中断恢复线程标记。等待失败时 `cancel(false)`；取消失败且已正常完成则 `getNow(null)` 并关闭迟到响应，覆盖超时竞争。正常返回的 `Response` 仍由 `upload` 原有 `finally` 关闭，成功后继续校验 `isOK`、回执 key 与 hash。
- 保留：上传前字节/像素校验与 PNG 重编码、token 限定 object key、`image/png` 与 CRC、失败不返回可认领 URL、商品事务不访问云端、LOCAL 旧地址与静态资源语义。
- 前端（本轮修复）：新增窄共用校验 `frontend/src/services/media-url.js`，只返回通过校验的**原始**路径，不 trim、不做大小写归一；LOCAL 保留旧宽松字符集，QINIU 仅接受 `/media/qiniu/{小写分组 UUID}.png`。`ProductImageField`、`ProductImageListField` 均改用它，修复之前两条正则拒绝后端 QINIU 上传结果、导致真实上传失败的问题。另显式拒绝前后空白/换行：JS 的 `$` 会在末尾换行前匹配，仅靠正则会把 `路径.png\n` 判为合法。契约替身 `contract_ui.image_fields` 同步为与服务端 `IMAGE_URL` 一致的 LOCAL/QINIU 形状，并按 url 前缀标记 `provider`。

## 实际执行结果（本地 Windows、JDK 17.0.12、Maven Wrapper 3.9.9）

| 命令 | 结果 | 证据 |
|---|---|---|
| `.\mvnw.cmd -B -ntp -pl campus-shopping-app -am test '-Dtest=ProductImageContractTest,QiniuImageContractTest,InvalidInputContractTest,ProductImageStorageConfigTest,MediaAssetContractTest,QiniuObjectGatewayProtocolTest,QiniuObjectGatewayAsyncTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dfrontend.skip=true'` | **55 tests / 0 failures / 0 errors / 0 skipped**，BUILD SUCCESS，LASTEXITCODE=0 | `var/verify/qiniu-phase2-final-targeted-tests.log` |
| `python scripts/verify-qiniu-csp-browser.py`（Playwright bundled Chromium） | **PASS 9/9 checks**：允许图解码宽 4、CSP 页 blocked 拦截函数 0 次调用、无 CSP 对照页 1 次调用且宽 4、302、aborted 0 | `var/verify/qiniu-phase2-csp-browser.json` |
| `node --test frontend/tests/*.test.mjs`（组件级） | **31 tests / 31 pass / 0 fail**（含新增单图组件 QINIU/非法形状/空白换行用例、相册 QINIU 混合顺序与非法拒绝） | 本机控制台（`frontend/tests/*.test.mjs`） |
| `python frontend/tests/ui_product_images.py`（真实 Chromium + API 契约替身，离线） | **PASS 24/24 checks**（原 20 项保留 + 4 项新增：QINIU 回显并渲染、LOCAL/QINIU 混合保序、大写 UUID 与外链拒绝、保存后主图与 provider 顺序） | 本机控制台 |
| 本地轻量门禁：`npm run format:check --prefix frontend`、`build-ui-bundle.py --check`、`schema_contract.py --check`、`verify-supply-chain.py`、`generate-api-contract.py`、`verify-api-contract.py`、`verify-api-schemas.py --output var/verify/...`、`verify-java-readability.py`、`verify-release.py`、`verify-domain.py` | 全部 exit 0（生成契约 95 条路由、72 schema checks、11 个受保护文件、56 项领域检查） | `var/verify/qiniu-phase2-quality-gates.json` |

协议测试使用本地 Node HTTP stub（`qiniu-http-stub.mjs`）绑定回环地址，验证真实 SDK 7.19.0 的 multipart/object key/`image/png` 发送与回执处理；不连接真实七牛。存储装配测试只用 `ApplicationContextRunner` 加载 `ProductImageStorageConfig` + `QiniuObjectGateway` + 固定 UTC `Clock`，覆盖 LOCAL 全空离线启动、QINIU 缺项与部分配置启动失败、完整假配置下 LOCAL 为 `configured=true/uploadEnabled=false`、QINIU 为两者均 `true`，以及 host/TTL/超时/重试/region 校验、域名规范化、私有/公开下载地址结构与稳定引用形态。异步桥接单元测试只替换本网关持有的 SDK `UploadManager` 字段，不反射 SDK 内部，也不等待 60 秒。媒体入口 MVC 测试使用真实 Controller → 领域引用校验 → 真实签名器，仓储与身份为替身。浏览器验证使用真实 Chromium + 真实 Spring CSP，下载域名与 302 后端为本地测试对端。全部使用假凭据，不发起真实云或外网请求。

新增的 `CommerceMySqlIntegrationTest` 七牛用例（HTTP 上传与混合相册、跨商户/跨商品/未登记/非法形状拒绝、云上传失败与库存初始化故障回滚）本轮**未执行**，仅通过 `testCompile`：本机没有隔离 MySQL 环境，需在隔离库执行后另行记录。

## 失败与修复记录

- 协议测试首轮 2 errors：一度按 `ak:policy:sign` 假设解析凭证，实测 7.19.0 为 `ak:encodedSign:encodedPolicy`；另有 Windows 下 Node stderr 句柄延迟释放导致 `@TempDir` 清理报错，改为有界重试删除，未放宽断言。
- `ProductImageStorageConfigTest` 首轮 13 项中 1 项失败：断言取 Spring `BeanCreationException` 外层 message，改为沿 cause 链聚合后仍断言“启动失败 + 根因指向七牛配置”。
- 浏览器 CSP 首轮失败于 Playwright `route` 只处理 redirect 链首个 URL，改为 CDP `Fetch.requestPaused` 后通过；另修正对照页可能走真实 DNS 与计数共享问题。
- region 收口首轮 21 项 1 失败：以末尾换行作非法 access-key 样本，但既有 `text().trim()` 会规范化两端空白；保留 trim 语义，改用归一化后仍非法的内部字符样本。
- **前端上传结果校验遗漏（本阶段审查发现）**：`ProductImageField` / `ProductImageListField` 仍用旧 `/^\/media\/[a-f0-9-]+\.png$/` 校验上传响应，会拒绝后端新的 `/media/qiniu/{UUID}.png`，导致 QINIU 模式下真实上传在前端即失败。已抽成共用窄校验并补组件与浏览器回归；期间另发现仅靠正则时 `路径.png\n` 会被 `$` 判为合法，已显式拒绝前后空白/换行且不做归一化。契约替身 `image_fields` 原先只允许 LOCAL 形状（会误拒 QINIU），已同步为与服务端一致的形状。
- 首轮日志部分已被重跑覆盖，控制台摘录保留在 `var/verify/*-first-failure.log`，文件头标注为转录而非原始日志。
- **PR #53 首轮 CI（run 41992440579）失败**：`Actual delivery images / isolated Compose transaction chain` 在 `Build and verify delivery images` 阶段失败。镜像构建阶段 `mvn verify -Dfrontend.skip=true` 执行到 `QiniuObjectGatewayProtocolTest` 时报 `Cannot run program "node": error=2, No such file or directory`（2 个 ERROR），原因是 Maven build 阶段只安装了 python3，Node 仅存在于 frontend 阶段。非网络偶发，不重跑碰运气。修复：在 build 阶段从同一锁定的 `node:22.16.0-bookworm-slim` frontend 阶段 `COPY /usr/local/bin/node`，不引入 apt 浮动 Node、不把 Node 带入最终 JRE 运行层、不删除或跳过该测试。节点二进制由 Debian bookworm 构建、build 阶段为 Ubuntu 同 x64 平台，兼容性以远端 Docker 构建实测为准。原始日志：`var/verify/ci-53-images-first-failure.log`（含 ANSI）与 `.clean.log`（去转义）。
- **PR #53 首轮 CI 主 job（`Maven / MySQL / FastAPI / Browser E2E`，job 127127600172）失败**：`Real Maven build + MySQL tests` 步结果为 339 tests / 8 errors / 0 failures / 0 skipped，两个测试装配根因：
  1. 新增回滚用例在事务外对 `@SpyBean` 的 `inventoryService.initialize`（`PROPAGATION_MANDATORY`）做 `doThrow().when(...)`，Spring AOP 先拒绝事务（`IllegalTransactionStateException`）并产生 `UnfinishedStubbing`，污染后续 `suspendBlocksNewOrdersButNotPaidFulfillment`。修复：按已有 `addSkuViewFailureRollsBack` 写法，用 `TransactionTemplate.executeWithoutResult` 在事务内仅设置 stub；生产 `MANDATORY` 不变，真实回滚仍由 HTTP 创建在 Case 事务中验证。
  2. `ShoppingEvaluationFixture` 会手动 `new CommerceMySqlIntegrationTest()` 后 `autowireBean`，而两个评测上下文未启用 MVC；新增的 `@Autowired MockMvc` 字段导致 `ShoppingEvaluationMySqlTest`（1 error）与 `ShoppingEvaluationSafetyMySqlTest`（5 errors）装配失败。修复：该字段改为 `@Autowired ObjectProvider<MockMvc>`，仅在 HTTP 辅助方法中 `getObject()`；主类仍保留 `@AutoConfigureMockMvc`，真正调用 HTTP 的 3 个新用例缺 MVC 仍会硬失败。
  - 原始日志：`var/verify/ci-53-mysql-first-failure.log`（含 ANSI）与 `.clean.log`（去转义）。

## 固定区域收口（2026-11-05）

SDK 7.19.0 的 `FormUploader` 在 `asyncRetryUploadBetweenHosts` 中捕获 `ConfigHelper.upHost` 的 `QiniuException` 后仍调用 `printStackTrace`；`autoRegion` 的区域发现失败会进入该分支。固定区域（`z0`/`z1`/`z2`/`na0`/`as0`/`cn-east-2`）不发起区域查询，因此本次要求上传必须显式配置固定 region，留空或 `auto` 启动失败，并显式设置 `useDefaultUpHostIfNone=false` 防止缺 host 时回落默认上传域名。另一处 `asyncRetryUploadBetweenRegion` 会无条件解析上传凭证，只有凭证格式异常才会打印栈；凭证由 `Auth.uploadToken` 生成，因此限制 access-key 为 `[A-Za-z0-9_-]`（token 首段为 AK 原文）即可使该分支不可达。secret-key 仅作 HMAC 密钥、不原样拼入 token，校验只排除内部空白/换行。以上均未改动全局 stderr、未反射 SDK、未自研低层上传。

## 未运行 / 待验证

- 真实七牛云上传、下载签名时效、私有桶策略与真实 CDN：**NOT_RUN**（本机无凭据，未连接任何真实云）。
- 真实 MySQL/Redis 集成、`mvnw clean verify` 全量、浏览器端到端、CI 与镜像、性能与容量：本报告只记录当前本地已执行范围；隔离 MySQL/Redis 与全量验证已在本次授权范围内，将在对应 PR 的 CI 执行后以其最新 Checks 为准，不回填到本报告。
- 新增的 `CommerceMySqlIntegrationTest` 七牛用例仅完成编译，**未在本机运行**，不得计为 MySQL 验收通过。
- 历史记录（仅供对照，不作为本次通过）：commit `2159d51` 的 run 41993898230 五个必需 job 均 success（1 个 optional 跳过），主 job 为 339 tests / 0 failures / 0 errors / 0 skipped，Spring CSP Chromium 9/9；但该 head **不包含**本轮的 QINIU 前端校验修复，最终状态仍以新 head 的完整 CI 为准。
- 自动删除、对象释放/跨商品复用、历史对象迁移：本次未实现、未验收。
