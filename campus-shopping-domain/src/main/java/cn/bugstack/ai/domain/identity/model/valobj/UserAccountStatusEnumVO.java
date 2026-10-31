package cn.bugstack.ai.domain.identity.model.valobj;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** 账号状态值对象；不把业务状态当作错误码。 */
@Getter
@AllArgsConstructor
public enum UserAccountStatusEnumVO {
  ACTIVE("ACTIVE", "正常"),
  DISABLED("DISABLED", "停用");

  private final String code;
  private final String info;
}
