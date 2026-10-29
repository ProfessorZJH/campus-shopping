package cn.bugstack.ai.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import java.io.Serializable;

/** 用户注册请求；密码只在本次请求中使用，不允许输出到日志。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequestDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    private String username;
    @ToString.Exclude // Lombok @Data 自动生成 toString，不能泄露密码。
    private String password;
    private String displayName;
}
