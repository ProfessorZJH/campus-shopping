# R1 数据模型与迁移说明

> 当前 MySQL DDL 共有 31 张表。DDL、索引及 Mapper 已静态核对，**尚未在本次环境执行 MySQL 建库或升级**。
> 权威建表源：[`schema.sql`](../../campus-shopping-app/src/main/resources/schema.sql)。分类初始数据：[`data.sql`](../../campus-shopping-app/src/main/resources/data.sql)。

## 执行前必须确认

新库执行 [`00_r1_schema.sql`](../dev-ops/mysql/sql/00_r1_schema.sql)，它包括 CREATE DATABASE 和 USE，再执行 data.sql。Docker 首次初始化由 Compose 挂载上述两个资源。

只针对此前教学版账号/申请表，先备份并核对 SHOW CREATE TABLE，按运行手册应用 [`03_upgrade_teaching_schema.sql`](../dev-ops/mysql/sql/03_upgrade_teaching_schema.sql)，再建其余表与执行 [`04_case_sensitive_keys.sql`](../dev-ops/mysql/sql/04_case_sensitive_keys.sql)。这些脚本不是任意历史数据库的通用迁移工具。

`CREATE TABLE IF NOT EXISTS` 不修复已有不兼容表；严禁把旧完整 P1 草案直接执行到当前库。旧草案已经改名为非 SQL 文本保存，仅供历史追溯。

## 事务与约束

- 单库 InnoDB；审批/授权、下单/预占、支付/自提任务、退款/释放、核销/出库在 Case 事务内完成。
- 表归属不因为同库而混用：通过各域服务与仓储修改，禁止 Case 直接调用 Mapper。
- 订单先锁行，再按 SKU ID 排序锁库存；同一买家购物车用 `trd_cart_owner` 行串行化，避免确认提案与结算丢失更新。
- 请求键、补货业务键、规格键采用区分大小写排序规则。不能让同一幂等键随大小写变化被错误合并。
- schema_version 记录已应用规格版本；此处没有声称已引入 Flyway 自动校验全量历史。

### SDD-02 增量迁移（已有 R1 数据库）

原有 `trd_order_item` 不包含 `image_url`。先备份，执行 [`V20261028_01__order_item_image_snapshot.sql`](migrations/V20261028_01__order_item_image_snapshot.sql)，然后部署新代码；迁移只新增一列、默认空串，不反填历史订单。新库使用 `00_r1_schema.sql` 或应用内 `schema.sql` 直接包含该列；`CREATE TABLE IF NOT EXISTS` 本身不能给旧表新增字段。MySQL 8.0 上反复执行本迁移时，脚本按 `information_schema` 跳过已存在列。

其他新增 `imageUrl`、`merchantName`、`PageResponseDTO`、库存商品信息都是读模型/DTO 变更，**不需要修改表结构**。

## 当前表与字段

### `iam_user`

```sql
id VARCHAR(36) PRIMARY KEY, username VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL, display_name VARCHAR(50) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE KEY uk_iam_user_username(username)
```

### `iam_platform_role`

```sql
user_id VARCHAR(36) NOT NULL, role VARCHAR(32) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(user_id,role)
```

### `iam_merchant_membership`

```sql
merchant_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, role VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL,
 source_application_id VARCHAR(64), version BIGINT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(merchant_id,user_id), KEY ix_member_user(user_id,status)
```

### `iam_invitation`

```sql
id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, target_user_id VARCHAR(36) NOT NULL, invited_by VARCHAR(36) NOT NULL,
 status VARCHAR(16) NOT NULL, expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_inv_target(target_user_id,status)
```

### `sys_audit`

```sql
id VARCHAR(36) PRIMARY KEY, actor_user_id VARCHAR(36) NOT NULL, action VARCHAR(80) NOT NULL, target_id VARCHAR(64) NOT NULL, merchant_id VARCHAR(36),
 detail VARCHAR(1000) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_audit_merchant(merchant_id,created_at)
```

