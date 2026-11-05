# 商品多图第一阶段收尾（2026-11-05）

## 结论与版本

本报告记录第一阶段的两个收尾修复：**旧客户端编辑商品不再丢失副图**，以及**逐文件失败/重试与部分成功保留**。两者在本工作树完成定向验证；提交、PR 与远端 CI 状态以对应交付 PR 为准。本报告只记录本机验证，**没有**在真实 MySQL/Redis/HTTP 后端或生产环境验收。

- 工作树：`C:/Users/Profe/.codex/worktrees/product-images-phase1/campus-shopping`，分支 `codex/product-images-phase1-completion`，起点 `ab31f89`（GitHub `main`）。
- 环境：JDK 17.0.12、Maven Wrapper 3.9.9、Node 22.16.0（`frontend/package-lock.json` 锁定依赖）、Python 3.11.9、Playwright Chromium 1169（本机 `chrome-win/chrome.exe`）。
- 执行者：Pi 按主控审查意见实现与验证；主控负责审查、语义裁定与接受。模型 `wuxian/deepseek-flash`，思考级别 `max`；未记录任何提示词、凭据或下游异常正文。

## 行为

### 编辑时图片字段兼容

- **创建逻辑不变**：`imageUrls` 缺失或为 null 时回退旧 `imageUrl`；显式 `[]` 创建空相册。
- **编辑**：`imageUrls` 非 null 时优先，显式 `[]` 清空相册。
- `imageUrls` 为 null 时按旧字段判定：`imageUrl` 也为 null 表示本次未提供图片变更，保留现有有序相册与主图；与当前主图相同也保留相册；显式空串（含全空白字符串）沿用旧清空语义；不同有效地址替换旧首图并**只保留原副图**（旧主图不降级为副图）；若该地址已在相册中则升到首位并保留其余全部图片。
- 组合结果复用既有数量/格式/去重校验：不重复、最多 8 张；8 张相册换一张不在相册的新主图仍为 8 张且成功。
- 实现位置：`CatalogServiceImpl.edit` + 私有 `resolveAlbum`。持有商品锁后用 `findAllForUpdate` 当前读相册，保持商品→图片锁顺序；原本无主图时**不**执行空范围锁定查询，直接走 `insertInitial`；归属校验、`expectedVersion` 冲突（`G0002`）与事务回滚语义保持，冲突时不发生图片写入或对象认领。未新增迁移、DTO 字段、Port 或 Controller 编排。

### 前端逐文件校验、部分成功与重试

- 每文件独立校验与上传；合法文件成功即按选择顺序写入表单，同批后续文件非法或网络失败不丢已成功项。
- 失败项记录文件名与原因，提供逐项「重试」/「移除」；非法类型、空文件、超 2,000,000 字节不发任何上传请求，重试同样先校验。
- 同一批内按 `name + size + type` 判重（明确不是内容哈希），重复项只上传一次并以可移除失败项报错；跨批重选不受影响。
- 未解决失败项或未恢复错误（重挂载时 `props.invalid`、整批超限）使父表单 `invalid=true`、保存禁用；删除/排序成功图片不会解除；只有逐项移除、重试成功、显式「放弃本次图片选择」或上下文重置才恢复。放弃选择保留已成功上传的图片。
- 保留原有边界：商户/商品上下文、身份与路由变化、卸载后的迟到结果不写回；`?demo=1` 纯本地 Blob、不写真实表单数据；Blob 在移除与卸载时释放；最多 8 张、首图为首项、CSRF 与上传契约不变。
- 未新增或修改 DTO/生成契约字段、迁移、Port 或 Controller。

## 实际执行与结果

