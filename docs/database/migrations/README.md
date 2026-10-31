# R1 旧库升级与专项审查迁移

仅适用于当前 R1 表结构；教学版须先按运行手册升级。新库直接使用最新 `schema.sql`，`CREATE TABLE IF NOT EXISTS` 不会升级已有表。

1. 备份并在副本验证，核对 MySQL 版本至少为 8.0.16（本次实际使用 8.0.31）。
2. 准备有 DDL 权限的升级账号，在当前终端设置 `DB_USERNAME` / `DB_PASSWORD`；凭据不放命令行、不提交 Git。
3. 在目标库执行下面的前置检查，结果必须全为 0；异常记录应由业务负责人核对，不能自动删行或改金额。
4. 在维护窗口运行下方显式迁移命令。CLI 按顺序执行 `V20261028_01`（订单图片）、`V20261028_02`（RBAC）、`V20261029_01`（完整性及索引），成功后逐项登记 SHA-256。七个索引可能消耗建索引时间、额外空间和元数据锁等待。

```powershell
python -m pip install --require-hashes -r ai-service/requirements-dev.lock
python scripts/migrate-database.py --host 127.0.0.1 --port 3306 --database campus_shopping
python scripts/migrate-database.py --host 127.0.0.1 --port 3306 --database campus_shopping --check
```

显式指定目标库，脚本不读取 `.env`。以前手工执行过这些幂等 SQL 的库也要运行此入口登记历史。CLI 使用 MySQL 命名锁防止并发升级；已登记脚本的校验和改变或数据库记录了更新版本时直接拒绝。新增迁移后运行 `python scripts/schema_contract.py` 更新构建清单，CI 使用 `--check` 拒绝漂移。

应用默认启用 `SchemaVersionGuard`，在管理员引导前只读核对完整版本和校验和，缺失或不匹配就启动失败，不执行升级 DDL。新空库的 `schema.sql` 会登记完整版本；在已有库重放初始化脚本不会登记缺失的升级。

```sql
SELECT VERSION(), DATABASE();
SELECT COUNT(*) AS invalid_order_items
FROM trd_order_item WHERE unit_price_cent <= 0 OR quantity NOT BETWEEN 1 AND 99;
SELECT COUNT(*) AS invalid_payments FROM trd_payment WHERE amount_cent <= 0;
SELECT COUNT(*) AS invalid_refunds FROM trd_refund WHERE amount_cent <= 0;
```

迁移通过 `information_schema` 按名称检查后再执行 DDL，可在中断后重跑。**MySQL DDL 隐式提交，不是整批原子事务**；后续 CHECK 因脏数据失败时，前面增加的索引可能已经生效。客户端应在第一处错误终止，不能使用 `mysql --force`。不在应用启动时自动执行这些脚本。

本迁移不修改业务行、不回填历史商品图片、不增加跨域级联删除。仅角色与角色权限使用已有的域内外键；订单、库存、支付、退款之间的归属和状态一致性继续由同库 Case 事务维护。现有数据库若已存在**同名但定义不同**的索引/约束，脚本不会替换；升级前后应核对 `SHOW CREATE TABLE`。

新索引对应当前 Mapper 的实际访问方式：

| 索引 | 查询 |
|---|---|
| `ix_member_role(merchant_id,role,status)` | 删除角色前统计有效成员 |
| `ix_app_applicant(applicant_user_id,create_time DESC,application_id)` | 本人申请列表 |
| `ix_stock_sku(sku_id)` | 商品/购物车批量库存查询 |
| `ix_movement_merchant(merchant_id,created_at DESC,id)` | 商户库存流水分页 |
| `ix_document_base(base_id,created_at DESC,id)` | 知识库文档分页与 COUNT |
| `ix_message_sequence(conversation_id,seq_no)` | 最近会话消息按真实序列取数 |
| `ix_proposal_conversation(user_id,conversation_id,created_at DESC,id)` | 本人会话的提案列表 |

上述是访问路径补齐，不表示经过大数据量性能压测；生产数据量下仍需 `EXPLAIN ANALYZE` 与容量评估。

隔离验证入口（不会连接现有数据库或读取 `.env`）：

```powershell
python -X utf8 scripts/verify-mysql-isolated.py --mysql-bin D:\develop\mysql-8.0.31-winx64\bin --maven .\mvnw.cmd --http-smoke --output docs/testing/evidence/engineering/mysql.json
```

路径按本机调整；需要 JDK17、Maven、Python `pymysql`。`--http-smoke` 还需要 AI Python 运行依赖、Playwright 和本机 Chromium，可通过 `CHROMIUM_PATH` 指定。缺少依赖不得记为通过。脚本创建专属临时数据目录、随机回环端口和临时构建副本，执行历史数据保留、脏数据拒绝、所有迁移重复执行及新旧库元数据比对，再执行完整 Maven 和可选真实 HTTP/浏览器验收，最后关闭并清理自己创建的实例。

实际证据见 [专项审查报告](../../testing/CONTRACT-DATABASE-API-AUDIT-09.md)。
