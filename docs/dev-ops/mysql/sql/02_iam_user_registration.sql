-- IAM-01 账号注册专用 DDL，独立于完整 P1 草案
-- 仅在 MySQL 8+ 本地练习库执行；本文件不会修改 mer_application 等业务表。
CREATE DATABASE IF NOT EXISTS campus_shopping
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE campus_shopping;

-- 如果 iam_user 已在 P1 草案中创建，先 SHOW COLUMNS FROM iam_user;
-- 不要指望 CREATE TABLE IF NOT EXISTS 自动补 display_name，需另外迁移。
CREATE TABLE IF NOT EXISTS iam_user (
    id            VARCHAR(36)  NOT NULL,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(50)  NOT NULL,
    status        VARCHAR(24)  NOT NULL DEFAULT 'ACTIVE',
    version       BIGINT       NOT NULL DEFAULT 0,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                  ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_iam_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 已存在老版 iam_user 且只有 display_name 缺失时，手动执行一次以下语句，
-- 并按真实业务数据补齐 display_name；新库不要执行。
-- ALTER TABLE iam_user ADD COLUMN display_name VARCHAR(50) NOT NULL DEFAULT '' AFTER password_hash;

SHOW CREATE TABLE iam_user;
