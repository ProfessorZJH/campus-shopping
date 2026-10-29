package cn.bugstack.ai.domain.catalog.model.entity;
import java.util.*;
import java.time.*;
/** 创建商品的领域命令，SKU ID 由服务端分配。 */
public record ProductCreateEntity(String title, String description, String categoryCode, String imageUrl, List<ProductSkuEntity> skus) {}
