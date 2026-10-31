package cn.bugstack.ai.domain.catalog.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 商品全局排序方式；code 保持已有数据库和 HTTP 协议值。 */
public enum ProductSortEnumVO {
  NEWEST("最新"),
  PRICE_ASC("价格升序"),
  STOCK_DESC("库存降序");

  private final String info;

  ProductSortEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static ProductSortEnumVO fromCode(String code) {
    return EnumValues.stored(ProductSortEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(ProductSortEnumVO.class, code);
  }
}
