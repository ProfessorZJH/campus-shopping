# PR #48 登录入口与加载边界审查修复

基线：`aa6c57f53c8da981dc01430c193dedf348f046f8`。本次核对用户审查提出的四条触发路径，并在同一功能分支修复，不合并或部署。

## 目标、范围及不变量

匿名用户直达平台后台必须具有登录入口，成功后留在原路由；首页搜索不得取消分类/商户初始化；身份变化只由 Home 发起一次公共加载；会话服务暂不可用不得阻断公开商品浏览。后台仍须完成身份和 workspace 权限核验，Java 继续最终校验权限、CSRF 和交易，不调整 API、数据库或生产配置。

## 修复及回归

- 根组件区分“需要登录”和可重试的服务故障，复用 `AuthDialog` 提供后台登录入口。匿名不请求 workspace、不挂载后台内容；登录身份变化后恢复当前目标路由。
- 初始加载和搜索分别使用 `requestScope`，离页仍分别取消；原有公共查询版本保护继续防止初始商品响应覆盖新搜索。
- ConsumerShell 移除登录成功及退出时的 `loadPublic()` 调用，统一依赖身份变化后的 Home 重建加载。
- `/auth/me` 的超时或 5xx 在公开页面降级为继续浏览，后台仍显示重试且不加载私有内容；不把服务故障误认为权限已恢复。

新增 `frontend/tests/ui_review_regression.py`，已加入现有 Current browser contracts CI 门禁，覆盖：

1. 匿名直达 `/admin`、`/admin/products`、`/admin/knowledge`、`/merchant/settings`，可登录且保留路由，登录后只恢复一次 workspace。
2. 挂起分类、公开商户和初始商品 GET，立即搜索，证明基础请求未被取消，延迟初始商品不覆盖搜索结果。
3. 首页首次加载、登录、退出后，商品/分类/商户 GET 计数依次严格为 1/2/3。
4. 会话 503 及实际 AbortSignal 超时分别作用于公开首页和后台：公开首页可浏览且可登录，后台无私有 GET 并提供重试。测试仅将会话超时计时缩短，不模拟成功响应。

四组回归在旧 bundle 上全部失败，见 [原始复现](evidence/pr48-review-20261101/before.txt)；修复后全部通过，浏览器未捕获异常为 0。这里的浏览器使用明确 HTTP 替身，不能作为真实后端通过的证明。

另在 `live_ui.py` 新增两个无 API 替身的真实用例：匿名直接进入 `/admin` 和 `/admin/products`，通过根组件登录后看到原后台标题并保留 URL。这些用例由最新提交的完整 CI 执行，结果以 PR 的最新 HEAD/Actions 为准。

## 已执行检查与证据

[命令、日志及退出码](evidence/pr48-review-20261101/results.json)均为 PASS：新增审查回归、原整改回归、身份/乱序响应、RBAC、全局排序、分页，以及 8 个 Node 测试、格式检查、UI 构建一致性。测试时源码摘要见 [sources.json](evidence/pr48-review-20261101/sources.json)。静态副本和 bundle 均由构建脚本生成。

另已通过 `verify-release.py` 静态门禁。会话故障用例补充了实际登录：首次扩展断言的 5 秒等待短于第二次 `/auth/me` 的默认 15 秒超时，导致断言失败，摘要见 `login-assertion-before.txt`；仅将该断言等待改为 20 秒，保留真实请求超时后重跑全部四组通过，见 `10.txt`。控制台日志仅规范化行末空白。

本次未在本机重跑真实后端和全量 JUnit，先前真实后端报告只代表其记录的版本。本次真实浏览器、全量 MySQL/Redis/Java、镜像及其余 CI 结果将核对最新 PR HEAD，不能沿用 `aa6c57f` 的绿色状态。
