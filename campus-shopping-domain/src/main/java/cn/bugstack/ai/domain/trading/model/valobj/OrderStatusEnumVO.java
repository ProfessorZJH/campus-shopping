package cn.bugstack.ai.domain.trading.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 订单生命周期；code 保持已有数据库和 HTTP 协议值。 */
public enum OrderStatusEnumVO {
  PENDING_PAYMENT("待付款"),
  PAID("已支付"),
  COMPLETED("已完成"),
  CANCELED("已取消"),
  REFUNDED("已退款");

  private final String info;

  OrderStatusEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static OrderStatusEnumVO fromCode(String code) {
    return EnumValues.stored(OrderStatusEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(OrderStatusEnumVO.class, code);
  }
}
