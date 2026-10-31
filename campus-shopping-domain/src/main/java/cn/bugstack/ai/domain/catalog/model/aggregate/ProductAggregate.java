package cn.bugstack.ai.domain.catalog.model.aggregate;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductStatusEnumVO;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.*;

/** 商品聚合统一约束规格唯一、售价和发布状态；历史 SKU 不物理删除。 */
public final class ProductAggregate {

  private final String id, merchantId, storeId;
  private String title, description, categoryCode, imageUrl;
  private ProductStatusEnumVO status;
  private final long version;
  private final List<ProductSkuEntity> skus;

  public ProductAggregate(
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
    this.id = text(id, "商品ID", 36);
    this.merchantId = text(merchantId, "商户ID", 36);
    this.storeId = text(storeId, "门店ID", 36);
    this.title = text(title, "商品名称", 100);
    this.description = optional(description, 5000);
    this.categoryCode = text(categoryCode, "类别", 32);
    this.imageUrl = optional(imageUrl, 255);
    require(
      this.imageUrl.isEmpty() || this.imageUrl.matches("/media/[a-f0-9-]+\\.png"),
      ResponseCode.ILLEGAL_PARAMETER
    );
    require(version >= 0, ResponseCode.STATE_CONFLICT);
    this.status = ProductStatusEnumVO.fromCode(status);
    this.version = version;
    this.skus = new ArrayList<>();
    if (skus != null) for (ProductSkuEntity sku : skus) addSku(sku);
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
      ProductSkuEntity s = skus.get(i);
      if (s.id().equals(skuId)) {
        skus.set(i, new ProductSkuEntity(s.id(), s.specKey(), price, s.status(), s.version() + 1));
        return;
      }
    }
    throw new cn.bugstack.ai.types.exception.AppException(ResponseCode.NOT_FOUND);
  }

  public void changeInfo(String title, String desc, String category, String image, long expected) {
    require(expected == version, ResponseCode.STATE_CONFLICT);
    this.title = text(title, "商品名称", 100);
    this.description = optional(desc, 5000);
    this.categoryCode = text(category, "类别", 32);
    String v = optional(image, 255);
    require(v.isEmpty() || v.matches("/media/[a-f0-9-]+\\.png"), ResponseCode.ILLEGAL_PARAMETER);
    this.imageUrl = v;
  }

  public void publish() {
    require(
      skus.stream().anyMatch(s -> s.state() == SkuStatusEnumVO.ACTIVE),
      ResponseCode.PRODUCT_UNAVAILABLE
    );
    status = ProductStatusEnumVO.PUBLISHED;
  }

  public void unpublish() {
    status = ProductStatusEnumVO.UNPUBLISHED;
  }

  public static void validatePrice(long p) {
    require(p > 0 && p <= 100000000L, ResponseCode.ILLEGAL_PARAMETER);
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
    return status.getCode();
  }

  public ProductStatusEnumVO state() {
    return status;
  }

  public long getVersion() {
    return version;
  }

  public List<ProductSkuEntity> getSkus() {
    return List.copyOf(skus);
  }
}
