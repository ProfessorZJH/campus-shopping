package cn.bugstack.ai.domain.identity.model.valobj;

import java.time.*;
import java.util.*;

/** 邀请只允许目标用户在有效期内接受。 */
public record InvitationVO(
  String id,
  String merchantId,
  String targetUserId,
  String status,
  Instant expiresAt
) {
  public InvitationVO {
    InvitationStatusEnumVO.fromCode(status);
  }

  public InvitationStatusEnumVO state() {
    return InvitationStatusEnumVO.fromCode(status);
  }
}
