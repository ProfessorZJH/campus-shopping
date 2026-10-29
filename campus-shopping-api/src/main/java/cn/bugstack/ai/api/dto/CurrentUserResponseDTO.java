package cn.bugstack.ai.api.dto;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 当前用户基本信息，不返回密码、摘要或会话标识。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CurrentUserResponseDTO implements Serializable {

    private static final long serialVersionUID = 1L;
    private String userId;
    private String username;
    private String displayName;
    private String status;
}
