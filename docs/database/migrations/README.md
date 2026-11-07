# R1 旧库升级与专项审查迁移

`V20261031_02__knowledge_leases_and_quota.sql` 新增知识索引过期时间、领取版本和商户用量表，按已有文档正文UTF-8字节数初始化用量；不修改文档/发布状态。先停旧实例、等待索引请求结束并备份，再显式迁移；不能混跑无租约条件的旧 claim 实现。用量超限时保留既有数据，后续增长被拒绝。规格见[六批整改增量](../../specs/SDD-R1-REMEDIATION-13.md)。

仅适用于当前 R1 表结构；教学版须先按运行手册升级。新库直接使用最新 `schema.sql`，`CREATE TABLE IF NOT EXISTS` 不会升级已有表。

1. 备份并在副本验证，核对 MySQL 版本至少为 8.0.16（本次实际使用 8.0.31）。
2. 准备有 DDL 权限的升级账号，在当前终端设置 `DB_USERNAME` / `DB_PASSWORD`；凭据不放命令行、不提交 Git。
3. 在目标库执行下面的前置检查，结果必须全为 0；异常记录应由业务负责人核对，不能自动删行或改金额。
4. 在维护窗口运行下方显式迁移命令。CLI 按版本号顺序执行当前 `docs/database/migrations/` 中全部迁移：`V20261028_01`（订单图片）、`V20261028_02`（RBAC）、`V20261029_01`（完整性及索引）、`V20261030_01`（知识索引请求标识与会话租约）、`V20261031_01`（会话租约补充）、`V20261031_02`（知识租约与配额）、`V20261031_03`（AI 同步检查点）、`V20261102_01`（商品图片对象引用及历史主图回填）、`V20261104_01`（图片对象商户归属）、`V20261106_01`（门店公开资料与图片用途）、`V20261106_02`（订单自提地点快照）、`V20261106_03`（履约与售后事件）、`V20261107_01`（会话最近活跃时间、受控摘要与稳定分页索引）、`V20261107_02`（历史消息引用快照）、`V20261107_03`（会话轮次运行状态与取消意图），成功后逐项登记 SHA-256。索引和图片对象表可能消耗额外空间并产生元数据锁等待。
```powershell
python -m pip install --require-hashes -r ai-service/requirements-dev.lock
python scripts/migrate-database.py --host 127.0.0.1 --port 3306 --database campus_shopping
python scripts/migrate-database.py --host 127.0.0.1 --port 3306 --database campus_shopping --check
```

显式指定目标库，脚本不读取 `.env`。以前手工执行过这些幂等 SQL 的库也要运行此入口登记历史。CLI 使用 MySQL 命名锁防止并发升级；已登记脚本的校验和改变或数据库记录了更新版本时直接拒绝。新增迁移后运行 `python scripts/schema_contract.py` 更新构建清单，CI 使用 `--check` 拒绝漂移。

应用默认启用 `SchemaVersionGuard`，在管理员引导前只读核对完整版本和校验和，缺失或不匹配就启动失败，不执行升级 DDL。新空库的 `schema.sql` 会登记完整版本；在已有库重放初始化脚本不会登记缺失的升级。

`V20261030_01` 增加 `ai_document.index_attempt`、`ai_conversation.turn_token/turn_expires_at` 三个可空字段，保留已发布知识、索引状态与会话历史。部署本次代码前必须完成迁移；涉及 AI 并发控制，应在维护窗口停止旧版本请求，再统一启动新版实例，不能混跑仍使用进程锁的旧实例。本次开发验证只升级临时测试库，没有操作已有业务库。

`V20261107_01` 为 `ai_conversation` 增加 `last_active_at` 与受控 `summary`。新消息成功保存时在同一短事务更新二者；摘要只取用户自己的问题文本，旧行的活跃时间从 `ai_message.created_at` 的最大值恢复、无消息时保留创建时间，旧摘要回退为会话标题。列表使用 `(user_id,last_active_at DESC,id ASC)` 索引，读取不逐会话加载消息。

`V20261107_02` 为 `ai_message` 增加 `citation_recorded`，并新增 `ai_message_citation` 保存文档根/版本、证据定位和允许公开的片段。旧消息默认没有引用记录；新助手消息在消息完成事务中批量写入快照，读取时按当前授权和文档版本复验。

`V20261107_03` 为 `ai_conversation` 增加 `turn_status` 与 `turn_cancel_requested_at`。当前轮次跨实例共享 `RUNNING` / `CANCEL_REQUESTED` 状态；取消请求不提前清理租约，`finishTurn` 只接受仍为 `RUNNING` 且未过期的令牌。状态接口不返回内部令牌。

