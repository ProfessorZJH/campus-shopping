# 商品图片第二阶段（QINIU）第一轮真实联调 · 2026-11-05

## 范围与结论边界

本报告记录第二阶段七牛接入在**本机隔离环境**下第一轮真实云抽样联调的实际结果，规则见 [IMG 规格](../specs/UI-PRODUCT-IMAGES.md)（含 IMG-15/16/17）、[ADR-018 / ADR-019](../architecture/decisions.md) 与[配置说明](../operations/QINIU-IMAGES.md)。第二阶段的代码与本地隔离验收见[第二阶段报告](QINIU-IMAGES-PHASE2-20261105.md)。

结论边界（不得外推）：

- **已通过（本轮验收范围）**：真实云上传（累计 **8 个云端对象**，源自 **3 张原始抽样**，其余为验证过程中的重复上传）、云端只读 stat、前 3 个对象的匿名无签名 HTTP 内容一致性（etag + 像素）、真实 Chromium 直连测试域名解码、本机公开测试模式下**第 8 个对象的真实商品页完整链路**、LOCAL 全链路 11/11。各对象的校验范围不齐，逐项见下方表格，不得理解为 8 个均已完成全部内容校验。
- **本机公有 HTTP 第一轮验收结论：PASS**，仅限上述范围（单个 `dev` profile、回环绑定、公有桶、七牛公有测试域名、无签名明文 HTTP）。它是该限定范围的有效验收结论。
- **NOT_VERIFIED（待域名备案）**：正式 HTTPS 下载与浏览器展示（测试域名无可用 HTTPS 证书，需自有域名 ICP 备案后补验）。
- **NOT_VERIFIED（未接入）**：本机 Redis 相关链路（本轮 `REDIS_ENABLED=false`）。
- **NOT_VERIFIED（未执行）**：私有桶真实展示与签名时效；生产与多实例部署、性能。
- 本报告不包含真实域名、对象键、样本原文件名或提示词。

## 环境

| 项 | 值 |
|---|---|
| 平台 | 本机 Windows 11 |
| JDK | 17.0.12（Oracle） |
| 构建 | Maven Wrapper 3.9.9；前端 Node 22.16.0 / npm 10.9.2 |
| 浏览器 | 本机 Google Chrome，headless，真实联网，`--no-proxy-server` |
| 数据库 | 每次运行**全新隔离 MySQL**（独立 datadir + 随机 loopback 端口） |
| Redis | `REDIS_ENABLED=false`（本机 Redis 未接入本验证） |
| 七牛 | SDK 7.19.0；公有测试域名 + 公有桶；固定 region |

隔离约束：隔离联调本身不连接业务库 3306 / Redis 6379，不使用业务凭据，不改云权限与系统配置，不删除或覆盖任何云对象。

关于业务数据库的准确说明：本次早期曾有一次基于完整应用上下文的测试，触发了对默认数据源的初始化尝试（无成功连接证据），随后改为 MVC 切片；上表所述的隔离联调本身始终未连接业务库。

## 已验证事实

### 1. 样本与真实云上传

累计产生 **8 个云端对象**，来自 **3 张原始抽样**，其余为验证过程中对同一批样本的重复上传（用于修复验收脚本并重跑），每个对象均保留、未删除未覆盖。对象与记录不一一对应：前 3 个对象同属**一次** run 与**同一份** manifest；第 5、6 个对象的 manifest 在当时写入失败，事后通过只读云端列表匹配恢复记录。因此本报告不声称「逐张上传即原子写入」。

各对象的实际校验范围如下（勿过度概括）：

| 对象序号 | 来源 | 记录状态 | 已完成的只读校验 |
|---|---|---|---|
| 1–3 | 原始抽样，同一次 run / 同一 manifest | manifest 完整 | **stat 200 + etag 非空**；匿名无签名 HTTP 逐张 200、`image/png`、etag 与 stat 一致、解码宽高与像素（`ImageChops.difference` 为空）与输入 PNG 一致 |
| 4 | 真实页面上传 | manifest 完整 | **仅 stat**（200，fsize/etag 非空） |
| 5–6 | 真实页面上传，manifest 当时写入失败 | 事后通过只读云端列表匹配恢复 | **stat 200、etag 一致、像素一致** |
| 7 | 真实页面上传 | 记录已保存 | **仅浏览器只读解码**（302 → 测试域名图片可解码） |
| 8 | 真实页面完整链路验收 | 单独 manifest | **stat 200；匿名下载 etag 与像素一致；18/18 全项通过** |

