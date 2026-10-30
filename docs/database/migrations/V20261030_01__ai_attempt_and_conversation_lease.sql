-- 索引请求令牌和会话租约。执行前备份，在维护窗口运行显式迁移工具。
-- 只增列，不修改已有状态、会话或消息。已完成的旧索引保持有效。
SET @ai_column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_document' AND COLUMN_NAME='index_attempt');
SET @ai_ddl := IF(@ai_column_exists=0, 'ALTER TABLE ai_document ADD COLUMN index_attempt VARCHAR(36) NULL AFTER index_status', 'SELECT 1 AS already_applied');
PREPARE ai_stmt FROM @ai_ddl;
EXECUTE ai_stmt;
DEALLOCATE PREPARE ai_stmt;

SET @ai_column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation' AND COLUMN_NAME='turn_token');
SET @ai_ddl := IF(@ai_column_exists=0, 'ALTER TABLE ai_conversation ADD COLUMN turn_token VARCHAR(36) NULL AFTER title', 'SELECT 1 AS already_applied');
PREPARE ai_stmt FROM @ai_ddl;
EXECUTE ai_stmt;
DEALLOCATE PREPARE ai_stmt;

SET @ai_column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation' AND COLUMN_NAME='turn_expires_at');
SET @ai_ddl := IF(@ai_column_exists=0, 'ALTER TABLE ai_conversation ADD COLUMN turn_expires_at DATETIME(3) NULL AFTER turn_token', 'SELECT 1 AS already_applied');
PREPARE ai_stmt FROM @ai_ddl;
EXECUTE ai_stmt;
DEALLOCATE PREPARE ai_stmt;
