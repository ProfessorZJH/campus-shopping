package cn.bugstack.ai.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

/** 防跨站请求令牌：前端在写请求中携带指定请求头。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CsrfTokenResponseDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    private String headerName;
    private String token;
}