- 第 1–3 个对象另做过真实 Chromium 直连测试域名加载：自然宽高与编号 PNG 副本逐张一致，测试域名请求数与对象数相等，域外请求 0，console 错误 0。
- 这组直连结果是「Chromium 直连测试域名」，不是产品 `/media` HTTPS 页面验收。

### 2. 本机公开测试模式的真实商品页完整链路（第 8 个对象，**PASS**）

真实隔离 MySQL + 当前源码构建的 fat JAR（含 `static/index.html` 与 `ui.bundle.js`）+ 真实会话与 CSRF，在**真实页面内选择样本**（未使用任何 fetch 替身、未拦截或伪造响应）：

- 页面内选图 → 前端 api → 真实后端 → 真实七牛上传，上传响应 200 且返回七牛稳定引用；
- 隔离 MySQL 真实核验：对象归属该商户、商品相册单图且顺序为 0、上传被该商品认领；
- 保存与上架均走真实接口并校验业务码 `0000`；
- 匿名详情返回业务成功码且图片与已上传引用一致；
- `/media/qiniu/{uuid}.png` 返回 **302**，`Location` 为**无签名、无查询串**的 `http://<测试host>/...`；
- 真实 Chromium 跟随该 302 完成图片解码，自然宽高与期望一致；
- 文档响应携带真实 CSP，`img-src` 同时含原 HTTPS 源与**精确**的 `http://<测试host>`，`http://` 源计数为 1；
- 异常外域请求 **0**。

本次运行报告：`var/verify/qiniu-live-run-20261105T112259Z-76fcbb.json`，`status=PASS`，**18/18** 检查通过；临时隔离实例已正常关停并清理。

### 2b. 第 7 个对象：单点前置验证

真实隔离 MySQL + 当前源码构建的 fat JAR（含 `static/index.html` 与 `ui.bundle.js`）+ 真实会话与 CSRF：

- `/media/qiniu/{uuid}.png` 返回 **302**，`Location` 为**无签名、无查询串**的 `http://<测试host>/...`；
- 真实 Chromium 跟随该 302 并完成图片解码；
- 文档响应携带真实 CSP，`img-src` 同时含原 HTTPS 源与**精确**的 `http://<测试host>`，`http://` 源计数为 1。

对应的无云写前置断言（`--public-http --preflight`）是**独立执行的无云写运行**：它验证随机合法路径的 302 + 明文 host + 无查询串 + CSP 精确 HTTP 源均成立，并在该运行内停在上传之前（零云写入）。真实的 `--browser-upload` 运行并不执行同一进程里的这个预检分支；实际上传流程的完整性由另一层保护负责：上传前对随机不存在 key 做 HTTPS stat 鉴权预检，只有返回 612 才允许继续，否则中止于上传之前（该保护曾在一次 stat 抖动时按设计触发中止，重试后通过）。

### 3. LOCAL 零云写全链路演练

`LOCAL` provider、不携带任何七牛凭据、不做云网络，其余全部真实（真实隔离 MySQL、真实 Java、真实认证/CSRF、真实页面选文件、真实前端 api → 真实后端 → 本地上传目录、真实创建与上架、真实商品页解码）：

**PASS 11/11**：隔离库启动/建库、Java 启动、注册登录 CSRF、真实管理员商户审核、页面上传返回 LOCAL 路径、商品创建+上架+匿名同图可见、商品页按期望宽高解码、**CSP 保持默认**（`img-src 'self' data:`，`http://` 源 0）、外部请求 0、严格断言全绿。

该演练是诊断，**不是七牛验收**。

## 代码侧定向测试（同一变更）

