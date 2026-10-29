package cn.bugstack.ai.domain.catalog.model.aggregate;

import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductStatusEnumVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.util.ArrayList;
import java.util.List;

import static cn.bugstack.ai.types.common.Checks.*;

/** 商品聚合：控制 SKU 规格唯一、报价以及发布状态；库存仍归 Inventory 领域所有。 */
public final class ProductAggregate {
    private final String id;
    private final String merchantId;
    private final String storeId;
    private String title;
    private String description;
    private String categoryCode;
    private String imageUrl;
    private ProductStatusEnumVO status;
    private final long version;
    private final List<ProductSkuEntity> skus;

    public ProductAggregate(String id, String merchantId, String storeId, String title,
                            String description, String categoryCode, String imageUrl,
                            String status, long version, List<ProductSkuEntity> skus) {
        this.id = text(id, "商品ID", 36);
        this.merchantId = text(merchantId, "商户ID", 36);
        this.storeId = text(storeId, "门店ID", 36);
        this.title = text(title, "商品名称", 100);
        this.description = optional(description, 5000);
        this.categoryCode = text(categoryCode, "类别", 32);
        this.imageUrl = optional(imageUrl, 255);
        require(this.imageUrl.isEmpty() || this.imageUrl.matches("/media/[a-f0-9-]+\\.png"),
                ResponseCode.ILLEGAL_PARAMETER);
        require(version >= 0, ResponseCode.STATE_CONFLICT);
        this.status = ProductStatusEnumVO.fromCode(status);
        this.version = version;
        this.skus = new ArrayList<>();
        if (skus != null) {
            for (ProductSkuEntity sku : skus) {
                addSku(sku);
            }
        }
    }

    public void requireOwner(String merchant) {
        require(merchantId.equals(merchant), ResponseCode.AUTH_FORBIDDEN);
    }

    public void addSku(ProductSkuEntity sku) {
        require(sku != null && skus.size() < 20, ResponseCode.ILLEGAL_PARAMETER);
        validatePrice(sku.priceCent());
        String key = text(sku.specKey(), "规格", 100);
        require(skus.stream().noneMatch(s -> s.specKey().equals(key)), ResponseCode.SKU_DUPLICATE);
        skus.add(new ProductSkuEntity(sku.id(), key, sku.priceCent(), sku.status(), sku.version()));
    }

    public void changePrice(String skuId, long price, long expectedVersion) {
        require(version == expectedVersion, ResponseCode.STATE_CONFLICT);
        validatePrice(price);
        for (int i = 0; i < skus.size(); i++) {
            ProductSkuEntity sku = skus.get(i);
            if (sku.id().equals(skuId)) {
                skus.set(i, new ProductSkuEntity(sku.id(), sku.specKey(), price,
                        sku.status(), sku.version() + 1));
                return;
            }
        }
        throw new AppException(ResponseCode.NOT_FOUND);
    }

    public void changeInfo(String title, String desc, String category, String image, long expected) {
        require(expected == version, ResponseCode.STATE_CONFLICT);
        this.title = text(title, "商品名称", 100);
        this.description = optional(desc, 5000);
        this.categoryCode = text(category, "类别", 32);
        String value = optional(image, 255);
        require(value.isEmpty() || value.matches("/media/[a-f0-9-]+\\.png"),
                ResponseCode.ILLEGAL_PARAMETER);
        this.imageUrl = value;
    }

    /** 只有存在至少一个有效 SKU 才能发布，避免产生不可购买的上架商品。 */
    public void publish() {
        require(skus.stream().anyMatch(s -> s.statusEnum() == SkuStatusEnumVO.ACTIVE),
                ResponseCode.PRODUCT_UNAVAILABLE);
        status = ProductStatusEnumVO.PUBLISHED;
    }

    public void unpublish() { status = ProductStatusEnumVO.UNPUBLISHED; }

    public static void validatePrice(long price) {
        require(price > 0 && price <= 100000000L, ResponseCode.ILLEGAL_PARAMETER);
    }

    public String getId() { return id; }
    public String getMerchantId() { return merchantId; }
    public String getStoreId() { return storeId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getCategoryCode() { return categoryCode; }
    public String getImageUrl() { return imageUrl; }
    public ProductStatusEnumVO getStatusEnum() { return status; }
    public String getStatus() { return status.name(); }
    public long getVersion() { return version; }
    public List<ProductSkuEntity> getSkus() { return List.copyOf(skus); }
}
