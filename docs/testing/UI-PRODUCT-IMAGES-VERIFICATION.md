# 商品图片链路 · 验证报告

> **当前收尾入口**：编辑兼容与逐文件失败的收尾结论、实际命令与本机未验证范围见[第一阶段收尾报告](PRODUCT-IMAGES-PHASE1-COMPLETION-20261105.md)。下文（含顶部“本分支合并”“B 线未纳入”）均为 `ab31f89` 及更早提交的历史范围记录，日期与数字保持原样，不代表当前修复后的结果。

> **2026-11-04 基线整合说明**：本分支由 `codex/product-multi-images`（`53188da`）与本地 `fix/product-multi-images-followup`（`e4cd460`）合并而成。后端“上传对象归属”（迁移 `V20261104_01`、`cat_product_image_upload` 认领校验）与 A 线的“当前读”并发加固均已保留；**B 线的逐项失败列表/重试前端实现及对应浏览器用例未纳入本次整合**，`ProductImageListField.js`、`ui_product_images.py`、`contract_ui.py` 仍为 A 线版本。因此下文关于“失败项可移除后表单恢复”“同一批重复选择只上传一次”的浏览器结论不适用于本分支，需要在后续单独跟进；下文 `verify-mysql-isolated` 的 286 项数字也属 B 线基线的当时记录。
>
> 整合分支当前的 Java 结果为 **292 项 / 0 失败 / 0 errors / 0 skipped**（真实 MySQL + 双 Redis，Windows 本机执行）。`RedisServerFaultIsolationTest` 已对 Windows 的 RST 关闭语义做兼容（仍要求子进程真实退出），不再按平台跳过。
> **后续真实验收（2026-10-29）**：商户页面实际上传图片、创建双 SKU 商品并上架，消费者详情/导购/购物车/订单展示实际图片，MySQL 订单图片快照核对通过，见[本地报告](LOCAL-LIVE-20261029.md)。本次没有穷尽所有换图/移除组合；下文的替身记录保留原边界。

日期：2026-11-04（第一阶段多图修复跟进）。
## 本次已执行
- `cmd.exe /c "...\npm.cmd run format:check --prefix frontend"`：PASS。
- `cmd.exe /c "...\python scripts\build-ui-bundle.py --check"`：PASS，源码与 `frontend/ui.bundle.js`、Spring 静态快照一致。
- `python3 scripts/schema_contract.py --check`：PASS，迁移清单和校验和一致。
- `python3 scripts/verify-api-contract.py`：PASS，95 条路由及 OpenAPI/DTO 契约一致。
- `python3 scripts/verify-api-schemas.py`：PASS，58 项 schema 检查。
- `cmd.exe /c "...\mvnw.cmd -B -ntp -pl campus-shopping-app -am -Dfrontend.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest=ProductInformationAtomicityTest,CatalogCartReadModelTest,CatalogPageSkuBatchTest,InvalidInputContractTest test"`：PASS，Java 17 编译并执行定向 JUnit 17 项。
- `cmd.exe /c "...\python scripts\verify-release.py"`：PASS，静态边界检查；不代表 Spring/MySQL 联调。
- `python3 scripts/verify-java-readability.py`：PASS（11 个受保护文件）；`python scripts/verify-domain.py`：PASS，56 项领域规则；`python scripts/verify-ddd-boundaries.py`：PASS。
- 定向 JUnit `ProductImageContractTest`：PASS 9 项，覆盖 0/1/4/8 张、超 8 张、非法 URL、去重、旧 `imageUrl` 回退、顺序与 provider、不存在/越权/已归属本商品对象、上传登记失败。
- 隔离真实 MySQL 升级/重放验收 `python scripts/verify-mysql-isolated.py --mysql-bin <local> --skip-maven`：PASS，MySQL 8.0.31 临时实例，含新表 `cat_product_image_upload` 的新建/升级/重放与列索引约束一致性。
- 隔离真实 MySQL + Spring + Redis 全门禁 `python scripts/verify-mysql-isolated.py --mysql-bin <local> --maven mvnw.cmd --http-smoke`：**PASS**。Maven `clean verify` 286 项、0 失败、**0 跳过**（临时 Redis 6392/6393 与 `REDIS_TEST_SERVER_COMMAND` 子进程）；`testedSourceMatchesCheckout=true`；JAR 内 UI 与源码构建逐字节一致；真实 HTTP 链路 282 项与 OpenAPI 契约校验（208 个响应）；Redis 双实例共享 9 项；真实浏览器 21 项。
- 上述真实 HTTP 链路新增多图专项：真实上传两张 PNG → 取得不同 `/media` 地址并取到真实 PNG 字节 → 保存 `[第二张, 第一张]` → 消费者读到首图 `imageUrl` 与有序 `images` → 跨商户引用 `A0006` → 不存在对象 `G0001` → 9 张与重复列表 `0002` → 非法写入不推进版本 → 清空后 `imageUrl=''` 且 `images=[]`。
- `CommerceMySqlIntegrationTest` 3 项真实集成用例：多图创建/上架读取/重排/清空/回存、跨商户与伪造/缺失对象拒绝及整体回滚、版本冲突时不提前认领对象。
- 为在 Windows 跑通 Redis 故障隔离用例，`RedisServerFaultIsolationTest` 关闭子进程时同时接受干净 EOF 与 RST（仍要求子进程在超时内真实退出），不改变被测语义。
- 真实 Chromium + 真实 Vue `frontend/tests/ui_product_images.py`：PASS 14 项（本机 Playwright Chromium，仅将脚本中固定 `/usr/bin/chromium` 本机路径适配运行器，未改断言）：演示预览 2 张本地预览且不写后端、非法格式与超 2 MB 不上传、失败项可移除后表单恢复、同一批重复选择只上传一次、逐张上传与 CSRF、创建持久化有序 `imageUrls` + 首图 `imageUrl`、编辑追加/重排并同步首图、清空相册、8 张上限禁用选择、首页/AI 公共占位、`/media` 真实渲染与 404 降级。
- `frontend/tests/contract_ui.py`：PASS 20 项；`frontend/tests/ui_remaining.py`：PASS 32 项。
- `frontend/tests/ui_three_pages.py` 与 `ui_remaining_contract.py` 在本机 Windows 环境失败，在 `fb9ed0f` 基线工作树复现相同失败，不是本次改动引入；本机未重新提交截图/结果证据文件。
- 既有 Chromium/契约替身报告仍保留，不能替代本次新增的多图专项真实后端验收。
以上浏览器/契约替身说明沿用原报告：真实 Vue 和 Chromium 可证明页面及请求构造，但不属于 Spring Boot/MySQL 端到端测试。文件读取与本地选图使用真实 FileReader 和 File input，`/media` 响应由浏览器路由替身提供有效 PNG/404。测试替身会记录请求方法和路径，不保存原始图片 base64 到测试报告。

