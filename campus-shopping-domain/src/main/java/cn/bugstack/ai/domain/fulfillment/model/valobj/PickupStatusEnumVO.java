package cn.bugstack.ai.domain.fulfillment.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 自提任务生命周期；code 保持已有数据库和 HTTP 协议值。 */
public enum PickupStatusEnumVO {
  WAIT_PREP("待备货"),
  PREPARING("备货中"),
  READY("待自提"),
  COMPLETED("已核销"),
  CANCELED("已取消");

  private final String info;

  PickupStatusEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static PickupStatusEnumVO fromCode(String code) {
    return EnumValues.stored(PickupStatusEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(PickupStatusEnumVO.class, code);
  }
}
