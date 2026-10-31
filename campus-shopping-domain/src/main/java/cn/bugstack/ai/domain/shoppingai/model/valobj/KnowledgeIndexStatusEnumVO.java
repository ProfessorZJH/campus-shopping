package cn.bugstack.ai.domain.shoppingai.model.valobj;

import cn.bugstack.ai.types.common.EnumValues;

/** 知识版本索引状态；code 保持已有数据库和 HTTP 协议值。 */
public enum KnowledgeIndexStatusEnumVO {
  PENDING("待索引"),
  READY("已就绪"),
  FAILED("失败");

  private final String info;

  KnowledgeIndexStatusEnumVO(String info) {
    this.info = info;
  }

  public String getCode() {
    return name();
  }

  public String getInfo() {
    return info;
  }

  public static KnowledgeIndexStatusEnumVO fromCode(String code) {
    return EnumValues.stored(KnowledgeIndexStatusEnumVO.class, code);
  }

  public static String filter(String code) {
    return EnumValues.filter(KnowledgeIndexStatusEnumVO.class, code);
  }
}