```sql
SELECT VERSION(), DATABASE();
SELECT COUNT(*) AS invalid_order_items
FROM trd_order_item WHERE unit_price_cent <= 0 OR quantity NOT BETWEEN 1 AND 99;
SELECT COUNT(*) AS invalid_payments FROM trd_payment WHERE amount_cent <= 0;
SELECT COUNT(*) AS invalid_refunds FROM trd_refund WHERE amount_cent <= 0;
```

迁移通过 `information_schema` 按名称检查后再执行 DDL，可在中断后重跑。**MySQL DDL 隐式提交，不是整批原子事务**；后续 CHECK 因脏数据失败时，前面增加的索引可能已经生效。客户端应在第一处错误终止，不能使用 `mysql --force`。不在应用启动时自动执行这些脚本。

本迁移不修改订单、库存、支付或退款业务行，也不执行跨域级联删除。`V20261102_01__product_images.sql` 创建 `cat_product_image` 并将已有非空 `/media/{uuid}.png` 主图幂等回填为 `sort_order=0` 的 LOCAL 对象引用；不会复制、重编码或删除文件，不改 `cat_product.image_url` 和订单图片快照。`V20261104_01__product_image_upload_ownership.sql` 再登记已有对象对应的商户归属，并创建后续上传对象的认领记录；不会改变历史图片 URL。`V20261106_01__store_profile.sql` 为 `mer_store` 增加介绍、营业时段和门店图片字段，并为图片上传记录增加 `usage_type`（历史行默认为 `PRODUCT`）；营业时段仅按业务时区展示，不自动改变交易资格，历史图片对象不会被自动认领为门店图片。`V20261106_02__order_pickup_snapshot.sql` 为 `trd_order` 增加下单时的自提门店名称与地点快照，历史订单保持空值，不按当前门店资料回填。`V20261106_03__order_events.sql` 创建只追加的订单/售后事件表，以订单和业务去重键保证重复操作不追加成功记录；不修改订单状态机。其他迁移不回填历史业务数据。仅角色与角色权限使用已有的域内外键；订单、库存、支付、退款之间的归属和状态一致性继续由同库 Case 事务维护。现有数据库若已存在**同名但定义不同**的索引/约束，脚本不会替换；升级前后应核对 `SHOW CREATE TABLE`。
新索引对应当前 Mapper 的实际访问方式：

| 索引 | 查询 |
|---|---|
| `ix_member_role(merchant_id,role,status)` | 删除角色前统计有效成员 |
| `ix_app_applicant(applicant_user_id,create_time DESC,application_id)` | 本人申请列表 |
| `ix_stock_sku(sku_id)` | 商品/购物车批量库存查询 |
| `ix_movement_merchant(merchant_id,created_at DESC,id)` | 商户库存流水分页 |
| `ix_document_base(base_id,created_at DESC,id)` | 知识库文档分页与 COUNT |
| `ix_message_sequence(conversation_id,seq_no)` | 最近会话消息按真实序列取数 |
| `ix_conversation_activity(user_id,last_active_at DESC,id)` | 本人会话按最近活跃时间稳定分页 |
| `ix_proposal_conversation(user_id,conversation_id,created_at DESC,id)` | 本人会话的提案列表 |

上述是访问路径补齐，不表示经过大数据量性能压测；生产数据量下仍需 `EXPLAIN ANALYZE` 与容量评估。

隔离验证入口（不会连接现有数据库或读取 `.env`）：

```powershell
python -X utf8 scripts/verify-mysql-isolated.py --mysql-bin D:\develop\mysql-8.0.31-winx64\bin --maven .\mvnw.cmd --http-smoke --output docs/testing/evidence/engineering/mysql.json
```

路径按本机调整；需要 JDK17、Maven、Python `pymysql`。`--http-smoke` 还需要 AI Python 运行依赖、Playwright 和本机 Chromium，可通过 `CHROMIUM_PATH` 指定。缺少依赖不得记为通过。脚本创建专属临时数据目录、随机回环端口和临时构建副本，执行历史数据保留、脏数据拒绝、所有迁移重复执行及新旧库元数据比对，再执行完整 Maven 和可选真实 HTTP/浏览器验收，最后关闭并清理自己创建的实例。

实际证据见 [专项审查报告](../../testing/CONTRACT-DATABASE-API-AUDIT-09.md)。

V20261102_01__product_images.sql 新增商品图片对象引用表并回填历史主图。迁移可重放，不删除商品或订单数据；部署前按同一 SchemaVersionGuard 流程备份并登记校验和。
