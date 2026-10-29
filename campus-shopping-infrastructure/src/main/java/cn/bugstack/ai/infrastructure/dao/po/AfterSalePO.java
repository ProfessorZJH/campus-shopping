package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 未提货全额模拟退款申请。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AfterSalePO {
    private String id;
    private String orderId;
    private String buyerId;
    private String merchantId;
    private String status;
    private String reason;
    private String decisionReason;
    private Instant createdAt;
}
