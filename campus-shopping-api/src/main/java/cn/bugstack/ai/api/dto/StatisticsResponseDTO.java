package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 模拟经营统计，不代表真实资金结算。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class StatisticsResponseDTO {
    private Long totalOrders;
    private Long pendingCount;
    private Long paidCount;
    private Long completedCount;
    private Long refundedCount;
    private Long completedAmountCent;
}
