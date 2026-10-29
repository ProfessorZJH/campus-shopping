package cn.bugstack.ai.domain.catalog.model.valobj;

/** 实时可售报价快照，包含商品/SKU 类型安全状态，不包含可变库存真值。 */
public record SkuOfferVO(String skuId, String productId, String merchantId, String storeId,
                         String title, String specKey, long priceCent, long version,
                         String productStatus, String skuStatus, String imageUrl, String description) {
    public SkuOfferVO {
        ProductStatusEnumVO.fromCode(productStatus);
        SkuStatusEnumVO.fromCode(skuStatus);
    }

    public ProductStatusEnumVO productStatusEnum() {
        return ProductStatusEnumVO.fromCode(productStatus);
    }

    public SkuStatusEnumVO skuStatusEnum() {
        return SkuStatusEnumVO.fromCode(skuStatus);
    }
}
