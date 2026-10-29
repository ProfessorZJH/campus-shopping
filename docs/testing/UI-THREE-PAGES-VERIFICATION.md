# 前三页 UI 验证记录

- **日期：**2026-10-28
- **范围：**首页、AI 导购、商户商品管理
- **工具：**系统 Chromium、真实 Vue 3 浏览器渲染、Playwright，Spring API 契约替身（不是 Spring 容器）
- **结果：**23 项浏览器检查通过；详情参见 `evidence/ui-three-pages/results.json`。

覆盖：消费者首页布局无横向溢出、商品搜索与类别筛选、SKU 选择/演示禁写；AI 快捷提问、商品推荐选择/价格联动、真实接口模拟 chat → proposal → confirm；商户列表筛选、SKU 详情、库存补货（含 CSRF/幂等键）、新增商品；消费者登录弹层和商户缺登录进入认证；浏览器无未捕获 JS 错误。

截图（均是实浏览器渲染，不是重新生成的平面 UI 图片）：
- `evidence/ui-three-pages/01-home.png`
- `evidence/ui-three-pages/02-guide.png`
- `evidence/ui-three-pages/03-merchant.png`

同目录另包含 `01-home-viewport.png`（430×932）、`02-guide-viewport.png`（430×932）以及 `03-merchant-viewport.png`（1448×1000），用于观察真实首屏。全页截图中的固定导航可能出现在截图中段，这是 Chromium 全页截屏的表现，不代表页面把导航放在中间。

**未通过/未验证的层级：**由于当前环境 npm 官方源 DNS/下载限制，没有执行真实 `npm install && npm run build`；没有 MySQL/Maven/Java Spring 后端启动；没有执行完整网站 HTTP/浏览器的真实联调，没有验证生产部署或真实 AI 模型。屏幕截图通过离线 DOM 加载，本机页面 HTTP/file 导航受环境策略限制。本次仅可视为三页前端初版交付和接口契约检查，而不是全栈已验收。

**设计偏差：**首页移除了设计图中的优惠券促销和销量等未经 PRD/API 支持的演示模块；商户页移除了虚构折线图、营销指标和冗余宣传；保持真实功能优先与简洁文案。

**残留任务：**本地 npm / Vite 运行截图复核；部署后真实会话 Cookie 与静态资源授权核验；商品图片 URL 上传与资源路径验证；与实际 Java/Python 服务执行联调；其他 H5 与后台页面将在后续批次重构。
