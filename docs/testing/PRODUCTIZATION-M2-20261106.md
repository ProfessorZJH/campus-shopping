# M2：商品、门店、结算、履约与售后（2026-11-06）

## 结论与范围

本报告记录产品化规划 M2（任务 3.1～3.10）在当前工作树的实现和验证。工作树为 `G:/develop/campus-shopping-worktrees/productization-m1`，分支 `codex/productization-m2`，基于 M1 提交 `fb00263`。代码已提交 `5c1579a`，已推送 `codex/productization-m2` 并创建 PR #57（以 `codex/productization-m1` 为基线，待 M1 PR #56 合并后 retarget 到 `main`）；未合并。

本阶段修改了消费者商品/店铺/购物车/订单页面、商户门店设置和售后审核、平台争议处理，以及对应的 Java API/Case/领域/持久化；新增三份迁移（门店公开资料、订单自提地点快照、履约与售后事件）。未修改支付、库存、退款金额规则或权限模型；未调用真实外部 AI/模型；未操作既有业务库。

## 3.1 商品价格筛选

- 公开 `/products` 与 `/products/page` 增加 `minPriceCent`/`maxPriceCent`（整数分，闭区间），在 SQL 的 LIMIT/OFFSET 前与搜索、分类、商户、排序一起过滤；COUNT 使用相同条件。仅当前 `ACTIVE` SKU 命中价格区间时返回商品。
- 非整数查询参数返回统一信封的 `0002`；负数或下限大于上限由领域服务拒绝。前端以元输入、最多两位小数，校验失败保留输入且不发请求；卡片在有筛选时展示命中区间的最低有效 SKU 价格，清除/重置覆盖关键词、分类、商户、排序和价格。
- 新增 `ui_price_filter.py` 7 项 Chromium 契约检查；MySQL 集成新增跨页价格过滤、多规格命中、停用 SKU 排除和非法区间测试。

## 3.2 商品详情

- 详情继续使用已有多图、描述、SKU 与可售库存；新增下架/不存在/加载失败的区分提示、可重试的错误态、无货/已下架规格标签和图片失败占位。
- 首页、店铺、详情使用同一编码商品 ID；新增 `ui_product_detail.py` 8 项检查，覆盖多图、失败图片、规格状态、加购、三种失败语义及两个入口一致性。

## 3.3 门店公开资料与图片

- `mer_store` 增加 `description`/`business_hours`/`image_url`；营业时段按北京时间（Asia/Shanghai）展示，不自动推断营业中状态。
- 商户设置页可维护介绍、营业时间和门店图片；`POST /merchants/{merchantId}/store/images` 需要 `store.manage`，图片按 `STORE` 用途登记；保存资料时再次核验本商户归属，商品用途或跨商户 URL 返回 `A0006`。旧客户端未提交新字段时保留原值。新增单元测试覆盖无权限在对象写入前拒绝、跨商户引用不落库和旧客户端保留字段；MySQL 集成验证 `PRODUCT` 用途与跨商户 URL 被拒绝、本商户 `STORE` 用途放行。
- 店铺详情页展示介绍/时段/图片，缺失显示“未填写”；停用商户仍由公开详情拒绝。新增 `ui_storefront.py` 4 项检查。

## 3.4 结算确认

- 购物车点击“提交订单”先进入确认层，重新读取购物车和门店资料，展示商户、自提地点、商品、规格、数量、单价、合计与模拟支付说明；不预占库存、不锁价。
- 确认读取失败保留选择并允许重试；价格/库存/失效变化可刷新确认；业务拒绝停留在确认层；提交中禁用按钮；同一内容结果未知重试沿用原幂等键。新增 `ui_checkout_confirmation.py` 4 项检查。

## 3.5 订单自提地点快照

- 新订单在下单事务内从锁定商户行保存 `pickupStoreName`/`pickupLocation`；商户后续改址不改写历史。旧订单字段为空，页面显示“历史自提地点未记录”，当前门店信息另行标注为参考。
- 新增 `ui_order_snapshot.py` 2 项检查；MySQL 集成覆盖快照写入和改址后历史不变。

## 3.6 履约事件

- 新增只追加的 `trd_order_event`（含 AUTO_INCREMENT 序列、订单/售后归属、业务去重键）。订单创建、付款、备货、备货完成、核销、取消和过期在对应成功事务内写入；`INSERT IGNORE` 保证幂等重放不重复。事件读取按订单和稳定时间/序列排序，随订单详情按原有权限返回。
- MySQL 集成覆盖成功转换、重复付款/备货重放和事件数量，并断言并发付款/取消/退款请求只产生一条对应事件、过期只写一条 `EXPIRED`、失败转换不写成功事件；事务回滚不会留下成功事件由同一事务路径保证。

## 3.7 售后历史

