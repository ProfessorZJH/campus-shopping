-- 统一 SKU 库存归属，并补齐已验证的列表访问路径。
-- 迁移前必须确认同一 sku_id 没有多个库存余额行；否则故意失败，不自动合并库存。
SET @stock_duplicate_count := (SELECT COUNT(*) FROM (SELECT sku_id FROM inv_stock_balance GROUP BY sku_id HAVING COUNT(*) > 1) d);
SET @stock_guard_sql := IF(@stock_duplicate_count = 0, 'SELECT 1', 'SELECT missing_inventory_integrity_guard');
PREPARE stock_guard_stmt FROM @stock_guard_sql;
EXECUTE stock_guard_stmt;
DEALLOCATE PREPARE stock_guard_stmt;

SET @stock_unique_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inv_stock_balance' AND INDEX_NAME='uk_stock_sku'
 AND NON_UNIQUE=0 AND SEQ_IN_INDEX=1 AND COLUMN_NAME='sku_id');
SET @stock_unique_sql := IF(@stock_unique_exists=1, 'SELECT 1 AS already_applied',
 'ALTER TABLE inv_stock_balance ADD UNIQUE KEY uk_stock_sku(sku_id)');
PREPARE stock_unique_stmt FROM @stock_unique_sql;
EXECUTE stock_unique_stmt;
DEALLOCATE PREPARE stock_unique_stmt;

-- Existing same-name indexes with another definition deliberately fail on ADD INDEX.
SET @ddl := 'ALTER TABLE cat_product ADD INDEX ix_product_public_newest(status,created_at DESC,id,merchant_id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cat_product' AND INDEX_NAME='ix_product_public_newest');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := 'ALTER TABLE cat_product ADD INDEX ix_product_merchant_newest(merchant_id,status,created_at DESC,id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cat_product' AND INDEX_NAME='ix_product_merchant_newest');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := 'ALTER TABLE trd_order ADD INDEX ix_order_buyer_page(buyer_id,status,created_at DESC,id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND INDEX_NAME='ix_order_buyer_page');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := 'ALTER TABLE trd_order ADD INDEX ix_order_merchant_page(merchant_id,status,created_at DESC,id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND INDEX_NAME='ix_order_merchant_page');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := 'ALTER TABLE trd_after_sale ADD INDEX ix_after_sale_merchant_page(merchant_id,status,created_at DESC,id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_after_sale' AND INDEX_NAME='ix_after_sale_merchant_page');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := 'ALTER TABLE inv_stock_balance ADD INDEX ix_stock_merchant_sku(merchant_id,sku_id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inv_stock_balance' AND INDEX_NAME='ix_stock_merchant_sku');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := 'ALTER TABLE ai_knowledge_base ADD INDEX ix_knowledge_base_created(created_at DESC,id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_knowledge_base' AND INDEX_NAME='ix_knowledge_base_created');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := 'ALTER TABLE ai_document_root ADD INDEX ix_document_root_active(active_document_id)';
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_document_root' AND INDEX_NAME='ix_document_root_active');
SET @sql := IF(@exists=0,@ddl,'SELECT 1 AS already_applied'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
