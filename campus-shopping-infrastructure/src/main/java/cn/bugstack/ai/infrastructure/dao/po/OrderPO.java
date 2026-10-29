package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 订单主表记录。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
