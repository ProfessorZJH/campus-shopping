# M4/M5 真实隔离整合验收

日期：2026-11-07。对应 OpenSpec 5.8、6.4；使用全新临时 MySQL、两个本机 Docker Redis 实例、真实 Spring/FastAPI HTTP 和真实 Chromium。测试数据为本轮随机合成数据，未连接既有业务库，也未使用真实凭据。

## 结果

| 范围 | 结果 |
|---|---:|
| Java/Maven | 393 tests，0 failures，0 errors，0 skipped |
| Python 流式/容量/服务定向 | 58 passed |
| 真实 HTTP + OpenAPI 响应校验 | 291 checks，213 responses |
| 双 Redis 跨实例 | 9 checks，31 次共享限额请求 |
| 真实 Chromium 后台/消费者 | 22 checks |
| 真实 Chromium 履约/售后 | 5 checks |

完整汇总证据：

- `evidence/productization-final-20261107/productization-final-isolated.json`
- `evidence/productization-final-20261107/full-http.json`
- `evidence/productization-final-20261107/redis-shared-http.json`
- `evidence/productization-final-20261107/frontend-live.json`
- `evidence/productization-final-20261107/frontend-live-m2.json`
- `evidence/productization-final-20261107/ai-load-recovery.json`（80 次本地隔离请求、重启后检索恢复；不代表生产容量）

## M4 事实

- 商户、店员和平台账号在同一隔离库完成入驻、邀请、角色变更、订单筛选、备货/核销、退款/介入和历史读取。
- 运营统计通过真实订单数据核对商户和平台范围、Asia/Shanghai 时区、期间字段、状态分布、商品表现和退款率；非法期间被拒绝。
- 跨实例会话、权限撤回、跨商户访问和展示缓存失效均通过双 Redis HTTP 检查。

## M5 事实

- 文档通过真实 Java/Python 接口建立索引、发布和撤回；已有 Java MySQL 测试覆盖索引过期、失败重试和配额边界。
- 商户真实 HTTP 调用 RAG 调试接口，响应包含授权命中、版本、片段、排名、分数类型、检索模式和回答模式；另一商户的调试请求不能看到内部文档。
- 真实 Chromium 打开平台 RAG 调试页并完成一次检索请求；Java/Python 流式、容量和服务定向测试覆盖慢调用、取消和执行许可边界；本地隔离 AI 负载还完成 80 次请求、12 并发客户端和重启恢复检查。
- 断言和报告不保存知识正文、提示词、下游异常正文或凭据；导购结果明确为 `LOCAL_RETRIEVAL_DEMO`，未宣称真实模型效果。

## 未覆盖范围

- 当前提交没有可读取的 GitHub check run；CI 仍待 PR/工作流实际运行。
- 未连接真实外部模型、向量服务、生产域名或生产数据，因此不代表真实供应商语义效果、性能或生产部署结果。
- M6 的完整桌面/手机、多角色异常矩阵及最终交付收尾仍保留在 7.2–7.4。
