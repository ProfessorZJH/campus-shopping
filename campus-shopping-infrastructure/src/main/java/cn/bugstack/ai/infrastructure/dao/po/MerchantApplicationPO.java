package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 入驻申请持久化对象，完整资料与审核事实一并保存。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MerchantApplicationPO {

  private String applicationId;
  private String applicantUserId;
  private String requestKey;
  private String merchantName;
  private String category;
  private String contactName;
  private String contactPhone;
  private String storeName;
  private String campusLocation;
  private String status;
  private String reviewerUserId;
  private String rejectionReason;
  private String openedMerchantId;
  private Long version;
  private Instant createTime;
  private Instant updateTime;
}
