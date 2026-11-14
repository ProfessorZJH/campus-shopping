-- 会话最近活跃时间与受控摘要；摘要只保存用户自己的问题文本，不读取受保护的回答内容。
-- 条件 DDL 支持迁移重放和中断后重跑；旧会话从真实消息时间恢复最近活跃时间。
SET @conversation_summary := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation' AND COLUMN_NAME='summary');
SET @conversation_summary_ddl := IF(@conversation_summary=0, 'ALTER TABLE ai_conversation ADD COLUMN summary VARCHAR(200) NOT NULL DEFAULT '''' AFTER title', 'SELECT 1 AS already_applied');
PREPARE conversation_summary_stmt FROM @conversation_summary_ddl;
EXECUTE conversation_summary_stmt;
DEALLOCATE PREPARE conversation_summary_stmt;

SET @conversation_activity := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation' AND COLUMN_NAME='last_active_at');
SET @conversation_activity_ddl := IF(@conversation_activity=0, 'ALTER TABLE ai_conversation ADD COLUMN last_active_at DATETIME(3) NULL AFTER created_at', 'SELECT 1 AS already_applied');
PREPARE conversation_activity_stmt FROM @conversation_activity_ddl;
EXECUTE conversation_activity_stmt;
DEALLOCATE PREPARE conversation_activity_stmt;

UPDATE ai_conversation c
LEFT JOIN (
    SELECT conversation_id, MAX(created_at) AS last_active_at
    FROM ai_message
    GROUP BY conversation_id
) m ON m.conversation_id=c.id
SET c.last_active_at=COALESCE(c.last_active_at,m.last_active_at,c.created_at),
    c.summary=CASE WHEN c.summary='' THEN LEFT(c.title,200) ELSE c.summary END
WHERE c.last_active_at IS NULL OR c.summary='';

SET @conversation_activity_not_null := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation'
      AND COLUMN_NAME='last_active_at' AND IS_NULLABLE='NO'
);
SET @conversation_activity_not_null_ddl := IF(@conversation_activity_not_null=0, 'ALTER TABLE ai_conversation MODIFY COLUMN last_active_at DATETIME(3) NOT NULL', 'SELECT 1 AS already_applied');
PREPARE conversation_activity_not_null_stmt FROM @conversation_activity_not_null_ddl;
EXECUTE conversation_activity_not_null_stmt;
DEALLOCATE PREPARE conversation_activity_not_null_stmt;

SET @conversation_activity_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_conversation' AND INDEX_NAME='ix_conversation_activity'
);
SET @conversation_activity_index_ddl := IF(@conversation_activity_index=0, 'ALTER TABLE ai_conversation ADD INDEX ix_conversation_activity(user_id,last_active_at DESC,id)', 'SELECT 1 AS already_applied');
PREPARE conversation_activity_index_stmt FROM @conversation_activity_index_ddl;
EXECUTE conversation_activity_index_stmt;
DEALLOCATE PREPARE conversation_activity_index_stmt;
