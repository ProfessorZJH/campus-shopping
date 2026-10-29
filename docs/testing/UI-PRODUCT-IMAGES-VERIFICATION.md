# 商品图片链路 · 验证报告

日期：2026-10-28。

## 已实测

- `python scripts/build-ui-bundle.py`：Chromium 编译 **16 个 Vue 模板**通过，输出 `frontend/ui.bundle.js`。
- `python scripts/install-frontend-ui.py`：同步 UI、图片占位 SVG 到 Spring Boot 静态资源目录。
- `python frontend/tests/ui_product_images.py`：**11 项通过**。检查上传字节/CSRF、图片格式/大小拒绝、商品创建与编辑 URL 持久化请求、移除主图、演示禁写、商品及 AI 缺图占位、Chromium `/media` 正常/404 时渲染与降级。
- `python frontend/tests/ui_three_pages.py`：**23 项通过**。
- `python frontend/tests/ui_remaining.py`：**32 项通过**（覆盖 26 个路由）。
- `python frontend/tests/ui_remaining_contract.py`：**9 项通过**。
- `python frontend/tests/contract_ui.py`：**20 项通过**。

以上浏览器均运行真实 Vue 和 Chromium，**真实 Java API 使用明确的测试替身**，不属于 Spring Boot/MySQL 端到端测试。文件读取与本地选图使用真实 FileReader 和 File input，`/media` 响应由浏览器路由替身提供有效 PNG/404。测试替身会记录请求方法和路径，不保存原始图片 base64 到测试报告。

截图：`docs/testing/evidence/product-image-flow/merchant-create-image.png` 为真实 Chromium 打开的新增商品对话框；照片是本地设计预览素材，`?demo=1` 未调用服务端上传。

## 未通过/未执行

- **真实 Spring Boot + MySQL 商品创建/图片访问联调未执行。** 需本地启动服务、登录商户、实图上传并验证持久化与同源 GET `/media/*.png`。
- `npm install --offline --ignore-scripts` 实际执行失败（`ENOTCACHED`：缺少 Vite 包缓存），所以**完整 Vite/npm 构建未验证**；离线 Vue 预编译已通过。
- 图片的持久化卷备份、生产 HTTPS/Cookie 配置、文件存储回收、异地/CDN 部署尚未实测。

## 本地验收手册

1. 用真实商户 Owner 登录 `http://127.0.0.1:8091/#/merchant/products`（地址不带 `?demo=1`）。
2. 新增商品，选取 2 MB 以内 JPG/PNG/GIF，看到“上传成功”，填写商品名、规格、售价并保存。
3. 在商户商品列表选中该商品 → **基本信息** → 换图 → 保存；再执行一次移除图片并保存。
4. 给商品补货、上架，再打开 `/#/` 和 `/#/product/{productId}`，确认图片来自 `/media/`；AI 有推荐时检查商品图随接口数据展示。
5. 在数据库检查 `catalog_product.image_url`（以当前 DDL 实际表名为准），只应存在服务器路径而不是 base64。
6. 故意提交 SVG、超过 2MB、假冒图片 MIME 和超过 1200 万像素的图片，确认浏览器/后端拒绝；使用不同商户账号验证越权拒绝。
7. 以上通过后再标记“Java/MySQL 联调完成”。
