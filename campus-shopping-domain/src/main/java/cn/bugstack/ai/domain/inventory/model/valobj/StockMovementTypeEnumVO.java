package cn.bugstack.ai.domain.inventory.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 库存流水业务类型；code 保持已有数据库和 HTTP 协议值。 */
public enum StockMovementTypeEnumVO {
  REPLENISH("补货"),
  RESERVE("预占"),
  RELEASE("释放"),
  CONSUME("核销消耗");

  private final String info;

  StockMovementTypeEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static StockMovementTypeEnumVO fromCode(String code) {
    return EnumValues.stored(StockMovementTypeEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(StockMovementTypeEnumVO.class, code);
  }
}
