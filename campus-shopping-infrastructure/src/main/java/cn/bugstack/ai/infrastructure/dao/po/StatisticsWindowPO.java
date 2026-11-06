package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class StatisticsWindowPO { private Long totalOrders; private Long paidOrders; private Long refundedOrders; private Long completedAmountCent; }
