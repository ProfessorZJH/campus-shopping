package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 当前数据库成员授权事实。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MembershipResponseDTO {

  private String merchantId;
  private String userId;
  private String role;
  private String status;
}
