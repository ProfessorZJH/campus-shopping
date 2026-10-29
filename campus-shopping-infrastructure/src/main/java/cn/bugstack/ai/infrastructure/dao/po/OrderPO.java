package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 订单主表记录。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrderPO {
    private String id;
    private String buyerId;
    private String merchantId;
    private String storeId;
    private Long totalCent;
    private String status;
    private Instant deadline;
    private Long version;
    private Instant createdAt;
}
