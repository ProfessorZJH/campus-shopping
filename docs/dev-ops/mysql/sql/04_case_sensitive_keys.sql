-- 对已有 R1 数据库执行；先备份。字段变化可能需要锁表，请安排维护窗口。
USE campus_shopping;
ALTER TABLE mer_application MODIFY request_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
ALTER TABLE trd_checkout_request MODIFY request_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
ALTER TABLE inv_stock_movement MODIFY biz_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
ALTER TABLE cat_sku MODIFY spec_key VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
