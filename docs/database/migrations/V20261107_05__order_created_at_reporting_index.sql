-- 为平台/商户经营统计的期间过滤补齐订单创建时间索引。
SET @order_created_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND INDEX_NAME='ix_order_created'
);
SET @order_created_index_sql := IF(
    @order_created_index_exists=0,
    'ALTER TABLE trd_order ADD KEY ix_order_created(created_at,id)',
    'SELECT 1 AS already_applied'
);
PREPARE order_created_index_stmt FROM @order_created_index_sql;
EXECUTE order_created_index_stmt;
DEALLOCATE PREPARE order_created_index_stmt;
