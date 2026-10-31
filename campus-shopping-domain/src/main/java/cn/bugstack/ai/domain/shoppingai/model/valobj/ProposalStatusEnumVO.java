package cn.bugstack.ai.domain.shoppingai.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 导购提案生命周期；code 保持已有数据库和 HTTP 协议值。 */
public enum ProposalStatusEnumVO {
  PENDING("待确认"),
  CONFIRMED("已确认"),
  REJECTED("已拒绝");

  private final String info;

  ProposalStatusEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static ProposalStatusEnumVO fromCode(String code) {
    return EnumValues.stored(ProposalStatusEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(ProposalStatusEnumVO.class, code);
  }
}
