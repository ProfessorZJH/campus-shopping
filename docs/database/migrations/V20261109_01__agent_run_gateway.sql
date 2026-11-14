-- Agent v1.1 M2 受控 Run 与只读工具调用幂等账本；不持有第二套执行租约。
CREATE TABLE IF NOT EXISTS ai_run (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    capability_token_hash CHAR(64) NOT NULL,
    conversation_id VARCHAR(36) NOT NULL,
    turn_token VARCHAR(36) NOT NULL,
    scope_json JSON NOT NULL,
    tools_json JSON NOT NULL,
    status VARCHAR(24) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_ai_run_user_idempotency(user_id,idempotency_key),
    KEY ix_ai_run_conversation(conversation_id,user_id,created_at DESC,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_run_invocation (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    invocation_key VARCHAR(100) NOT NULL,
    tool_name VARCHAR(64) NOT NULL,
    input_fingerprint CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    input_json JSON NOT NULL,
    output_json JSON NULL,
    error_code VARCHAR(64) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,
    UNIQUE KEY uk_ai_run_invocation(run_id,invocation_key),
    KEY ix_ai_run_invocation_status(run_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
