package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 邀请持久化投影。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InvitationPO {
    private String id;
    private String merchantId;
    private String targetUserId;
    private String status;
    private Instant expiresAt;
}
