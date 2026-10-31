package cn.bugstack.ai.api.dto;

import java.io.Serializable;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/** 登录请求：不接受用户 ID 和角色，密码不得出现在日志。 */
@Data
@NoArgsConstructor
public class LoginRequestDTO implements Serializable {

  private static final long serialVersionUID = 1L;
  private String username;

  @ToString.Exclude
  private String password;
}
