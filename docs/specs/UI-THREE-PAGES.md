# UI-03｜前三张高保真页面实现规格（2026-10-28）

## 目标与优先级

按照本项目现有参考设计，交付 **消费者 H5 首页、消费者 AI 导购、商户商品管理** 三个真实 Vue 3 页面。保留现有 R1 Java/Python 接口协议、Session + CSRF 以及小傅哥 DDD 后端结构。

优先级：视觉结构与交互 > 设计图虚构的宣传/统计数据。允许使用设计图中的局部商品、机器人和类别图片；**禁止整张截图作背景**。禁止展示未经后端支持的真实支付、优惠券、虚构增幅、排名、自动扣库存。面板不用长篇中文操作说明；状态与错误提示保留必要的中文。

## 前端路由和页面要求

| 路由 | 页面 | 主要交互 | 验收 |
|---|---|---|---|
| `/#/` | 消费者首页 | 搜索、热门词、分类、商户、库存/价格排序、商品详情、规格、加购 | 430px 无横向溢出；加购校验后端实时报价和库存 |
| `/#/ai` | AI 导购 | 快捷提问、聊天、引用、真实模式标签、推荐勾选、明确确认提案 | 预览模式禁止执行加购；真实模式需登录且请求 AI Proposal |
| `/#/merchant/products` | 商户商品管理 | 商户上下文、搜索、分类、状态、SKU 详情、补货、创建商品、改价、上下架 | 1448px 商户列表+详情；用户必须具商户权限；补货有幂等键 |

`?demo=1` 只为视觉预览启用，页面顶部显式显示“设计预览/演示数据”，写操作均禁用。正常浏览不自动注入假商户与价格。

## 接口对照（均对应 R1 Java HTTP 路由）

| 场景 | 方法 | 路径 |
|---|---|---|
| 公开商户 / 类别 / 商品搜索 | GET | `/api/v1/merchants/public`, `/api/v1/categories`, `/api/v1/products` |
| 商品详情、再校验 | GET | `/api/v1/products/{productId}` |
| 查询/更新本人购物车 | GET / PUT | `/api/v1/cart` |
| AI 会话 / 确认 / 拒绝 | POST | `/api/v1/ai/chat`, `/api/v1/ai/proposals/{proposalId}/confirm`, `/api/v1/ai/proposals/{proposalId}/reject` |
| 登录 / 注册 / 身份 / CSRF | POST / GET | `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/me`, `/api/v1/auth/csrf` |
| 商户上下文与列表 | GET | `/api/v1/workspace`, `/api/v1/merchants/{merchantId}/products`, `/api/v1/merchants/{merchantId}/stocks` |
| 新建/编辑/上下架商品 | POST / PUT | `/api/v1/merchants/{merchantId}/products`, `/.../products/{productId}`, `/.../products/{productId}/publish` |
| 改 SKU 价 / 库存补货 | PUT / POST | `/api/v1/merchants/{merchantId}/products/{productId}/skus/{skuId}/price`, `/api/v1/merchants/{merchantId}/stocks/{skuId}/replenish` |

统一 `Response.code==='0000'` 才是成功；写入携带 Session Cookie / CSRF，补货带 `Idempotency-Key`；重复补货请求在参数不变时复用同一键直至成功。AI 只提交提案，不能跳过 Java 校验。

## 页面视觉约束

- 消费者端：白底、轻蓝和薄荷绿、品牌主色 #08bfb0，分类真实图片卡、商品两列流、底部五个导航位。仅本批首页和导购为可用页，其余按钮禁用并标注未开发，不模拟成功。
- AI 页：机器人主视觉、快捷询问、双方气泡、3 卡横向推荐、价格、提案确认，保留输入框。屏幕实际顶部导航和操作区固定到视口位置。
- 商户端：桌面 210px 导航、数据条、商品主表 + 右侧 SKU 检查器，列表和详情信息密度合理；只保留小型库存概览，不制作套娃工作台。
- 移动端不全页横向滚动；桌面表格可在窄屏容器内水平滚动。

## 实施映射

- 可维护源：`frontend/src/`（Vue3 组件 + 原生 CSS）、`frontend/index.html` + `frontend/vite.config.js`。
- 离线发布：`scripts/build-ui-bundle.py` 在 Chromium 中将组件模板预编译成 `frontend/ui.bundle.js`，运行时不需要 `unsafe-eval`。
- 后端发布：`scripts/install-frontend-ui.py` 同步同源静态资源到 `campus-shopping-app/src/main/resources/static/`，保留旧 R1 页面 `/legacy.html`；`SessionSecurityConfig` 只新增 UI 静态 GET 资源白名单。
- 新版首页 `index.html` 与旧业务全页面 `legacy.html` 共存，旧页面仍可用于尚未迁移的购物车、自提、管理员等功能；不应声称这三张页面已经包含 R1 全部前端能力。

## 验收边界

浏览器测试：`python frontend/tests/ui_three_pages.py`，执行实际 Chromium / Vue 的渲染及前端操作，Java API 使用独立 R1 接口契约替身；运行记录与截图见 `docs/testing/evidence/ui-three-pages/`。**本批未证明** npm 依赖安装、Vite 正式构建、Spring Boot + MySQL 集成、真实大模型与 Qdrant；必须在用户本地进一步运行。
