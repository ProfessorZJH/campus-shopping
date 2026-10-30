package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 具名店员邀请。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationResponseDTO {

    private String id;
    private String merchantId;
    private String targetUserId;
    private String status;
    private Instant expiresAt;
}
