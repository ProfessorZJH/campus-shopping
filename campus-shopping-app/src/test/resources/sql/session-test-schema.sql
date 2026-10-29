-- 仅测试库使用，H2 不替代真实 MySQL 并发测试。
CREATE TABLE IF NOT EXISTS iam_user (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_iam_user_username UNIQUE (username)
);
CREATE TABLE IF NOT EXISTS mer_application (
    application_id VARCHAR(64) PRIMARY KEY,
    applicant_user_id VARCHAR(64) NOT NULL,
    request_key VARCHAR(64) NOT NULL,
    merchant_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),contact_name VARCHAR(50),contact_phone VARCHAR(30),store_name VARCHAR(100),campus_location VARCHAR(200),opened_merchant_id VARCHAR(36),
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    reviewer_user_id VARCHAR(64),
    rejection_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_applicant_request UNIQUE (applicant_user_id, request_key)
);

CREATE TABLE IF NOT EXISTS iam_platform_role(user_id VARCHAR(36),role VARCHAR(30),PRIMARY KEY(user_id,role));

-- 匿名公开商户接口的真实 MVC/安全过滤器测试需要最小商户表。
CREATE TABLE IF NOT EXISTS mer_merchant (
    id VARCHAR(36) PRIMARY KEY,
    source_application_id VARCHAR(64),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS mer_store (
    id VARCHAR(36) PRIMARY KEY,
    merchant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255)
);
