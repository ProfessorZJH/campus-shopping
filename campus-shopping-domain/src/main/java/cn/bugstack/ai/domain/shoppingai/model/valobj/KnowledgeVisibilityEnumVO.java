package cn.bugstack.ai.domain.shoppingai.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 知识访问范围；code 保持已有数据库和 HTTP 协议值。 */
public enum KnowledgeVisibilityEnumVO {
  PUBLIC("公开"),
  MERCHANT_INTERNAL("商户内部"),
  PLATFORM_INTERNAL("平台内部");

  private final String info;

  KnowledgeVisibilityEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static KnowledgeVisibilityEnumVO fromCode(String code) {
    return EnumValues.stored(KnowledgeVisibilityEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(KnowledgeVisibilityEnumVO.class, code);
  }
}
