package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 退款/争议的用户可见状态。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AfterSaleResponseDTO {
    private String id;
    private String orderId;
    private String merchantId;
    private String status;
    private String reason;
    private String decisionReason;
    private Instant createdAt;
}
