-- 跨实例会话轮次状态与取消意图。执行前备份，在维护窗口运行显式迁移工具。
SET @turn_status_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation' AND COLUMN_NAME='turn_status');
SET @turn_status_sql := IF(@turn_status_exists=0, 'ALTER TABLE ai_conversation ADD COLUMN turn_status VARCHAR(24) NOT NULL DEFAULT ''IDLE'' AFTER turn_expires_at', 'SELECT 1 AS already_applied');
PREPARE turn_status_stmt FROM @turn_status_sql;
EXECUTE turn_status_stmt;
DEALLOCATE PREPARE turn_status_stmt;

SET @cancel_at_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation' AND COLUMN_NAME='turn_cancel_requested_at');
SET @cancel_at_sql := IF(@cancel_at_exists=0, 'ALTER TABLE ai_conversation ADD COLUMN turn_cancel_requested_at DATETIME(3) NULL AFTER turn_status', 'SELECT 1 AS already_applied');
PREPARE cancel_at_stmt FROM @cancel_at_sql;
EXECUTE cancel_at_stmt;
DEALLOCATE PREPARE cancel_at_stmt;
