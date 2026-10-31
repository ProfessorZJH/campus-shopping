package cn.bugstack.ai.domain.shoppingai.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 知识版本发布状态；code 保持已有数据库和 HTTP 协议值。 */
public enum KnowledgeDocumentStatusEnumVO {
  DRAFT("草稿"),
  PUBLISHED("已发布"),
  WITHDRAWN("已撤回");

  private final String info;

  KnowledgeDocumentStatusEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static KnowledgeDocumentStatusEnumVO fromCode(String code) {
    return EnumValues.stored(KnowledgeDocumentStatusEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(KnowledgeDocumentStatusEnumVO.class, code);
  }
}