| 套件 | 结果 |
|---|---|
| `QiniuPublicHttpPolicyTest`（策略：默认关闭、单独 dev、回环字面值、公有桶、严格测试域名形状、大写 host 规范化兼容、负例全覆盖） | 13 / 13 |
| `ProductImageStorageConfigTest`（真实 Spring 装配：默认 dev、显式 dev、dev+prod 混开、非 dev、非回环、默认关闭保持 HTTPS） | 22 / 22 |
| `MediaAssetPublicHttpTest`（真实 MVC 切片：302 明文无查询串、CSP 含原 HTTPS 源 + 唯一精确 HTTP 源、非 UUID 404） | 4 / 4 |
| `MediaAssetContractTest`（默认策略逐字不变） | 7 / 7 |
| 保存/契约/协议/异步等既有七牛套件 | 10 / 10 |

定向合计 **56 / 56**，另在格式修复后复跑其中 46 / 46。`MediaAssetContractTest` 的 `@WebMvcTest` 切片与会话装配不装载数据源、Redis、任务或 AI 适配器，因此不连接 3306/6379。

## 仓库非全量检查

| 检查 | 结果 |
|---|---|
| `python scripts/verify-release.py` | PASS（421 Java / 62 实现 / 39 表 / 11 Mapper / 8 POM，errors 0；`mavenCompiled=false`，仅静态） |
| `python scripts/verify-domain.py` | PASS，`PRODUCTION_DOMAIN_CHECKS=56` |
| `python scripts/verify-java-readability.py` | PASS，11 个受护文件 |
| `python scripts/build-ui-bundle.py` / `--check` | exit 0；`ui.bundle.js` 495.07 kB / gzip 77.19 kB；`UI source/artifacts verified` |
| `npm run format:check --prefix frontend` | 首轮失败（本次 5 个改动 Java 文件）→ 仅格式化这 5 个文件 → **exit 0** |

上述脚本会重写 `docs/testing/evidence/` 下 4 个历史证据文件，已 `git checkout --` 恢复，工作区仅保留预期改动。未运行本机全量 Maven / Compose。

## 构建版本与真实云结果的关系（如实说明）

第 8 个对象的 18/18 真实云联调，使用的是**较早构建**的 fat JAR。此后代码又做了两项收敛，**均不改变本轮成功路径**：

1. profile 比较由 `equalsIgnoreCase` 改为**精确 `equals`**（Spring profile 名区分大小写，只接受真正的 `dev`），并补充对应定向测试；
2. 移除上传回执不匹配日志中的**对象键**（仅保留脱敏状态提示），并在协议测试新增断言证明失败日志不含对象键。

此外还有文档更正与格式规范化。因此：

- **未**以最终未重新构建的版本重跑真实云上传，本报告不声称这一点；
- 本轮联调实际使用的 profile 就是小写 `dev`，在该输入下旧新两种实现的判定结果相同，行为未变；
- 本轮上传回执均为成功分支，不触发被脱敏的那条日志；
- 两项收敛的实际效果（`DEV`/`Dev` 等均拒绝；失败日志不含对象键）由定向单元与协议测试覆盖，不靠真实云重跑证明。

## 已知缺陷与处置

- **验收脚本记录缺陷（用户授权后由 Codex 接手修复）**：页面流程把上传记录同时用于内部（真实对象键）与对外报告（脱敏投影），`save_manifest()` 遍历了脱敏后的列表，导致第 5、6 个对象上传成功但 manifest 缺失。时序如实说明：第 5 个失败后，Pi 又被重试了一次而生成第 6 个，因此当时确实产生了重复上传；用户授权接手后由 Codex 叫停；叫停后以**只读云端列表匹配**恢复两者记录并逐张核验，云对象均保留。后续第 7、8 个用于脚本修复验证与最终验收。该缺陷属本地验收脚本，不影响生产代码与商品链路。
- **验收脚本的三个缺陷（均为脚本问题，已修复）**：
  1. 提交商品后页面重载会销毁 JS 执行上下文，原先的 `wait_for_function` 因此报错；已改用 Playwright `expect_response` 捕获真实 `POST /products` 与 `POST .../publish`，并校验 HTTP 200 + 业务码 `0000`。
  2. SPA hash 导航不产生新文档请求，原先的 `page.goto` 拿不到 CSP 头；已改为从真实 document 响应头捕获，未放宽断言。
  3. **最终根因**：Qiniu 模式下真实 CSP 不含 `unsafe-eval`，脚本的 `wait_for_function` 因此被 CSP 阻断；已改为基于 DOM 的解码轮询（读 `img.complete` / `naturalWidth`），**未放宽 CSP**。