| 命令 | 结果 |
|---|---|
| `.\mvnw.cmd -B -ntp -pl campus-shopping-app -am -Dfrontend.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest=ProductImageContractTest test` | **18 tests / 0 failures / 0 errors / 0 skipped**，BUILD SUCCESS |
| `node --test tests/product-image-list.test.mjs`（`frontend/`） | **17 tests / 17 pass / 0 fail / 0 skipped** |
| `python var/verify/run_product_images.py`（临时运行器，仅把 `chromium` 解析到本机 Playwright Chromium；真实 Chromium + 真实 Vue + API 契约替身） | **PASSED 20 checks**，无未捕获 JS 错误、无未定义契约路由 |
| `npm run format:check --prefix frontend` | PASS，`All matched files use Prettier code style!` |
| `python scripts/build-ui-bundle.py` / `--check` | 生成成功 / `UI source/artifacts verified` |
| `python scripts/verify-release.py` | exit 0，`errors: []` |
| `python scripts/verify-domain.py` | exit 0，`PRODUCTION_DOMAIN_CHECKS=56` |
| `python scripts/verify-ddd-boundaries.py` | exit 0，`errors: []` |
| `python scripts/verify-java-readability.py` | exit 0，11 个受保护文件通过 |
| `python scripts/verify-api-contract.py` | exit 0，PASS（静态契约，不含 Maven/Spring/MySQL 真实通路） |
| `python scripts/verify-api-schemas.py` | exit 0，`PASS 61 schema checks` |
| `python scripts/schema_contract.py --check` | exit 0，`Schema version/checksum contract verified` |

补充说明：

- Java/JUnit 红回归：兼容规则先写 `ProductImageContractTest` 新增用例，先得到 **17 项中 5 失败**（其中 4 项为真实丢副图/锁读红回归，1 项是按当时理解的「9 张拒绝」夹具，经审查改为 8 张换新主图仍成功），修复后 18/18 绿。
- Node 红回归：先新增 9 项形成 **15 项 / 9 失败**，实现组件后仅剩 3 项（含两处夹具问题）；再补 2 项状态回归（新选有效不解锁、重挂载后移除不解锁）到最终 **17 项**，全绿。夹具问题指 `successful multi-image` 用例被编辑截断的语法、以及 retry 迟到隔离用例错误地假设父表单被清空，未通过放宽断言过绿。`invalid/excessive` 用例把「最后一个事件必须 invalid」改为检查父 `props.invalid` 与最后一个 `invalid` 事件，消除事件顺序耦合但保留非法/超量零请求断言。
- 浏览器用例计数口径：`main` 基线 13 项 → 当前 20 项（+7）。原「连续选非法→选正常即恢复」的旧预期按新语义拆成「新选正常图仍阻断」+「显式放弃后恢复」，断言未减少。
- `npm ci` 首次失败：本机 RPC PowerShell 缺 `ComSpec/SystemRoot` 导致 `@npmcli/promise-spawn` 取不到 shell；显式设置 `ComSpec`、`SystemRoot`、`PATHEXT` 与 PATH 后按锁文件重装成功（29 packages，未升级依赖）。
- PNG/404 图像资源范围：仅浏览器脚本内部夹具。失败列表截图场景单独预路由 `/media/**` 返回测试 PNG、占位 SVG 复用 `frontend/public/images/product-placeholder.svg`，并断言 `naturalWidth>0` 后才截图；`/media` 真实加载与 404 回退原断言未放宽。目视证据在忽略目录 `var/verify/ui-product-image-partial-failure.png`。

## 明确未验证

- **真实 MySQL/Redis**：`CommerceMySqlIntegrationTest#productImagesRemainConsistentAcrossWritesRollbackAndLegacyRequests` 已按新规则同步旧断言，并补充「同主图普通编辑保留副图」「两字段均 null 不改图」「新主图替换首图保留副图且主图/引用一致」，但**本机未执行**（只做了 `test-compile`）；本轮未启动数据库、未执行迁移，也未跑全量 `mvnw clean verify`。这些集成断言留给远端隔离 CI 或授权后的隔离 MySQL 环境验证。
- **真实后端/前端联调**：Chromium 场景使用 API 契约替身，不是 Java/MySQL 端到端；未做真实 HTTP 多图专项。
- **第二阶段**：未接入七牛 Kodo/CDN，未做对象释放/回收、历史对象迁移或性能验证。本地 `feat/qiniu-image-storage` 分支最近 8 项提交属于旧多图 B 线，分支名不代表已实现七牛。
- 本机未部署，也未执行真实 MySQL/Redis/HTTP 全量、真实外部 AI 或七牛联通；源码与定向测试、静态门禁通过不等于真实后端或生产验收通过。
