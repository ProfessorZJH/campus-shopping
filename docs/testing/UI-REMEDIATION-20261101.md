# 前端业务正确性与请求生命周期整改

日期：2026-11-01。基线：`origin/main` 的 `3882ac675a8a72ffce4a324de127413dc24a47b6`；工作分支：`codex/frontend-remediation`。

## 目标、范围与不变量

落实用户提供的三批整改方案，保留 Vue 3、现有 store 和请求作用域。范围为消费者页面、商户后台、平台后台及公共 GET 请求生命周期。

沿用 [R1](../specs/RELEASE-01.md)、[RBAC 规格](../specs/SDD-RBAC-05.md)和[行为契约](../api/behavior-v1.1.md)。本次修复客户端展示与加载行为，不新增权限、API、数据迁移或领域规则。Java/MySQL 继续实时复验经营资格、SKU、价格、库存和交易；写请求保留 CSRF、幂等键及服务端结果校验，不增加超时自动重写。

验收标准：资料成功保存后不回退；SKU、数量和库存一致；平台危险操作可取消且不写入；失败角色修改不残留错误选择；页面有明确加载负责人，筛选重置页码只发一次列表 GET；卸载清理搜索定时器并取消页面 GET；权限恢复期间不显示错误拒绝；刷新和错误期间不能提交旧数据。

## 实现

- 门店资料使用 PUT 返回的 `MerchantResponseDTO` 同步商户列表、workspace 及表单，不再执行通用操作后的列表刷新。
- 首页使用公共 `priceSku()` 展示最低有效规格及“起”价，弹窗默认选择有库存的 ACTIVE SKU；切换规格数量归 1，加购同时检查状态、整数数量、上限及库存。
- 平台停用商户必须填写 1~500 字原因，并确认商户名称；恢复商户、强制下架商品也明确确认目标。加载、错误、提交期间禁用写操作；写请求返回后检查页面作用域。
- 成员角色控件要求 Owner，选择时立即恢复服务端角色，成功后通过已有刷新呈现结果，失败保留原值。
- 根组件恢复身份和后台上下文后挂载页面；恢复期间导航共用同一个身份请求。公共商品由 Home 加载，商户商品由 Merchant 加载；后台订单、库存等页面不再附带加载商品。切换商户依赖页面重建加载，不再由 Shell 额外发起商品请求。
- Merchant、MerchantOps、Platform 用单一筛选/分页调度入口，立即使旧结果失效；商品搜索离页清理定时器。页面 GET 接入已有 AbortSignal，保留身份、路由、商户和版本保护。
- 知识库统一控制页码重置与文档加载，避免显式加载和页码 watcher 重复请求；文档 GET 在替换与卸载时取消。
- GET 默认 15 秒超时，覆盖响应体读取，区分调用方取消和超时，并清理定时器及监听器；CSRF 获取复用有超时的 GET。业务写请求不增加自动超时或重放。
- Cart 刷新期间锁定结算；Orders 刷新或错误期间锁定支付、取消、自提凭证、退款和申诉操作。Account 按当前页面加载所需数据，Shop 翻页复用商户资料，ProductDetail 优先展示 DTO 商户名称，未知后台地址显示 404。
- 静态副本及交付 bundle 全部由构建脚本生成。

## 实际验证与证据

本轮使用本机 Node 22.16.0、Python 3.11.9 和真实 Chromium，浏览器 API 使用明确的 HTTP 契约替身。请求次数由替身记录，请求竞态由浏览器内可控延迟验证，收集 `pageerror` 并要求无未处理异常。

最终逐项命令、退出码和原始输出见 [results.json](evidence/ui-remediation-20261101/results.json)。测试时源码与 bundle 的 SHA-256 见 [sources.json](evidence/ui-remediation-20261101/sources.json)。

| 检查 | 结果 |
|---|---|
| `python frontend/tests/ui_remediation.py` | 12 项 Chromium 整改检查通过 |
| `python frontend/tests/ui_fix_regression.py` | 11 项身份及乱序响应回归通过 |
| `python frontend/tests/ui_rbac_regression.py` | 14 项权限回归通过 |
| `python frontend/tests/ui_permission_correctness.py` | 10 项业务状态和输入契约回归通过 |
| `python frontend/tests/ui_global_sort.py` | 4 项全局排序回归通过 |
| `python frontend/tests/ui_sdd_integration.py` | 15 项浏览器契约检查通过 |
| `python frontend/tests/ui_list_pagination.py` | 3 项分页检查通过 |
| `node --test frontend/tests/*.test.mjs`（证据中逐个列出三个文件） | 8 个 Node 测试通过，含 GET 响应体超时和身份竞态 |
| `npm run format:check --prefix frontend` | 通过 |
| `python scripts/build-ui-bundle.py --check` | 源码与生成产物一致 |
| `python scripts/verify-release.py` | 静态源码、契约及领域边界检查通过 |
| `git diff --check` | 通过 |

## 验证边界与交付状态

上述初轮完成时，代码已在工作区实现，浏览器替身与静态验证通过，尚未执行真实后端联调。用户后续授权的真实 Java/MySQL/Redis、HTTP 与浏览器验收单独记录在[真实后端联调报告](UI-REMEDIATION-LIVE-20261101.md)，以该报告列明的环境和结果为准。本报告替身结果不表示 Maven 全量、生产或性能验收通过。
