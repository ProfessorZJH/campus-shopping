package cn.bugstack.ai.domain.catalog.model.valobj;
import java.util.*;
import java.time.*;
/** 可售报价快照，不含可变的库存真值。 */
public record SkuOfferVO(String skuId, String productId, String merchantId, String storeId, String title, String specKey, long priceCent, long version, String productStatus, String skuStatus, String imageUrl, String description) {}
