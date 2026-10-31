package cn.bugstack.ai.api.dto;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 注册成功仅返回用户 ID，不返回密码摘要或权限。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterResponseDTO implements Serializable {

  private static final long serialVersionUID = 1L;
  private String userId;
}
