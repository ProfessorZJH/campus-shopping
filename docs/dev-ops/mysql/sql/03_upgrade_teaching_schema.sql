-- 仅适用于此前的 mer_application 教学表；先备份。
USE campus_shopping;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='mer_application' AND column_name='category')=0, 'ALTER TABLE mer_application ADD COLUMN category VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='mer_application' AND column_name='contact_name')=0, 'ALTER TABLE mer_application ADD COLUMN contact_name VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='mer_application' AND column_name='contact_phone')=0, 'ALTER TABLE mer_application ADD COLUMN contact_phone VARCHAR(30) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='mer_application' AND column_name='store_name')=0, 'ALTER TABLE mer_application ADD COLUMN store_name VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='mer_application' AND column_name='campus_location')=0, 'ALTER TABLE mer_application ADD COLUMN campus_location VARCHAR(200) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='mer_application' AND column_name='opened_merchant_id')=0, 'ALTER TABLE mer_application ADD COLUMN opened_merchant_id VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
