package cn.bugstack.ai.domain.catalog.model.entity;

import java.time.*;
import java.util.*;

/** 创建商品的领域命令，SKU ID 由服务端分配。 */
public record ProductCreateCommandEntity(
    String title,
    String description,
    String categoryCode,
    String imageUrl,
    List<ProductSkuEntity> skus,
    List<String> imageUrls
) {
    public ProductCreateCommandEntity(String title, String description, String categoryCode, String imageUrl, List<ProductSkuEntity> skus) {
        this(title, description, categoryCode, imageUrl, skus, imageUrl == null || imageUrl.isBlank() ? List.of() : List.of(imageUrl));
    }
}
