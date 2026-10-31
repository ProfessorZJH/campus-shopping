package cn.bugstack.ai.domain.catalog.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 规格销售状态；code 保持已有数据库和 HTTP 协议值。 */
public enum SkuStatusEnumVO {
  ACTIVE("可售"),
  INACTIVE("停用");

  private final String info;

  SkuStatusEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static SkuStatusEnumVO fromCode(String code) {
    return EnumValues.stored(SkuStatusEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(SkuStatusEnumVO.class, code);
  }
}
