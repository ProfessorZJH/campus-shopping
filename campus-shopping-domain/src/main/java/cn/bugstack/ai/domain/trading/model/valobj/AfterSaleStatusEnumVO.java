package cn.bugstack.ai.domain.trading.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 售后申请生命周期；code 保持已有数据库和 HTTP 协议值。 */
public enum AfterSaleStatusEnumVO {
  REQUESTED("待处理"),
  REJECTED("已驳回"),
  DISPUTED("平台介入"),
  APPROVED("已同意");

  private final String info;

  AfterSaleStatusEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static AfterSaleStatusEnumVO fromCode(String code) {
    return EnumValues.stored(AfterSaleStatusEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(AfterSaleStatusEnumVO.class, code);
  }
}