### `mer_application`

```sql
application_id VARCHAR(64) PRIMARY KEY, applicant_user_id VARCHAR(64) NOT NULL, request_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, merchant_name VARCHAR(100) NOT NULL,
 category VARCHAR(50), contact_name VARCHAR(50), contact_phone VARCHAR(30), store_name VARCHAR(100), campus_location VARCHAR(200),
 status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED', reviewer_user_id VARCHAR(64), rejection_reason VARCHAR(500), opened_merchant_id VARCHAR(36),
 version INT NOT NULL DEFAULT 0, create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_app_request(applicant_user_id,request_key), KEY ix_app_status(status,create_time)
```

### `mer_merchant`

```sql
id VARCHAR(36) PRIMARY KEY, source_application_id VARCHAR(64) NOT NULL, name VARCHAR(100) NOT NULL, category VARCHAR(50) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', version BIGINT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_merchant_application(source_application_id)
```

### `mer_store`

```sql
id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, location VARCHAR(200) NOT NULL,
 UNIQUE KEY uk_store_merchant(merchant_id)
```

### `cat_category`

```sql
code VARCHAR(32) PRIMARY KEY, name VARCHAR(50) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
```

### `cat_product`

```sql
id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, title VARCHAR(100) NOT NULL,
 description TEXT NOT NULL, image_url VARCHAR(255) NOT NULL, category_code VARCHAR(32) NOT NULL, status VARCHAR(20) NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_product_merchant(merchant_id,status), KEY ix_product_category(category_code,status)
```

### `cat_sku`

```sql
id VARCHAR(36) PRIMARY KEY, product_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL,
 spec_key VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, price_cent BIGINT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', version BIGINT NOT NULL DEFAULT 0,
 UNIQUE KEY uk_sku_spec(product_id,spec_key), CONSTRAINT ck_sku_price CHECK (price_cent > 0)
```

### `inv_stock_balance`

```sql
merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, on_hand BIGINT NOT NULL DEFAULT 0,
 reserved BIGINT NOT NULL DEFAULT 0, version BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(store_id,sku_id), KEY ix_stock_merchant(merchant_id),
 CONSTRAINT ck_stock_balance CHECK (on_hand >= reserved AND reserved >= 0)
```

### `inv_reservation`

```sql
order_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, quantity INT NOT NULL,
 status VARCHAR(16) NOT NULL, PRIMARY KEY(order_id,sku_id), CONSTRAINT ck_reservation_qty CHECK (quantity>0)
```

### `inv_stock_movement`

```sql
id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL,
 type VARCHAR(16) NOT NULL, quantity INT NOT NULL, biz_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_stock_movement(store_id,sku_id,type,biz_key)
```

### `trd_cart_item`

```sql
user_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, quantity INT NOT NULL,
 version BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(user_id,sku_id), CONSTRAINT ck_cart_quantity CHECK(quantity BETWEEN 1 AND 99)
```

### `trd_checkout_request`

```sql
user_id VARCHAR(36) NOT NULL, request_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, fingerprint CHAR(64) NOT NULL, order_id VARCHAR(36), PRIMARY KEY(user_id,request_key)
```

### `trd_order`

```sql
id VARCHAR(36) PRIMARY KEY, buyer_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL,
 total_cent BIGINT NOT NULL, status VARCHAR(24) NOT NULL, deadline DATETIME(3) NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_order_buyer(buyer_id,created_at), KEY ix_order_merchant(merchant_id,status), KEY ix_order_expiry(status,deadline), CONSTRAINT ck_order_total CHECK(total_cent>0)
```

### `trd_order_item`

```sql
order_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, title VARCHAR(100) NOT NULL, spec_key VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 image_url VARCHAR(255) NOT NULL DEFAULT '', unit_price_cent BIGINT NOT NULL, quantity INT NOT NULL, PRIMARY KEY(order_id,sku_id)
```

### `trd_payment`

