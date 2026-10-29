-- 仅用于已有 R1 数据库升级：非破坏性、保留旧 OWNER/CLERK/邀请记录。
-- 执行前请备份；本脚本无 DROP TABLE、不修改现有授权。
CREATE TABLE IF NOT EXISTS iam_merchant_role (
 merchant_id VARCHAR(36) NOT NULL, role_code VARCHAR(16) NOT NULL, name VARCHAR(40) NOT NULL,
 version BIGINT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(merchant_id,role_code), UNIQUE KEY uk_merchant_role_name(merchant_id,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS iam_merchant_role_permission (
 merchant_id VARCHAR(36) NOT NULL, role_code VARCHAR(16) NOT NULL, permission VARCHAR(64) NOT NULL,
 PRIMARY KEY(merchant_id,role_code,permission),
 CONSTRAINT fk_role_permission FOREIGN KEY (merchant_id,role_code) REFERENCES iam_merchant_role(merchant_id,role_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
