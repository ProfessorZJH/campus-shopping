-- 新订单在下单事务内保存自提门店名称与地点快照；历史订单保持空值，不按当前门店资料回填。
-- 条件 DDL 支持迁移重放和中断后重跑。
SET @pickup_store := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND COLUMN_NAME='pickup_store_name');
SET @pickup_store_ddl := IF(@pickup_store=0, 'ALTER TABLE trd_order ADD COLUMN pickup_store_name VARCHAR(100) NOT NULL DEFAULT '''' AFTER store_id', 'SELECT 1 AS already_applied');
PREPARE pickup_store_stmt FROM @pickup_store_ddl;
EXECUTE pickup_store_stmt;
DEALLOCATE PREPARE pickup_store_stmt;

SET @pickup_location := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND COLUMN_NAME='pickup_location');
SET @pickup_location_ddl := IF(@pickup_location=0, 'ALTER TABLE trd_order ADD COLUMN pickup_location VARCHAR(200) NOT NULL DEFAULT '''' AFTER pickup_store_name', 'SELECT 1 AS already_applied');
PREPARE pickup_location_stmt FROM @pickup_location_ddl;
EXECUTE pickup_location_stmt;
DEALLOCATE PREPARE pickup_location_stmt;
