-- 商品图片上传对象归属：上传凭证只允许由所属商户绑定到自己的商品。
-- 迁移不复制或删除文件；历史图片按“对象 + 商户”登记，同一对象被多个商品引用时不丢弃归属行。
-- 历史行不写 product_id：首次编辑保存时由该商品认领，已引用该对象的商品仍可继续保存。
CREATE TABLE IF NOT EXISTS cat_product_image_upload (
    object_key VARCHAR(512) NOT NULL,
    merchant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (object_key,merchant_id),
    KEY ix_product_image_upload_merchant(merchant_id,product_id),
    KEY ix_product_image_upload_product(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO cat_product_image_upload(object_key,merchant_id)
SELECT i.object_key,p.merchant_id
FROM cat_product_image i JOIN cat_product p ON p.id=i.product_id;
