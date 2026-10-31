package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 邀请持久化投影。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationPO {

  private String id;
  private String merchantId;
  private String targetUserId;
  private String status;
  private Instant expiresAt;
}
