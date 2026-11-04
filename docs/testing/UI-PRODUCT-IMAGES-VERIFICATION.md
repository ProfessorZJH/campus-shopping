# 商品图片链路 · 验证报告

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
- 隔离真实 MySQL + Spring `python scripts/verify-mysql-isolated.py --mysql-bin <local> --maven mvnw.cmd`：Maven `clean verify` BUILD SUCCESS，286 项，0 失败/错误，9 项跳过（8 项 Redis 条件用例 + 1 项 `REDIS_TEST_CACHE_ADDRESS` 未配置的 Redis 缓存用例）。新增 `CommerceMySqlIntegrationTest` 3 项真实集成用例：多图创建/上架读取/重排/清空/回存、跨商户与伪造/缺失对象拒绝及整体回滚、版本冲突时不提前认领对象。
- 上述脚本因 `skipped != 0` 断言未通过，其整体状态为 FAIL：本机无隔离 Redis 实例（无 redis-server，Docker 守护未运行），Redis 相关 9 项不能计为通过；未完成的后续步骤包括脚本内的 JAR-UI 一致性与发布清单生成。
- 真实 Chromium + 真实 Vue `frontend/tests/ui_product_images.py`：PASS 14 项（本机 Playwright Chromium，仅将脚本中固定 `/usr/bin/chromium` 本机路径适配运行器，未改断言）：演示预览 2 张本地预览且不写后端、非法格式与超 2 MB 不上传、失败项可移除后表单恢复、同一批重复选择只上传一次、逐张上传与 CSRF、创建持久化有序 `imageUrls` + 首图 `imageUrl`、编辑追加/重排并同步首图、清空相册、8 张上限禁用选择、首页/AI 公共占位、`/media` 真实渲染与 404 降级。
- `frontend/tests/contract_ui.py`：PASS 20 项；`frontend/tests/ui_remaining.py`：PASS 32 项。
- `frontend/tests/ui_three_pages.py` 与 `ui_remaining_contract.py` 在本机 Windows 环境失败，在 `fb9ed0f` 基线工作树复现相同失败，不是本次改动引入；本机未重新提交截图/结果证据文件。
- 既有 Chromium/契约替身报告仍保留，不能替代本次新增的多图专项真实后端验收。
以上浏览器/契约替身说明沿用原报告：真实 Vue 和 Chromium 可证明页面及请求构造，但不属于 Spring Boot/MySQL 端到端测试。文件读取与本地选图使用真实 FileReader 和 File input，`/media` 响应由浏览器路由替身提供有效 PNG/404。测试替身会记录请求方法和路径，不保存原始图片 base64 到测试报告。

截图：`docs/testing/evidence/product-image-flow/merchant-create-image.png` 为真实 Chromium 打开的新增商品对话框；照片是本地设计预览素材，`?demo=1` 未调用服务端上传。

## 未执行/范围限制
- **真实浏览器多图专项验收已在替身环境执行（14 项），但未连接真实 Spring Boot 后端**：页面与请求构造为真实 Vue/Chromium，API 为契约替身。
- **真实浏览器多图专项验收未执行。** 现有报告的 11 项主图/契约替身检查不覆盖 0/1/4/8 张、部分失败恢复和多图轮播全组合（源代码已实现，未在真实 Chromium 中回归）。
- **Redis 相关 9 项集成用例未执行**：本机无隔离 Redis，`REDIS_ENABLED=false`；按仓库规则不能记为通过。
- **真实 HTTP 层（Session/CSRF 上传接口）多图验收未执行**：本次多层验证在 Domain/Case/Repository + MySQL 链路完成，上传控制器与静态资源未做真实 HTTP 回归。
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
