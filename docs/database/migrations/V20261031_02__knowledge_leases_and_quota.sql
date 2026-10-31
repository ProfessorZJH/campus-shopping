-- 知识索引租约和商户资源配额。停旧实例、备份后显式迁移，不由应用启动执行。
SET @ai_column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_document' AND COLUMN_NAME='index_expires_at');
SET @ai_ddl := IF(@ai_column_exists=0, 'ALTER TABLE ai_document ADD COLUMN index_expires_at DATETIME(3) NULL AFTER index_attempt', 'SELECT 1 AS already_applied');
PREPARE ai_stmt FROM @ai_ddl;
EXECUTE ai_stmt;
DEALLOCATE PREPARE ai_stmt;
SET @ai_column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_document' AND COLUMN_NAME='index_version');
SET @ai_ddl := IF(@ai_column_exists=0, 'ALTER TABLE ai_document ADD COLUMN index_version INT NULL AFTER index_expires_at', 'SELECT 1 AS already_applied');
PREPARE ai_stmt FROM @ai_ddl;
EXECUTE ai_stmt;
DEALLOCATE PREPARE ai_stmt;
CREATE TABLE IF NOT EXISTS ai_knowledge_usage (
 owner_id VARCHAR(36) PRIMARY KEY, document_count INT NOT NULL DEFAULT 0, content_bytes BIGINT NOT NULL DEFAULT 0,
 index_window DATETIME(3) NULL, index_count INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO ai_knowledge_usage(owner_id,document_count,content_bytes)
SELECT COALESCE(b.merchant_id,'__platform__'),COUNT(*),COALESCE(SUM(OCTET_LENGTH(d.content)),0)
FROM ai_document d JOIN ai_knowledge_base b ON b.id=d.base_id GROUP BY COALESCE(b.merchant_id,'__platform__');
