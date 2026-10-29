-- 契约专项审查 2026-10-29：仅增加查询索引和金额/数量约束，不修改业务行。
-- 先备份，在维护窗口执行；要求 MySQL >= 8.0.16，前置 20261028_01/02 已应用。
-- DDL 隐式提交，不具有整批事务性。中断后可重跑；禁止使用 mysql --force 掩盖错误。
-- 约束前置检查见同目录 README.md；脏数据必须人工核对，ADD CHECK 会失败关闭。

-- iam_merchant_membership.ix_member_role
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='iam_merchant_membership' AND INDEX_NAME='ix_member_role');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE iam_merchant_membership ADD INDEX ix_member_role (merchant_id,role,status)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- mer_application.ix_app_applicant
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mer_application' AND INDEX_NAME='ix_app_applicant');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE mer_application ADD INDEX ix_app_applicant (applicant_user_id,create_time DESC,application_id)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- inv_stock_balance.ix_stock_sku
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inv_stock_balance' AND INDEX_NAME='ix_stock_sku');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE inv_stock_balance ADD INDEX ix_stock_sku (sku_id)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- inv_stock_movement.ix_movement_merchant
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inv_stock_movement' AND INDEX_NAME='ix_movement_merchant');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE inv_stock_movement ADD INDEX ix_movement_merchant (merchant_id,created_at DESC,id)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- ai_document.ix_document_base
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_document' AND INDEX_NAME='ix_document_base');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE ai_document ADD INDEX ix_document_base (base_id,created_at DESC,id)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- ai_message.ix_message_sequence
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_message' AND INDEX_NAME='ix_message_sequence');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE ai_message ADD INDEX ix_message_sequence (conversation_id,seq_no)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- ai_proposal.ix_proposal_conversation
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_proposal' AND INDEX_NAME='ix_proposal_conversation');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE ai_proposal ADD INDEX ix_proposal_conversation (user_id,conversation_id,created_at DESC,id)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- trd_order_item.ck_order_item_values：已有非法行时终止，不自动修复/删除历史记录。
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='trd_order_item' AND CONSTRAINT_NAME='ck_order_item_values' AND CONSTRAINT_TYPE='CHECK');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE trd_order_item ADD CONSTRAINT ck_order_item_values CHECK (unit_price_cent > 0 AND quantity BETWEEN 1 AND 99)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- trd_payment.ck_payment_amount：已有非法行时终止，不自动修复/删除历史记录。
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='trd_payment' AND CONSTRAINT_NAME='ck_payment_amount' AND CONSTRAINT_TYPE='CHECK');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE trd_payment ADD CONSTRAINT ck_payment_amount CHECK (amount_cent > 0)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;

-- trd_refund.ck_refund_amount：已有非法行时终止，不自动修复/删除历史记录。
SET @audit_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='trd_refund' AND CONSTRAINT_NAME='ck_refund_amount' AND CONSTRAINT_TYPE='CHECK');
SET @audit_ddl := IF(@audit_exists=0,
 'ALTER TABLE trd_refund ADD CONSTRAINT ck_refund_amount CHECK (amount_cent > 0)', 'SELECT 1 AS already_applied');
PREPARE audit_stmt FROM @audit_ddl;
EXECUTE audit_stmt;
DEALLOCATE PREPARE audit_stmt;
