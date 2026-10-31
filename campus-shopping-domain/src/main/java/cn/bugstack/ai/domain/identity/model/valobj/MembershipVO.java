package cn.bugstack.ai.domain.identity.model.valobj;

import java.time.*;
import java.util.*;

/** 商户范围内的成员关系；平台权限与成员身份分离。 */
public record MembershipVO(String merchantId, String userId, String role, String status) {
  public MembershipVO {
    MembershipStatusEnumVO.fromCode(status);
  }

  public MembershipStatusEnumVO state() {
    return MembershipStatusEnumVO.fromCode(status);
  }
}
