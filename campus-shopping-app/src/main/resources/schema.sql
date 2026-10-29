-- R1 完整表结构。不得通过删除数据库覆盖用户旧数据。
CREATE TABLE IF NOT EXISTS iam_user (
 id VARCHAR(36) PRIMARY KEY, username VARCHAR(64) NOT NULL, password_hash VARCHAR(255) NOT NULL, display_name VARCHAR(50) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), UNIQUE KEY uk_iam_user_username(username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS iam_platform_role (
 user_id VARCHAR(36) NOT NULL, role VARCHAR(32) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(user_id,role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS iam_merchant_membership (
 merchant_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, role VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL,
 source_application_id VARCHAR(64), version BIGINT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(merchant_id,user_id), KEY ix_member_user(user_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS iam_invitation (
 id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, target_user_id VARCHAR(36) NOT NULL, invited_by VARCHAR(36) NOT NULL,
 status VARCHAR(16) NOT NULL, expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_inv_target(target_user_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sys_audit (
 id VARCHAR(36) PRIMARY KEY, actor_user_id VARCHAR(36) NOT NULL, action VARCHAR(80) NOT NULL, target_id VARCHAR(64) NOT NULL, merchant_id VARCHAR(36),
 detail VARCHAR(1000) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_audit_merchant(merchant_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mer_application (
 application_id VARCHAR(64) PRIMARY KEY, applicant_user_id VARCHAR(64) NOT NULL, request_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, merchant_name VARCHAR(100) NOT NULL,
 category VARCHAR(50), contact_name VARCHAR(50), contact_phone VARCHAR(30), store_name VARCHAR(100), campus_location VARCHAR(200),
 status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED', reviewer_user_id VARCHAR(64), rejection_reason VARCHAR(500), opened_merchant_id VARCHAR(36),
 version INT NOT NULL DEFAULT 0, create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_app_request(applicant_user_id,request_key), KEY ix_app_status(status,create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mer_merchant (
 id VARCHAR(36) PRIMARY KEY, source_application_id VARCHAR(64) NOT NULL, name VARCHAR(100) NOT NULL, category VARCHAR(50) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', version BIGINT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_merchant_application(source_application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mer_store (
 id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, location VARCHAR(200) NOT NULL,
 UNIQUE KEY uk_store_merchant(merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS cat_category (
 code VARCHAR(32) PRIMARY KEY, name VARCHAR(50) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS cat_product (
 id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, title VARCHAR(100) NOT NULL,
 description TEXT NOT NULL, image_url VARCHAR(255) NOT NULL, category_code VARCHAR(32) NOT NULL, status VARCHAR(20) NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_product_merchant(merchant_id,status), KEY ix_product_category(category_code,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS cat_sku (
 id VARCHAR(36) PRIMARY KEY, product_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL,
 spec_key VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, price_cent BIGINT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', version BIGINT NOT NULL DEFAULT 0,
 UNIQUE KEY uk_sku_spec(product_id,spec_key), CONSTRAINT ck_sku_price CHECK (price_cent > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inv_stock_balance (
 merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, on_hand BIGINT NOT NULL DEFAULT 0,
 reserved BIGINT NOT NULL DEFAULT 0, version BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(store_id,sku_id), KEY ix_stock_merchant(merchant_id),
 CONSTRAINT ck_stock_balance CHECK (on_hand >= reserved AND reserved >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inv_reservation (
 order_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, quantity INT NOT NULL,
 status VARCHAR(16) NOT NULL, PRIMARY KEY(order_id,sku_id), CONSTRAINT ck_reservation_qty CHECK (quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inv_stock_movement (
 id VARCHAR(36) PRIMARY KEY, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL,
 type VARCHAR(16) NOT NULL, quantity INT NOT NULL, biz_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_stock_movement(store_id,sku_id,type,biz_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS trd_cart_item (
 user_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, quantity INT NOT NULL,
 version BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(user_id,sku_id), CONSTRAINT ck_cart_quantity CHECK(quantity BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS trd_checkout_request (
 user_id VARCHAR(36) NOT NULL, request_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, fingerprint CHAR(64) NOT NULL, order_id VARCHAR(36), PRIMARY KEY(user_id,request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS trd_order (
 id VARCHAR(36) PRIMARY KEY, buyer_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL,
 total_cent BIGINT NOT NULL, status VARCHAR(24) NOT NULL, deadline DATETIME(3) NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_order_buyer(buyer_id,created_at), KEY ix_order_merchant(merchant_id,status), KEY ix_order_expiry(status,deadline), CONSTRAINT ck_order_total CHECK(total_cent>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS trd_order_item (
 order_id VARCHAR(36) NOT NULL, sku_id VARCHAR(36) NOT NULL, title VARCHAR(100) NOT NULL, spec_key VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 image_url VARCHAR(255) NOT NULL DEFAULT '', unit_price_cent BIGINT NOT NULL, quantity INT NOT NULL, PRIMARY KEY(order_id,sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS trd_payment (
 order_id VARCHAR(36) PRIMARY KEY, amount_cent BIGINT NOT NULL, status VARCHAR(16) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS trd_after_sale (
 id VARCHAR(36) PRIMARY KEY, order_id VARCHAR(36) NOT NULL, buyer_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL,
 status VARCHAR(16) NOT NULL, reason VARCHAR(500) NOT NULL, decision_reason VARCHAR(500) NOT NULL DEFAULT '', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_after_order(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS trd_refund (
 order_id VARCHAR(36) PRIMARY KEY, amount_cent BIGINT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ful_pickup_task (
 id VARCHAR(36) PRIMARY KEY, order_id VARCHAR(36) NOT NULL, merchant_id VARCHAR(36) NOT NULL, store_id VARCHAR(36) NOT NULL,
 buyer_id VARCHAR(36) NOT NULL, status VARCHAR(16) NOT NULL, credential_hash CHAR(64), expires_at DATETIME(3), UNIQUE KEY uk_pickup_order(order_id), KEY ix_pickup_merchant(merchant_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ful_pickup_verification (
 id VARCHAR(36) PRIMARY KEY, pickup_id VARCHAR(36) NOT NULL, operator_user_id VARCHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_pickup_verified(pickup_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
 id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, merchant_id VARCHAR(36), visibility VARCHAR(32) NOT NULL, created_by VARCHAR(36) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_document_root (
 id VARCHAR(36) PRIMARY KEY, base_id VARCHAR(36) NOT NULL, active_document_id VARCHAR(36), version_counter INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_document (
 id VARCHAR(36) PRIMARY KEY, root_id VARCHAR(36) NOT NULL, base_id VARCHAR(36) NOT NULL, version INT NOT NULL, title VARCHAR(120) NOT NULL,
 status VARCHAR(20) NOT NULL, index_status VARCHAR(20) NOT NULL, content LONGTEXT NOT NULL, error VARCHAR(500) NOT NULL DEFAULT '',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uk_doc_version(root_id,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_conversation (
 id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, title VARCHAR(100) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_conversation_owner(user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_message (
 seq_no BIGINT NOT NULL AUTO_INCREMENT UNIQUE,
 id VARCHAR(36) PRIMARY KEY, conversation_id VARCHAR(36) NOT NULL, role VARCHAR(16) NOT NULL, content TEXT NOT NULL, access_fingerprint CHAR(64),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY ix_message_conversation(conversation_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ai_proposal (
 id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, conversation_id VARCHAR(36) NOT NULL, status VARCHAR(16) NOT NULL,
 items_json TEXT NOT NULL, selection_hash CHAR(64), expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sys_schema_version (
 version INT PRIMARY KEY, installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS trd_cart_owner (user_id VARCHAR(36) PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- RBAC 商户自定义角色，只能由 Owner 创建；内置 OWNER/CLERK 由领域白名单计算。
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
