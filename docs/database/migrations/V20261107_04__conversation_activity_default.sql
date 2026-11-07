-- 与新库基线保持一致：会话活跃时间由数据库提供当前时间默认值。
SET @conversation_activity_default := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation'
      AND COLUMN_NAME='last_active_at' AND COLUMN_DEFAULT IS NOT NULL
);
SET @conversation_activity_default_ddl := IF(
    @conversation_activity_default=0,
    'ALTER TABLE ai_conversation MODIFY COLUMN last_active_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
    'SELECT 1 AS already_applied'
);
PREPARE conversation_activity_default_stmt FROM @conversation_activity_default_ddl;
EXECUTE conversation_activity_default_stmt;
DEALLOCATE PREPARE conversation_activity_default_stmt;