- 售后申请、商户驳回/同意、平台介入、平台裁决和模拟退款完成写入同一事件表；后续决定不覆盖前序记录，未发生阶段不显示。
- 商户审核和平台争议页面复用订单事件读模型；商户通过 `aftersale.read` 授权的售后历史端点读取，不要求更宽的 `order.read`；已处理售后仍可查看只读历程。旧记录无事件时明确“历史记录不完整，仅显示当前状态”。新增 `ui_after_sale_history.py` 6 项检查。

## 3.8 订单详情与时间线

- 消费者订单详情增加订单进度时间线，展示真实事件类型、时间和原因；退款处理中暂停自提凭证并提示；未采用二维码，继续展示服务端签发的文本凭证、有效期和重签说明，不向第三方服务发送凭证。

## 3.9 三端售后详情

- 消费者订单时间线、商户售后审核和平台争议处理共享同一订单事件读模型；按角色显示必要原因，未扩大权限、退款资格或真实资金语义。

## 3.10 最终检查

| 检查 | 结果 |
|---|---|
| `npm run format:check --prefix frontend` | PASS，`All matched files use Prettier code style!` |
| `npm run typecheck --prefix frontend` | PASS |
| `python scripts/build-ui-bundle.py` / `--check` | PASS，`UI source/artifacts verified` |
| `python scripts/generate-api-contract.py`、`verify-api-contract.py`、`verify-api-schemas.py` | PASS（97 routes / 75 schema checks） |
| `python scripts/schema_contract.py --check` | PASS（40 tables / 12 mappers） |
| Java 单元测试（无 MySQL） | PASS；CI 真实 MySQL/Redis 运行 374 tests / 0 failures / 0 skipped |
| `python frontend/tests/ui_price_filter.py` | PASSED 7 |
| `python frontend/tests/ui_product_detail.py` | PASSED 8 |
| `python frontend/tests/ui_storefront.py` | PASSED 4 |
| `python frontend/tests/ui_checkout_confirmation.py` | PASSED 4 |
| `python frontend/tests/ui_order_snapshot.py` | PASSED 2 |
| `python frontend/tests/ui_after_sale_history.py` | PASSED 6 |
| `python frontend/tests/ui_refund_recovery.py` / `ui_status_panel.py` / `ui_three_pages.py` / `ui_fix_regression.py` | PASSED 5 / 5 / 23 / 11 |
| `python frontend/tests/ui_global_sort.py` / `contract_ui.py` | PASSED 4 / 20 |
| `python frontend/tests/ui_copy_polish.py` / `ui_product_images.py` | PASSED 4 / 24 |
| `python frontend/tests/live_m2_fulfillment.py`（隔离真实 Spring/MySQL，无 API 替身） | PASS，5 checks；浏览→确认下单→模拟付款→备货→核销（库存 9/0/9）及未提货退款→商户拒绝→平台介入→退款（库存 14/0/14），无未捕获 JS 异常 |
| 隔离 MySQL/Redis/HTTP/Chromium（`verify-mysql-isolated.py --http-smoke`，修复前基线） | **PASS**：Maven BUILD SUCCESS，372 tests / 0 failures / 0 skipped；真实 HTTP 282 项、Redis 双实例 9 项、`live_ui` 21 项、M2 履约 5 项；证据 `docs/testing/evidence/productization-m2/isolated.json` |
| GitHub Actions Maven / MySQL / FastAPI / Browser E2E（`4cc58d4`） | **PASS**：374 tests / 0 failures / 0 skipped；真实 `live_m2_fulfillment.py` 5 项通过，含新增售后授权与多轮介入测试 |

结论：M2 任务 3.1～3.10 的本地实现与隔离真实后端验收完成。`live_m2_fulfillment.py` 使用真实 Spring/MySQL、真实浏览器会话和真实 HTTP，不拦截或替换 API；库存断言为核销后 9/0/9、退款后 14/0/14。该结果不包含真实支付、生产部署或远端 CI。

隔离运行使用两个独立的本机测试 Redis（随机命名空间），未执行 `FLUSHDB/FLUSHALL`。Windows 本机没有 `redis-server` 可执行文件，`RedisServerFaultIsolationTest` 通过新增的 `scripts/redis-test-server.py` 以一次性 Docker 容器启动子进程；测试结束发送 `SHUTDOWN`，不连接既有 Redis。

## 明确未验证 / 未完成

- 隔离真实后端完整链路（3.10）已通过；证据见 `docs/testing/evidence/productization-m2/isolated.json` 与 `frontend-live-m2/results.json`。
- 真实支付、已提货退货、部分退款、多门店、优惠券、完整盘点与财务对账不在本阶段范围。
- 真实外部 AI/模型、生产部署、真实域名 HTTPS、性能与多实例未验证。
- 二维码未采用；凭证仍为文本 + 有效期 + 重签，未向第三方发送。
- 提交：`5c1579a`；已推送 `codex/productization-m2` 并创建 PR #57（基于 M1 PR #56）；合并：未执行。