```sql
order_id VARCHAR(36) PRIMARY KEY, amount_cent BIGINT NOT NULL, status VARCHAR(16) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
```

### `trd_after_sale`

```sql
id VARCHAR(36) PRIMARY KEY, order_id VARCHAR(36) NOT NULL, buyer_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL,
 status VARCHAR(16) NOT NULL, reason VARCHAR(500) NOT NULL, decision_reason VARCHAR(500) NOT NULL DEFAULT '', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_after_order(order_id)
```

### `trd_refund`

```sql
order_id VARCHAR(36) PRIMARY KEY, amount_cent BIGINT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
```

### `ful_pickup_task`

```sql
id VARCHAR(36) PRIMARY KEY, order_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL,
 buyer_id VARCHAR(36) NOT NULL, status VARCHAR(16) NOT NULL, credential_hash CHAR(64), expires_at DATETIME(3), UNIQUE KEY uk_pickup_order(order_id), KEY ix_pickup_merchant(merchant_id,status)
```

### `ful_pickup_verification`

```sql
id VARCHAR(36) PRIMARY KEY, pickup_id VARCHAR(36) NOT NULL, operator_user_id VARCHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_pickup_verified(pickup_id)
```

### `ai_knowledge_base`

```sql
id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, merchant_id VARCHAR(36), visibility VARCHAR(32) NOT NULL, created_by VARCHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
```

### `ai_document_root`

```sql
id VARCHAR(36) PRIMARY KEY, base_id VARCHAR(36) NOT NULL, active_document_id VARCHAR(36), version_counter INT NOT NULL DEFAULT 0
```

### `ai_document`

```sql
id VARCHAR(36) PRIMARY KEY, root_id VARCHAR(36) NOT NULL, base_id VARCHAR(36) NOT NULL, version INT NOT NULL, title VARCHAR(120) NOT NULL,
 status VARCHAR(20) NOT NULL, index_status VARCHAR(20) NOT NULL, content LONGTEXT NOT NULL, error VARCHAR(500) NOT NULL DEFAULT '',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_doc_version(root_id,version)
```

### `ai_conversation`

```sql
id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, title VARCHAR(100) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_conversation_owner(user_id,created_at)
```

### `ai_message`

```sql
seq_no BIGINT NOT NULL AUTO_INCREMENT UNIQUE,
 id VARCHAR(36) PRIMARY KEY, conversation_id VARCHAR(36) NOT NULL, role VARCHAR(16) NOT NULL, content TEXT NOT NULL, access_fingerprint CHAR(64),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_message_conversation(conversation_id,created_at)
```

### `ai_proposal`

```sql
id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, conversation_id VARCHAR(36) NOT NULL, status VARCHAR(16) NOT NULL,
 items_json TEXT NOT NULL, selection_hash CHAR(64), expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
```

### `sys_schema_version`

```sql
version INT PRIMARY KEY, installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
```

### `trd_cart_owner`

```sql
user_id VARCHAR(36) PRIMARY KEY
```



## SDD-05：商户自定义 RBAC 数据结构（2026-10-28）

- `iam_merchant_role(merchant_id,role_code,name,version,created_at)`：商户内自定义角色，`PRIMARY KEY(merchant_id,role_code)`，`UNIQUE(merchant_id,name)`。内置 `OWNER`、`CLERK` 不额外写表。
- `iam_merchant_role_permission(merchant_id,role_code,permission)`：角色权限，`PRIMARY KEY(merchant_id,role_code,permission)`，外键引用商户自定义角色。
- 原有 `iam_merchant_membership.role VARCHAR(16)` 存内置角色码或 `R` 加 12 个 hex 字符的自定义角色码；已有数据保持不变。
- 旧库升级执行 `docs/database/migrations/V20261028_02__merchant_rbac.sql`，先备份，不可重新执行 `data.sql` 覆盖数据；所有更改保留审计。详情见 [SDD-05](../specs/SDD-RBAC-05.md)。
