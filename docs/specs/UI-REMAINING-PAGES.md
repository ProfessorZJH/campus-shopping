# 前端扩展规格 · UI 全页面批次（2026-10-28）

状态：本批 **已落盘前端代码**；后端接口和 DTO 已对齐，未通过真实 Spring/MySQL 端到端验收。

## 目标与原则

- 延续 `UI-THREE-PAGES.md` 的青柠校园配色、图标、圆角及组件体系，不另起设计系统。
- 消费端是 H5 购物体验；商户和平台端以实际处理列表、详情、表单为主，仅各保留一个概览页。
- 页面保持简短中文信息，不增加说明条、大段教程、虚构营销指标。
- 商户跨域权限和账号身份均由 Java 校验；前端只是减少误操作，不自行授予角色。
- 设计预览必须显式带 `?demo=1`；所有写操作禁用，演示内容不写数据库。
- 单商户结算，不提供真实微信支付、优惠券、配送、已提货退款、AI SSE 流式等超出当前后端的能力。

## 路由与 API 映射

| 界面 | 路由 | 读取接口 | 写操作接口 |
|---|---|---|---|
| 首页 / 搜索 / 筛选 | `#/` | `GET /products`、`/categories`、`/merchants/public` | 选择规格后 `PUT /cart` |
| AI 导购 / 历史会话 | `#/ai` | `GET /ai/conversations`、`/ai/conversations/{id}/messages`、`/proposals` | `POST /ai/chat`、`/ai/proposals/{id}/confirm|reject` |
| 商品详情 | `#/product/{id}` | `GET /products/{id}` | `PUT /cart` |
| 购物车 / 单商户结算 | `#/cart` | `GET /cart` | `PUT /cart`、`DELETE /cart/{skuId}`、`POST /orders` |
| 我的订单 / 自提 / 退款 | `#/orders`、`#/orders/{id}` | `GET /orders`、`/orders/{id}` | `POST /orders/{id}/pay|cancel|pickup-token|refunds|appeal` |
| 个人中心 / 入驻 / 邀请 | `#/account`、`#/apply`、`#/invitations` | `/auth/me`、`/merchant-applications/mine`、`/invitations` | `POST /merchant-applications`、`/invitations/{id}/accept` |
| 商户经营概览 | `#/merchant` | `GET /merchants/{id}/statistics|orders` | 无 |
| 商品与多规格管理 | `#/merchant/products` | `GET /merchants/{id}/products|stocks` | 商品新增、编辑、上架、售价、补货（沿用前三页） |
| 商户库存 / 流水 | `#/merchant/inventory` | `GET /merchants/{id}/stocks|stock-movements` | `POST /merchants/{id}/stocks/{sku}/replenish` |
| 商户订单 / 自提核销 | `#/merchant/orders`、`#/merchant/pickup` | `GET /merchants/{id}/orders` | `POST /merchants/{id}/orders/{orderId}/prepare|ready|verify` |
| 商户售后 | `#/merchant/aftersales` | `GET /merchants/{id}/aftersales` | `POST /merchants/{id}/orders/{orderId}/refund-decision` |
| 商户店员 / 门店 | `#/merchant/team`、`#/merchant/settings` | `GET /merchants/{id}/members`、`/workspace` | `POST /merchants/{id}/invitations`、`DELETE /members/{userId}`、`PUT /profile` |
| 商户知识库 | `#/merchant/knowledge` | `GET /knowledge/bases`、文档列表/正文 | `POST /knowledge/bases`、文档上传/索引/发布/撤回 |
| 平台概览 | `#/admin` | `GET /admin/statistics|orders|merchants` | 无 |
| 入驻审核 | `#/admin/applications` | `GET /admin/merchant-applications` | `POST /admin/merchant-applications/{id}/review` |
| 商户监管 | `#/admin/merchants` | `GET /admin/merchants` | `POST /admin/merchants/{id}/state` |
| 商品 / 订单监管 | `#/admin/products`、`#/admin/orders` | `GET /admin/products|orders` | `POST /admin/products/{id}/unpublish` |
| 平台争议裁决 | `#/admin/disputes` | `GET /admin/aftersales` | `POST /admin/orders/{id}/refund-decision` |
| 平台知识库 / 类目 | `#/admin/knowledge`、`#/admin/categories` | `GET /knowledge/bases`、`/categories` | 文档操作、`POST /admin/categories` |

> 所有接口路径上表省略统一前缀 `/api/v1`。具体 DTO 取自当前 Java 源码。平台端不会自行渲染未定义的 AI 绩效指标。

## 关键交互规则

1. 购物车可显示多商户，但**一次提交仅选择一个商户**；请求包含商品 SKU、数量、服务端报价和版本。提交订单复用幂等键直到成功或请求内容变化。
2. 订单由 Java 后端完成核价、预占；模拟支付和取消分别调用真实业务接口。支付成功、备货完成后才能签发自提令牌。
3. 自提令牌由 Java 生成，前端不自己编造 QR 或令牌；再次签发会令旧令牌失效。商户核销输入买家展示的真实令牌。
4. 退款受订单及售后状态约束，界面不提供已提货退货功能。
5. 商户 Owner 可以修改店铺资料、管理店员；普通成员按后端实际权限复验。平台身份从 `/workspace` 获取，不从客户端写入。
6. 管理端审核状态严格使用后端 `SUBMITTED / APPROVED / REJECTED`；自提使用 `WAIT_PREP / PREPARING / READY / COMPLETED`。
7. 知识管理仅支持 2MB 内 TXT、Markdown、可提取文本 PDF；上传和发布是不同动作。没有 LLM 实时质量统计接口，不渲染伪造监管图表。
8. 所有写入操作在预览模式禁用；正式模式使用 Cookie Session、CSRF 与业务码 `0000`。

## 交付代码

- `frontend/src/pages/`：新增 `ProductDetail.js`、`Cart.js`、`Orders.js`、`Account.js`、`MerchantOps.js`、`Knowledge.js`、`Platform.js`。
- `frontend/src/components/BackofficeShell.js`：商户/平台共享导航与页框架。
- `frontend/src/services/pages-demo.js`：隔离的设计预览素材数据；`page-utils.js`：状态和日期展示。
- `frontend/src/main.js`、`frontend/src/components/ConsumerShell.js`、`frontend/src/pages/Merchant.js`：补齐入口导航，保留前三页代码。
- `frontend/src/styles/app.css`：新增页面样式和小屏适配。
- `scripts/build-ui-bundle.py`、`scripts/install-frontend-ui.py`：预编译并同步所有新页面到 Spring static，不改变后端接口。

## 当前限制

浏览器测试覆盖 26 个 URL 和核心交互；使用明确的演示数据或后端 API 契约替身。**未验证完整 Spring/MySQL、真实 Session Cookie、真实 AI 服务、多人权限隔离、多实例部署。** Vite CLI 构建需要本地 `npm install`，本环境未安装 Vite；离线 Vue 预编译已完成。
