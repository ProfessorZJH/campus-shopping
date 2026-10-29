# 青柠校园 · H5 + 商户 / 平台前端

当前项目中基于 Vue 3 的同源 SPA，按身份使用 H5 或桌面管理端。本次补齐消费者购物闭环、商户经营操作、平台审核监管页面，保留先前高保真首页、AI 导购和商户商品管理。

## UI-06 前端精简与移动导航

商户角色权限：`#/merchant/roles`；Owner 可编辑自定义角色并在 `#/merchant/team` 分配成员。权限卡只显示功能名称，不显示内部权限代码。商户与平台的移动端采用横向导航，自动显示当前选中页面；与桌面菜单使用相同的权限判定。`?demo=1#/merchant/roles` 展示只读权限示例，真实写操作始终禁用。运行 `python frontend/tests/ui_copy_polish.py` 查看专项浏览器检查。

## 商品主图（IMG-01）

- 商户 `#/merchant/products` 的“新增商品”和“基本信息”中可选择 JPG、PNG、GIF（不超过 2,000,000 字节），预览并上传主图。
- 先调用 `POST /api/v1/merchants/{merchantId}/images` 获取 `/media/*.png`，后续创建或编辑商品才把 `imageUrl` 保存到商品记录。
- `?demo=1` 仅本地预览文件，不上传、不保存；商品列表、消费者详情、AI 推荐等无图片时统一展示占位图。
- 实现规格与测试：[规格](../docs/specs/UI-PRODUCT-IMAGES.md) · [验证记录](../docs/testing/UI-PRODUCT-IMAGES-VERIFICATION.md)。

## SDD-02 商品/订单读模型

- 购物车与 AI 提案商品主图由 Java API 响应；历史订单只使用**成交时 `OrderItemResponseDTO.imageUrl`**，空值显示通用占位图，不读取当前 Catalog 兜底。
- 商品、商户、订单等列表采用新增 `/page` 接口，返回 `items/page/size/total/hasNext`；商户商品页签数字来自服务端总数而不是当页行数。
- 相关规格及检查：[`SDD-INTEGRATION-02.md`](../docs/specs/SDD-INTEGRATION-02.md)，`python frontend/tests/ui_sdd_integration.py`。完整 Java + MySQL 联调尚未验收。

## 预览与真实运行

- `?demo=1` 显式开启离线设计预览；使用 `src/services/demo.js` 和 `pages-demo.js` 中的样例数据，写操作禁用。
- 不带 `demo=1` 时调用真实 `/api/v1`，Cookie Session + CSRF；业务失败需检查 `Response.code`。
- 提供两个开发入口：`npm install && npm run dev`（Vite；需先安装依赖），或使用附带 `ui.bundle.js`（已由真实 Chromium 预编译，不需要 npm）。

### 离线浏览

在 `campus-shopping` 项目根目录：

```bash
python -m http.server 4179 --directory campus-shopping-app/src/main/resources/static
```

浏览器打开 `http://127.0.0.1:4179/?demo=1#/`，点底部导航即可进入购物车、订单、个人中心；商户和平台端分别使用 `#/merchant` 与 `#/admin`。这不是后端联调模式。

### 后端同源模式

启动 Java 端后打开 `http://127.0.0.1:8091/#/`。不要添加 `demo=1`。后端各接口详情见 `docs/api/http-api.md`；第一次登录请通过右上角登录入口使用真实账号。

## 路由

消费者：`#/` 首页，`#/ai` AI 导购，`#/product/{id}` 商品详情，`#/cart` 购物车，`#/orders` 订单，`#/orders/{id}` 自提与售后，`#/account` 个人中心，`#/apply` 商户申请，`#/invitations` 邀请。

商户：`#/merchant` 概览，`#/merchant/products` 商品，`#/merchant/inventory` 库存，`#/merchant/orders` 订单，`#/merchant/pickup` 核销，`#/merchant/aftersales` 售后，`#/merchant/team` 员工，`#/merchant/settings` 门店，`#/merchant/knowledge` 知识库。

平台：`#/admin` 概览，`#/admin/applications` 入驻审核，`#/admin/merchants` 商户监管，`#/admin/products` 商品监管，`#/admin/orders` 订单监管，`#/admin/disputes` 争议，`#/admin/categories` 类目，`#/admin/knowledge` 知识库。

详见 `docs/specs/UI-REMAINING-PAGES.md` 与 `docs/testing/UI-REMAINING-PAGES-VERIFICATION.md`。

## 源码结构

`src/pages/` 每个业务页面为独立 Vue 组件；`src/components/` 共享页面壳和登录弹层；`src/services/api.js` 维护真实 Java API 与 CSRF；`src/services/store.js` 管理必要的界面共享状态；`src/styles/app.css` 为统一视觉体系。没有为了页面生成假后端接口。

其他尚未迁移的旧界面原样保留在 `/legacy.html`，避免迁移时破坏历史演示功能。已移除旧导航中对购物车、订单等入口的禁用处理。