## 环境 workaround（必须显式记录）

本机 JDK 17.0.12 与 21.0.4 的 `PipeImpl` 在系统 `TEMP` 下 AF_UNIX **connect** 失败（bind 成功），回落逻辑未生效，导致 `Selector.open()` 抛 `IOException`，进而使构造 `HttpClient` 的 AI 网关 Bean 创建失败。对照实测：同一 JDK、同一进程参数下，本次新建的临时目录中 Selector / HttpClient / 临时文件 IO 三项全部通过。

处置：**仅对本次隔离 Java 子进程**设置 `TEMP`/`TMP`/`-Djava.io.tmpdir` 指向本次运行新建的空目录。未修改系统环境变量、注册表或其他系统配置，未清理系统 `TEMP` 中既有文件。

这是**本机测试环境绕过**，不表示原生 JDK 17 已修复，也不进入生产代码或生产配置。另需注意：七牛 SDK 直接拼接 `java.io.tmpdir`，该属性必须带结尾分隔符，否则会在工作目录生成同名同级目录。

## 部署与配置事实

- `QINIU_KEY_PREFIX` **当前不生效**：对象命名空间固定 `qiniu/{小写UUID}.png`，代码不读取该变量。
- `QINIU_REGION` 对上传**必填**且只接受固定区域，不支持 `auto`。
- 公有桶 + 本机测试模式生效时下载地址无签名；私有桶与正式环境仍按 HTTPS + 签名。

## 样本保留

本次抽样使用的本地编号 PNG 副本保留在各 run 的 `var/verify/qiniu-live-artifacts/{runId}/` 下（`var/` 已被 gitignore）。云端对象全部保留，未删除、未覆盖。

## 待补（NOT_VERIFIED）

- **待域名备案（已获同意，备案后第二轮验证）**：正式 HTTPS 下载与浏览器展示（测试域名无可用证书）。
- **未接入**：本机 Redis 链路。
- **未执行（需先满足部署/环境条件）**：私有桶真实展示与签名时效；生产与多实例部署、性能。

各项需具备相应条件与证据，不得用本机公有 HTTP 结果代替；用户已同意在域名备案后开展第二轮正式 HTTPS 验证。涉及生产、多实例等部署类操作仍按项目授权规则与仓库门禁执行。

## 结论

- 本机公有 HTTP 第一轮验收在**限定范围**内 PASS：仅对单独 `dev` profile、回环绑定、公有桶、七牛公有测试域名、无签名明文 HTTP 生效。
- 不得外推：正式 HTTPS 下载与浏览器展示（待域名备案）、本机 Redis（未接入）、私有桶真实展示与签名时效、生产与多实例、性能均为 **NOT_VERIFIED**（未执行）。

## 证据位置

| 内容 | 位置 |
|---|---|
| 每次运行的报告与 manifest | `var/verify/qiniu-live-run-*.json`、`var/verify/qiniu-live-objects-*.json` |
| 第 4 张只读 stat | `var/verify/qiniu-live-stat-*.json` |
| Chromium 直连测试域名 | `var/verify/qiniu-live-browser-direct-*.json` |
| LOCAL 零云写演练 | `var/verify/qiniu-local-drill-run-*.json` |
| 临时目录对照探针 | `var/verify/qiniu-live-temp-probe.json`、`var/verify/qiniu_live/probe/` |
| 本机 JDK 绕过说明 | 本报告「环境 workaround」节 |

以上均在 `var/`（gitignored），不随仓库提交。
