package cn.bugstack.ai.infrastructure.dao.po;

import java.time.Instant;
import lombok.*;

/** 订单事件查询投影。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderEventPO {

    private String id;
    private String orderId;
    private String afterSaleId;
    private String eventType;
    private Instant eventTime;
    private String actorId;
    private String actorRole;
    private String reason;
    private String dedupeKey;
}
