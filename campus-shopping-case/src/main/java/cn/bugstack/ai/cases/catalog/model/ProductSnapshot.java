package cn.bugstack.ai.cases.catalog.model;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductStatusEnumVO;
import java.util.List;
import java.util.Objects;

/** 商品对外展示快照；不持有可变商品聚合或领域服务。 */
public record ProductSnapshot(
    String id,
    String merchantId,
    String storeId,
    String title,
    String description,
    String categoryCode,
    String imageUrl,
    String status,
    long version,
    List<ProductSkuEntity> skus
) {
    public ProductSnapshot {
        Objects.requireNonNull(id);
        Objects.requireNonNull(merchantId);
        Objects.requireNonNull(storeId);
        Objects.requireNonNull(title);
        Objects.requireNonNull(description);
        Objects.requireNonNull(categoryCode);
        Objects.requireNonNull(imageUrl);
        Objects.requireNonNull(status);
        Objects.requireNonNull(skus);
        ProductStatusEnumVO.fromCode(status);
        skus = List.copyOf(skus);
    }

    public static ProductSnapshot from(ProductAggregate product) {
        Objects.requireNonNull(product);
        return new ProductSnapshot(
            product.getId(),
            product.getMerchantId(),
            product.getStoreId(),
            product.getTitle(),
            product.getDescription(),
            product.getCategoryCode(),
            product.getImageUrl(),
            product.getStatus(),
            product.getVersion(),
            product.getSkus()
        );
    }

    public String getId() {
        return id;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public String getStoreId() {
        return storeId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public String getStatus() {
        return status;
    }

    public ProductStatusEnumVO state() {
        return ProductStatusEnumVO.fromCode(status);
    }

    public long getVersion() {
        return version;
    }

    public List<ProductSkuEntity> getSkus() {
        return skus;
    }

}
