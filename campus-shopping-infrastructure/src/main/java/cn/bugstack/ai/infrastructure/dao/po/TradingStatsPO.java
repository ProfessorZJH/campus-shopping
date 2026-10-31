package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 同一交易领域内的统计只读投影。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradingStatsPO {

  private Long totalOrders;
  private Long pendingCount;
  private Long paidCount;
  private Long completedCount;
  private Long refundedCount;
  private Long completedAmountCent;
}
