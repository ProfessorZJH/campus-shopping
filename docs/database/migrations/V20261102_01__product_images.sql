-- 商品多图第一阶段：对象引用与主图回填。仅回填现有 /media/ 主图，不改订单快照。
SET @has_image_table := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='cat_product_image');
SET @create_image_table := IF(@has_image_table=0,
 'CREATE TABLE cat_product_image (image_id VARCHAR(36) PRIMARY KEY, product_id VARCHAR(36) NOT NULL, provider VARCHAR(32) NOT NULL, object_key VARCHAR(512) NOT NULL, url VARCHAR(255) NOT NULL, sort_order TINYINT UNSIGNED NOT NULL, UNIQUE KEY uk_product_image_order(product_id,sort_order), UNIQUE KEY uk_product_image_object(product_id,object_key), KEY ix_product_image_product(product_id,sort_order), CONSTRAINT ck_product_image_order CHECK (sort_order BETWEEN 0 AND 7)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci', 'SELECT 1');
PREPARE create_image_table FROM @create_image_table; EXECUTE create_image_table; DEALLOCATE PREPARE create_image_table;
INSERT INTO cat_product_image(image_id,product_id,provider,object_key,url,sort_order)
SELECT UUID(),p.id,'LOCAL',SUBSTRING(p.image_url,8),p.image_url,0 FROM cat_product p
LEFT JOIN cat_product_image i ON i.product_id=p.id WHERE p.image_url<>'' AND i.product_id IS NULL;
