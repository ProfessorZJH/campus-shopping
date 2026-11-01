# 前端整改真实后端联调 · 2026-11-01

## 范围与环境

延续[前端三批整改](UI-REMEDIATION-20261101.md)，验证当前 `codex/frontend-remediation` 工作区代码。用户明确指定使用已启动、无密码的本机 Redis；本轮实际连接 `127.0.0.1:6379`，不新建 Redis 实例、不清空或停止该服务。

使用全新临时 MySQL 8.0.31 数据目录、随机端口和合成业务数据，在临时源码副本执行 `mvnw.cmd -B -ntp clean package -DskipTests`，启动两个临时 Java 17 / Spring Boot 实例及一个 FastAPI 服务，再运行真实 HTTP 与 Chromium。未读取仓库 `.env`，没有替换原有应用或访问原有业务 MySQL。

本轮按开发配置将安全状态和展示缓存接入同一个 Redis，使用随机 `cs:test:http:<随机值>` 命名空间。此拓扑用于本次业务联调，不代表生产要求的双 Redis 故障隔离通过。Maven 仅编译打包，JUnit 全量及需要双 Redis/停机操作的故障测试均为 **NOT_RUN**；没有放宽现有全量验收脚本的门禁。

本机执行入口：`python -X utf8 var/run-ui-remediation-live.py`。该临时包装脚本复用 `scripts/verify-mysql-isolated.py` 的新库迁移检查和 `http_smoke()`，已有全量验收入口保持原有要求。服务生成的随机凭据只在子进程环境中传递，不写入报告。

## 真实业务验收

最终结果见 [live.json](evidence/ui-remediation-live-20261101/live.json)，详细链路见 [HTTP 结果](evidence/ui-remediation-live-20261101/full-http.json)、[双 Java 实例结果](evidence/ui-remediation-live-20261101/redis-shared-http.json)、[浏览器结果](evidence/ui-remediation-live-20261101/frontend-live/results.json)。`apiMockUsed=false`，没有拦截、替换 API 响应或伪造交易结果。

最终 **PASS**：262 项真实 HTTP 检查，其中 195 份响应通过 OpenAPI 校验；9 项双 Java 实例共享 Redis 检查；19 项真实浏览器检查，未捕获 JS 异常为 0。新库迁移、重放、历史数据保留及校验和拒绝等 8 组 MySQL 检查通过。编译打包、格式、UI 生成一致性和 `git diff --check` 通过。

在既有真实浏览器回归之外新增六组检查：

1. 门店资料通过页面 PUT 保存，表单立即保持新值，真实 workspace 查询返回同一持久化结果；浏览器没有额外商户 GET。
2. 创建价格 15/8 元、库存 5/2 的真实多规格商品。卡片展示最低价和对应规格；选择数量 5 后切换低库存规格归 1，实际购物车记录的 SKU 与数量正确。
3. 真实注册店员、邀请并接受加入，创建自定义角色。页面加载选项后通过 API 删除该角色，再从页面选择旧选项，服务端拒绝，控件和持久化成员角色均保留 `CLERK`。
4. 商品搜索输入后在防抖计时器前离开，真实 Network 没有残留商品列表请求，进入购物车也不附带公共商品 GET。
5. 平台强制下架确认包含商品名称；取消时商品仍上架，确认后列表显示已下架、操作按钮禁用，真实管理查询也返回 `UNPUBLISHED`。
6. 平台停用先填写原因，再确认商户名称；取消不改变经营状态，确认后列表显示暂停状态及恢复入口。

保留匿名、管理员、普通用户、移动端、自提及 SKU 管理、累计库存拒绝加购、同会话双标签页增量加购、失效购物车移除和浏览器未捕获异常检查。

## 首轮失败与修正

首轮构建、262 项 HTTP 和 9 项双 Java 检查通过，浏览器完成 16 项后停在新测试错误断言：测试要求下架按钮消失，实际设计为下架后保持按钮并禁用。现有前端已按 `p.status !== 'PUBLISHED'` 禁用，没有修改业务代码。

修正为同时验证按钮禁用、列表状态“已下架”及真实后端状态 `UNPUBLISHED`，保留取消操作不改变状态的断言。另将新夹具按 `specKey` 分配库存，避免依赖 SKU 返回顺序。原始记录完整保留在 [首轮结果](evidence/ui-remediation-live-20261101/initial-browser-assertion/live.json)和[浏览器失败原因](evidence/ui-remediation-live-20261101/initial-browser-assertion/frontend-live/results.json)。

## 交付与边界

本轮联调覆盖真实 Java/MySQL、现有单 Redis、两个 Java 实例共享状态、FastAPI 本地检索和真实浏览器；不扩展为全量 JUnit、双 Redis 故障隔离、生产、性能、多 Python 或真实外部模型验收。

所有测试记录位于本报告证据目录。源码摘要见 [tested-sources.json](evidence/ui-remediation-live-20261101/tested-sources.json)，构建输出见 [package.txt](evidence/ui-remediation-live-20261101/package.txt)。文本日志仅规范化换行和行末空白，保留输出内容及原始失败。临时服务及新建 MySQL 目录清理结果、仅本轮 Redis 命名空间键的定向清理数量和既有 Redis 仍可用的检查均记录在 `live.json`。

[源码与交付物核对](evidence/ui-remediation-live-20261101/source-match.json)确认 505 份已测文件与当前工作区一致，JAR 内 UI bundle 与当前前端产物逐字节一致。最终运行仅定向删除本轮命名空间下 71 个 Redis 键，没有全库清理；用户 Redis 结束后仍正常响应 PING。首轮也完成临时资源清理，其独立随机命名空间清理 70 个键，记录保留在首轮报告中。

本报告记录本地验收结果；后续提交、推送及 PR 状态以 Git/GitHub 记录为准。合并与部署不在本轮授权范围。
