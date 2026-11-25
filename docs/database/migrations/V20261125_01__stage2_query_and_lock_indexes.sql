-- 补齐知识索引并发锁、商户订单、平台售后与公开商户分页索引。
SET @kb_merchant_idx_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_knowledge_base' AND INDEX_NAME='ix_knowledge_base_merchant'
);
SET @kb_merchant_idx_sql := IF(
    @kb_merchant_idx_exists=0,
    'ALTER TABLE ai_knowledge_base ADD KEY ix_knowledge_base_merchant(merchant_id)',
    'SELECT 1 AS already_applied'
);
PREPARE kb_merchant_idx_stmt FROM @kb_merchant_idx_sql;
EXECUTE kb_merchant_idx_stmt;
DEALLOCATE PREPARE kb_merchant_idx_stmt;

SET @doc_lease_idx_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ai_document' AND INDEX_NAME='ix_document_base_index_lease'
);
SET @doc_lease_idx_sql := IF(
    @doc_lease_idx_exists=0,
    'ALTER TABLE ai_document ADD KEY ix_document_base_index_lease(base_id,index_expires_at,id)',
    'SELECT 1 AS already_applied'
);
PREPARE doc_lease_idx_stmt FROM @doc_lease_idx_sql;
EXECUTE doc_lease_idx_stmt;
DEALLOCATE PREPARE doc_lease_idx_stmt;

SET @order_merchant_created_idx_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_order' AND INDEX_NAME='ix_order_merchant_created'
);
SET @order_merchant_created_idx_sql := IF(
    @order_merchant_created_idx_exists=0,
    'ALTER TABLE trd_order ADD KEY ix_order_merchant_created(merchant_id,created_at DESC,id)',
    'SELECT 1 AS already_applied'
);
PREPARE order_merchant_created_idx_stmt FROM @order_merchant_created_idx_sql;
EXECUTE order_merchant_created_idx_stmt;
DEALLOCATE PREPARE order_merchant_created_idx_stmt;

SET @after_sale_status_idx_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trd_after_sale' AND INDEX_NAME='ix_after_sale_status_created'
);
SET @after_sale_status_idx_sql := IF(
    @after_sale_status_idx_exists=0,
    'ALTER TABLE trd_after_sale ADD KEY ix_after_sale_status_created(status,created_at DESC,id)',
    'SELECT 1 AS already_applied'
);
PREPARE after_sale_status_idx_stmt FROM @after_sale_status_idx_sql;
EXECUTE after_sale_status_idx_stmt;
DEALLOCATE PREPARE after_sale_status_idx_stmt;

SET @merchant_status_idx_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mer_merchant' AND INDEX_NAME='ix_merchant_status_created'
);
SET @merchant_status_idx_sql := IF(
    @merchant_status_idx_exists=0,
    'ALTER TABLE mer_merchant ADD KEY ix_merchant_status_created(status,created_at DESC,id)',
    'SELECT 1 AS already_applied'
);
PREPARE merchant_status_idx_stmt FROM @merchant_status_idx_sql;
EXECUTE merchant_status_idx_stmt;
DEALLOCATE PREPARE merchant_status_idx_stmt;
