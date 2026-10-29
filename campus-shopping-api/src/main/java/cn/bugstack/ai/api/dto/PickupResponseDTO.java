package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 自提状态，不返回凭证摘要或未经请求的令牌。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PickupResponseDTO {
    private String status;
    private Instant expiresAt;
}
