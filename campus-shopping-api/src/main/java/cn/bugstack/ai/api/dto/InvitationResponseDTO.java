package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 具名店员邀请。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InvitationResponseDTO {
    private String id;
    private String merchantId;
    private String targetUserId;
    private String status;
    private Instant expiresAt;
}
