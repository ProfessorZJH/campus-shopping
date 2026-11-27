-- 校园商业体验升级：订单备注/自提时段/支付渠道流水号、自提短号与6位核销码、售后举证图、订单评价与商品收藏。
-- 条件 DDL 支持迁移重放和中断后重跑。

SET @trd_order_remark := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND COLUMN_NAME='buyer_remark');
SET @trd_order_remark_ddl := IF(@trd_order_remark=0, 'ALTER TABLE trd_order ADD COLUMN buyer_remark VARCHAR(200) NOT NULL DEFAULT ''''', 'SELECT 1 AS already_applied');
PREPARE trd_order_remark_stmt FROM @trd_order_remark_ddl;
EXECUTE trd_order_remark_stmt;
DEALLOCATE PREPARE trd_order_remark_stmt;

SET @trd_order_slot := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND COLUMN_NAME='pickup_slot');
SET @trd_order_slot_ddl := IF(@trd_order_slot=0, 'ALTER TABLE trd_order ADD COLUMN pickup_slot VARCHAR(64) NOT NULL DEFAULT ''IMMEDIATE''', 'SELECT 1 AS already_applied');
PREPARE trd_order_slot_stmt FROM @trd_order_slot_ddl;
EXECUTE trd_order_slot_stmt;
DEALLOCATE PREPARE trd_order_slot_stmt;

SET @trd_order_pay_ch := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND COLUMN_NAME='payment_channel');
SET @trd_order_pay_ch_ddl := IF(@trd_order_pay_ch=0, 'ALTER TABLE trd_order ADD COLUMN payment_channel VARCHAR(24) NOT NULL DEFAULT ''''', 'SELECT 1 AS already_applied');
PREPARE trd_order_pay_ch_stmt FROM @trd_order_pay_ch_ddl;
EXECUTE trd_order_pay_ch_stmt;
DEALLOCATE PREPARE trd_order_pay_ch_stmt;

SET @trd_order_pay_no := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND COLUMN_NAME='payment_trade_no');
SET @trd_order_pay_no_ddl := IF(@trd_order_pay_no=0, 'ALTER TABLE trd_order ADD COLUMN payment_trade_no VARCHAR(64) NOT NULL DEFAULT ''''', 'SELECT 1 AS already_applied');
PREPARE trd_order_pay_no_stmt FROM @trd_order_pay_no_ddl;
EXECUTE trd_order_pay_no_stmt;
DEALLOCATE PREPARE trd_order_pay_no_stmt;

SET @ful_pickup_code := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ful_pickup_task' AND COLUMN_NAME='pickup_code');
SET @ful_pickup_code_ddl := IF(@ful_pickup_code=0, 'ALTER TABLE ful_pickup_task ADD COLUMN pickup_code VARCHAR(16) NOT NULL DEFAULT ''''', 'SELECT 1 AS already_applied');
PREPARE ful_pickup_code_stmt FROM @ful_pickup_code_ddl;
EXECUTE ful_pickup_code_stmt;
DEALLOCATE PREPARE ful_pickup_code_stmt;

SET @ful_pin_hash := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ful_pickup_task' AND COLUMN_NAME='pin_hash');
SET @ful_pin_hash_ddl := IF(@ful_pin_hash=0, 'ALTER TABLE ful_pickup_task ADD COLUMN pin_hash CHAR(64) NULL', 'SELECT 1 AS already_applied');
PREPARE ful_pin_hash_stmt FROM @ful_pin_hash_ddl;
EXECUTE ful_pin_hash_stmt;
DEALLOCATE PREPARE ful_pin_hash_stmt;

SET @ful_pin_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ful_pickup_task' AND INDEX_NAME='ix_pickup_merchant_pin');
SET @ful_pin_idx_ddl := IF(@ful_pin_idx=0, 'ALTER TABLE ful_pickup_task ADD KEY ix_pickup_merchant_pin(merchant_id,status,pin_hash)', 'SELECT 1 AS already_applied');
PREPARE ful_pin_idx_stmt FROM @ful_pin_idx_ddl;
EXECUTE ful_pin_idx_stmt;
DEALLOCATE PREPARE ful_pin_idx_stmt;

SET @trd_as_evidence := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_after_sale' AND COLUMN_NAME='evidence_image_url');
SET @trd_as_evidence_ddl := IF(@trd_as_evidence=0, 'ALTER TABLE trd_after_sale ADD COLUMN evidence_image_url VARCHAR(255) NOT NULL DEFAULT ''''', 'SELECT 1 AS already_applied');
PREPARE trd_as_evidence_stmt FROM @trd_as_evidence_ddl;
EXECUTE trd_as_evidence_stmt;
DEALLOCATE PREPARE trd_as_evidence_stmt;

CREATE TABLE IF NOT EXISTS trd_order_review (
 id VARCHAR(36) PRIMARY KEY,
 order_id VARCHAR(36) NOT NULL,
 product_id VARCHAR(36) NOT NULL,
 merchant_id VARCHAR(36) NOT NULL,
 buyer_id VARCHAR(36) NOT NULL,
 buyer_name VARCHAR(50) NOT NULL,
 rating TINYINT NOT NULL,
 tags VARCHAR(200) NOT NULL DEFAULT '',
 content VARCHAR(500) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_review_order_product(order_id,product_id),
 KEY ix_review_product(product_id,created_at DESC,id),
 CONSTRAINT ck_review_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS cat_product_favorite (
 user_id VARCHAR(36) NOT NULL,
 product_id VARCHAR(36) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,product_id),
 KEY ix_favorite_user(user_id,created_at DESC,product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
