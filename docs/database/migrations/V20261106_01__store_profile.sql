-- 门店公开介绍、营业时段与图片；营业时段仅展示，不自动改变交易资格。
-- 条件 DDL 支持迁移重放和中断后重跑。
SET @store_description := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mer_store' AND COLUMN_NAME='description');
SET @store_description_ddl := IF(@store_description=0, 'ALTER TABLE mer_store ADD COLUMN description VARCHAR(2000) NOT NULL DEFAULT '''' AFTER location', 'SELECT 1 AS already_applied');
PREPARE store_description_stmt FROM @store_description_ddl;
EXECUTE store_description_stmt;
DEALLOCATE PREPARE store_description_stmt;

SET @store_hours := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mer_store' AND COLUMN_NAME='business_hours');
SET @store_hours_ddl := IF(@store_hours=0, 'ALTER TABLE mer_store ADD COLUMN business_hours VARCHAR(200) NOT NULL DEFAULT '''' AFTER description', 'SELECT 1 AS already_applied');
PREPARE store_hours_stmt FROM @store_hours_ddl;
EXECUTE store_hours_stmt;
DEALLOCATE PREPARE store_hours_stmt;

SET @store_image := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mer_store' AND COLUMN_NAME='image_url');
SET @store_image_ddl := IF(@store_image=0, 'ALTER TABLE mer_store ADD COLUMN image_url VARCHAR(255) NOT NULL DEFAULT '''' AFTER business_hours', 'SELECT 1 AS already_applied');
PREPARE store_image_stmt FROM @store_image_ddl;
EXECUTE store_image_stmt;
DEALLOCATE PREPARE store_image_stmt;

-- 上传对象用途：PRODUCT（商品）或 STORE（门店）；历史行默认商品。
SET @upload_usage := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cat_product_image_upload' AND COLUMN_NAME='usage_type');
SET @upload_usage_ddl := IF(@upload_usage=0, 'ALTER TABLE cat_product_image_upload ADD COLUMN usage_type VARCHAR(16) NOT NULL DEFAULT ''PRODUCT'' AFTER merchant_id', 'SELECT 1 AS already_applied');
PREPARE upload_usage_stmt FROM @upload_usage_ddl;
EXECUTE upload_usage_stmt;
DEALLOCATE PREPARE upload_usage_stmt;

SET @upload_usage_check := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='cat_product_image_upload' AND CONSTRAINT_NAME='ck_product_image_upload_usage');
SET @upload_usage_check_ddl := IF(@upload_usage_check=0, 'ALTER TABLE cat_product_image_upload ADD CONSTRAINT ck_product_image_upload_usage CHECK (usage_type IN (''PRODUCT'',''STORE''))', 'SELECT 1 AS already_applied');
PREPARE upload_usage_check_stmt FROM @upload_usage_check_ddl;
EXECUTE upload_usage_check_stmt;
DEALLOCATE PREPARE upload_usage_check_stmt;
