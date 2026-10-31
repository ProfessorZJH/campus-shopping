package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 会话消息角色；code 保持已有数据库和 HTTP 协议值。 */
public enum MessageRoleEnumVO {
  USER("user", "用户"),
  ASSISTANT("assistant", "助手");

  private final String code;
  private final String info;

  MessageRoleEnumVO(String code, String info) {
    this.code = code;
    this.info = info;
  }

  public String getCode() {
    return code;
  }

  public String getInfo() {
    return info;
  }

  public static MessageRoleEnumVO fromCode(String code) {
    for (var value : values()) if (value.code.equals(code)) return value;
    throw new IllegalStateException("无效的消息角色");
  }
}
