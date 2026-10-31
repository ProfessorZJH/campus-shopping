-- SDD-12；仅在维护窗口备份后执行。重复执行不改变已存在的租约数据。
SET @lease_owner_exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ai_conversation' AND column_name='processing_owner');
SET @lease_owner_sql := IF(@lease_owner_exists=0,'ALTER TABLE ai_conversation ADD COLUMN processing_owner VARCHAR(64) NULL FIRST','SELECT 1');
PREPARE lease_stmt FROM @lease_owner_sql;
EXECUTE lease_stmt;
DEALLOCATE PREPARE lease_stmt;
SET @lease_until_exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ai_conversation' AND column_name='processing_until');
SET @lease_until_sql := IF(@lease_until_exists=0,'ALTER TABLE ai_conversation ADD COLUMN processing_until DATETIME(3) NULL AFTER processing_owner','SELECT 1');
PREPARE lease_stmt FROM @lease_until_sql;
EXECUTE lease_stmt;
DEALLOCATE PREPARE lease_stmt;
CREATE TABLE IF NOT EXISTS ai_knowledge_quota (id VARCHAR(16) PRIMARY KEY, used_count INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO ai_knowledge_quota(id,used_count) SELECT 'global',COUNT(*) FROM ai_knowledge_base;
