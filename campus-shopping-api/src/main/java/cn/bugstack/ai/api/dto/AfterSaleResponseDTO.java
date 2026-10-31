package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 退款/争议的用户可见状态。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AfterSaleResponseDTO {

  private String id;
  private String orderId;
  private String merchantId;
  private String status;
  private String reason;
  private String decisionReason;
  private Instant createdAt;
}