截图：`docs/testing/evidence/product-image-flow/merchant-create-image.png` 为真实 Chromium 打开的新增商品对话框；照片是本地设计预览素材，`?demo=1` 未调用服务端上传。

## 未执行/范围限制
- **真实浏览器页面级多图交互**仅在契约替身环境执行（14 项）；真实后端浏览器验收（21 项）走的是既有 `live_ui.py` 场景，未逐张重跑多图交互。
- `frontend/tests/ui_three_pages.py` 与 `ui_remaining_contract.py` 在本机 Windows 环境失败，在 `fb9ed0f` 基线工作树复现相同失败，不是本次改动引入；本机未重新提交截图/结果证据文件。
- 本机 Redis 为临时启动的 Redis 3.2.100 两实例（端口 6392/6393，无持久化、随机命名空间），不是生产/Redis 7 环境；既有 6379 上其他项目的键未被读写或清理。
- `npm ci` 在 Linux Node 18 环境失败；随后使用仓库要求的 Windows Node 22.23.2 完成构建和 `--check`。
- 图片持久化卷备份、生产 HTTPS/Cookie 配置、文件存储回收、异地/CDN 部署及七牛对象迁移尚未实测；七牛属于第二阶段。

## 本地验收手册

1. 用真实商户 Owner 登录 `http://127.0.0.1:8091/#/merchant/products`（地址不带 `?demo=1`）。
2. 新增商品，一次选 4 张图片，确认逐张上传、预览与顺序；其中故意混入一张 SVG 和一张超过 2 MB 的文件，确认被拒绝且其余成功项保留。
3. 在基本信息中完成重排（←/→）、删除和再保存；确认首张成为主图，列表与详情顺序一致。
4. 给商品补货、上架，再打开 `/#/` 和 `/#/product/{productId}`，确认图片来自 `/media/` 且轮播可用；AI 有推荐时检查商品图随接口数据展示。
5. 在数据库检查 `cat_product_image` 的 `sort_order/url/provider` 与 `cat_product.image_url`（首张）一致，且 `cat_product_image_upload` 已把对象归属到当前商户与商品。
6. 用另一个商户尝试引用该商户图片地址，确认返回越权；提交不存在的 `/media/{uuid}.png` 和非法路径，确认拒绝且商品数据不变。
7. 保存时故意使用过期 `expectedVersion`，确认图片表不变（不提前认领对象）。
8. 以上通过后再标记“浏览器 + Java/MySQL 联调完成”。
