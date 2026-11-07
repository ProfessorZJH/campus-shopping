-- 历史 AI 消息的最小引用快照；只保存文档版本、证据定位和允许公开的片段。
SET @message_citation_recorded := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_message' AND COLUMN_NAME='citation_recorded'
);
SET @message_citation_recorded_ddl := IF(
    @message_citation_recorded=0,
    'ALTER TABLE ai_message ADD COLUMN citation_recorded TINYINT(1) NOT NULL DEFAULT 0 AFTER access_fingerprint',
    'SELECT 1 AS already_applied'
);
PREPARE message_citation_recorded_stmt FROM @message_citation_recorded_ddl;
EXECUTE message_citation_recorded_stmt;
DEALLOCATE PREPARE message_citation_recorded_stmt;

CREATE TABLE IF NOT EXISTS ai_message_citation (
    message_id VARCHAR(36) NOT NULL,
    ordinal INT NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    root_id VARCHAR(36) NOT NULL,
    document_version INT NOT NULL,
    chunk_id VARCHAR(100) NOT NULL,
    title VARCHAR(120) NOT NULL,
    snippet VARCHAR(500) NOT NULL DEFAULT '',
    PRIMARY KEY(message_id,ordinal),
    KEY ix_message_citation_document(document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
