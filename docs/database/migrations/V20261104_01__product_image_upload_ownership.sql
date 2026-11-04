-- 商品图片上传对象归属：上传凭证只允许由所属商户绑定到自己的商品。
-- 迁移不复制或删除文件；历史图片只登记已有商品归属。
CREATE TABLE IF NOT EXISTS cat_product_image_upload (
    object_key VARCHAR(512) PRIMARY KEY,
    merchant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY ix_product_image_upload_merchant(merchant_id,product_id),
    KEY ix_product_image_upload_product(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO cat_product_image_upload(object_key,merchant_id,product_id)
SELECT i.object_key,p.merchant_id,p.id
FROM cat_product_image i JOIN cat_product p ON p.id=i.product_id;
