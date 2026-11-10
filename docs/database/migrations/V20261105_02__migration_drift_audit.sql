-- 迁移完成后的结构漂移及人工基线准入审计。
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.TABLES
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_schema_migration_drift');
SET @audit_ddl := IF(@audit_exists=0,
 'CREATE TABLE IF NOT EXISTS sys_schema_migration_drift (
    id BIGINT NOT NULL AUTO_INCREMENT,
    database_name VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    release_name VARCHAR(128) NULL,
    target_fingerprint CHAR(64) NULL,
    actual_fingerprint CHAR(64) NULL,
    operator_name VARCHAR(128) NULL,
    reason VARCHAR(1000) NULL,
    detail TEXT NOT NULL,
    detected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY ix_schema_drift_database(database_name,detected_at),
    KEY ix_schema_drift_type(event_type,detected_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;
