package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 仅映射成员表。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MembershipPO {

  private String merchantId;
  private String userId;
  private String role;
  private String status;
}
