# SDD-12 本机升级与真实业务验收 · 2026-10-31

用户授权使用已经运行的本机 MySQL、Redis 完成升级和业务联调，并明确要求直接本地运行。此次结果为 **PASS**，应用保留运行于 <http://127.0.0.1:8091>，Python AI 服务绑定 `127.0.0.1:8100`。用于跨实例检查的 `8092` 已停止。没有启动 Redis 容器，没有清空或重配用户 Redis。

本报告是[隔离验收](SDD-REDIS-12-VERIFICATION.md)之后的独立阶段，不能把两次执行的通过数相加或混写为同一次 Maven 验收。[机器汇总](evidence/redis-12-local/summary.json)记录实际范围。

## 升级和运行版本

运行 `var/redis-sdd/verified-build/campus-shopping-app.jar`，SHA256 为 `14c2749a6cbe8880c43295ab4460c6b05fc729831618d982200a63c81332c44c`。启动前与结束时核对上一轮的 435 个源文件摘要，均与已验证构建一致。本次没有修改生产 Java/Python/前端代码，也没有重新执行 Maven；上一轮 121 项 Maven 和 44 项 Python 结果仍仅归属隔离验收。[构建身份](evidence/redis-12-local/build-identity.json)。

现有 `campus_shopping` 先执行完整逻辑备份，并在随机新建的临时库恢复。恢复后的 33 张原有表逐表核对列名、行数和完整行摘要，全部一致；随后先在恢复库演练迁移，再通过 `scripts/migrate-database.py` 升级业务库。原库缺少新版迁移历史，因此显式登记并核对全部 4 份迁移，已有字段和表由幂等 SQL 保留。迁移后逐行检查所有原有列，数据保持一致；新增对话租约字段、知识库配额及迁移历史通过验证。临时恢复库已清理，没有重建或清表。[升级证据](evidence/redis-12-local/upgrade.json)。

私有备份、`.env` 原件和 AI SQLite 备份保存在忽略目录 `var/redis-sdd/local-upgrade/20261031-100153/`；SQL 备份 97,939 字节，摘要见升级证据。不将数据库备份、账号密码或 Cookie 放入公开报告。

本地私有 `.env` 已合并 Redis 配置：启用 Redis，安全和展示缓存均连接现有 `127.0.0.1:6379`，命名空间 `cs:local:r12`。单 Redis 仅适用于此次本地运行，没有独立内存与淘汰策略隔离。未执行 `FLUSHDB/FLUSHALL`，未改变持久化、绑定地址或淘汰策略。首次切换会话存储后需重新登录。

## 实际结果

| 范围 | 结果 | 证据 |
|---|---|---|
| 真实 Spring/MySQL/Redis/Python HTTP | 173 项通过，117 份响应严格契约通过 | [HTTP](evidence/redis-12-local/http-round-1.json) |
| 两个真实 Java 实例，共享实际业务 MySQL/Redis | 8 项通过：会话、退出、stock.read、撤权、改价、补货、下架、撤销成员 | [跨实例](evidence/redis-12-local/cross-instance.json) |
| 共享账号登录限额 | 交替访问两个实例并变换账号大小写，前 30 次进入凭据校验，第 31 次 HTTP429/A0007/Retry-After | [31 次请求](evidence/redis-12-local/shared-quota.json) |
| 真实 Chromium 基础页面 | 8 项通过 | [基础浏览器](evidence/redis-12-local/browser-basic/results.json) |
| 商户上传商品、双 SKU 补货和上架 | 5 项通过 | [商品](evidence/redis-12-local/browser/product.json) |
| 真实导购到交易闭环 | 12 项通过 | [交易](evidence/redis-12-local/browser/flow.json) |
| 页面、角色权限和移动端 | 40 项通过，包含 28 条路由 | [页面](evidence/redis-12-local/browser/pages.json) |
| 只读 MySQL 核对 | 8 项通过：订单、支付、退款、快照、两规格库存、核销、提案及购物车 | [数据库](evidence/redis-12-local/database-readback.json) |

浏览器合计 65 项，未拦截或替换 API。交易覆盖真实模型回答、公开知识引用与内部资料隔离、确认加购、模拟支付、商户备货、自提核销及未提货退款。本次回答实际为 `LLM`，知识检索为 `REMOTE_EMBEDDING`，没有用本地演示回答冒充远程模型。

浏览器新商品的 500ml 规格初始库存 50，完成两瓶交易后为 48；600ml 规格单价 400 分，页面默认选择该规格创建退款订单，退款 400 分后库存仍为 1。两规格预留库存均为 0。订单价格与图片快照、整单退款一次性、只有已完成订单产生核销记录均已核对。

## 数据变化和失败记录

业务验收通过 Java API 新增合成数据，保留在本地库供复核：18 个账号、5 个商户、4 件商品、6 个订单、4 条模拟支付、2 条退款及 4 个知识库。包含中途脚本失败已创建的数据，没有删除已有数据来隐藏失败。迁移前原始数据保持一致的结论仅针对迁移阶段；后续业务验收自然产生真实持久化变化。[增量行数](evidence/redis-12-local/summary.json)。

三次验收脚本问题均保留原始记录：[失败说明](evidence/redis-12-local/failed-rounds.json)。CookieJar 无法整体深拷贝，修正为逐 Cookie 复制；空权限自定义角色被 API 正确拒绝，改为合法权限替换来检查撤权；历史数据库核对脚本固定假设退款规格为 600 分，但本次默认选中 400 分规格，按交易前夹具中的 SKU、价格、数量及初始库存分别核对后通过。没有为使测试通过而修改数据库或业务实现。

## 复现、停止与回退

本次操作辅助脚本和私有状态位于忽略目录 `var/redis-sdd/`。`start-local.py --secondary` 启动验收双实例；`accept-local-cross-instance.py` 和 `accept-local-quota.py` 执行跨实例与限额检查。`run-local-browser.py` 调用现有浏览器和数据库脚本，仅重定向本轮证据、账号夹具与测试商品标题；数据库核对针对交易前夹具适配多规格。原始仓库验收脚本和历史证据均保留。

当前进程标识和日志位于 `var/redis-sdd/local-runtime/`。停止时只操作该运行记录中仍属于本次 JAR/Python 的进程，保留用户 MySQL/Redis。端口释放后可用 `python var/redis-sdd/start-local.py` 启动单 Java/单 Python 本地服务。此辅助脚本使用已验证 JAR；`campus-shopping-app/target` 下的其他 JAR 没有作为本轮启动依据。

如需回退，先停止本次服务，备份升级后数据，再在独立库恢复升级前备份并核对后切换连接及对应旧版本；升级前备份不含本次新增交易，不能直接覆盖当前库。恢复旧 `.env` 会改变会话存储和本地配置，应与应用版本一起核对。回退未实际执行。

## 范围边界

按用户本地运行要求，Docker/Compose 运行和远程 GitHub CI 不属于本次完成范围。此前尝试启动 Docker Desktop 没有获得可用 Engine；后续没有继续使用容器。本地验收结束时源码尚未发布到远程，旧提交的 CI 不能验证当前工作区；后续发布说明另见[推送记录](SDD-REDIS-12-PUBLISH.md)。

本次沿用之前仅供回环绑定验收的既有 HTTP Milvus 例外；正常应用的公网 HTTP 拒绝策略不变。Java 商品向量同步保持关闭，本次未重新验收商品索引同步或语义召回质量；真实模型和知识嵌入成功不能替代该证据。Redis 物理断网、重启恢复、主从切换、性能容量、生产部署、多 Python 副本和跨主机上传存储均未在此次本地业务联调中验收。
