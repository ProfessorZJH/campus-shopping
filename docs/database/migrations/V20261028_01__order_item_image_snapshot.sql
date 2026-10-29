-- 仅对已存在的 trd_order_item 表运行；新库由 schema.sql 直接创建此列。
-- MySQL 8.0 兼容：检查 information_schema 后按需增加；不会覆盖历史订单行。
SET @snapshot_exists := (
 SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order_item' AND COLUMN_NAME='image_url'
);
SET @snapshot_sql := IF(@snapshot_exists=0,
 CONCAT('ALTER TABLE trd_order_item ADD COLUMN image_url VARCHAR(255) NOT NULL DEFAULT ', CHAR(39), CHAR(39), ' AFTER spec_key'),
 'SELECT 1 AS already_applied');
PREPARE stmt FROM @snapshot_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
