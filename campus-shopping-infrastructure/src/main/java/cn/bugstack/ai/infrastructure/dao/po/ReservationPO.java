package cn.bugstack.ai.infrastructure.dao.po;

import java.time.*;
import java.util.*;
import lombok.*;

/** 订单库存预占记录。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationPO {

    private String orderId;
    private String storeId;
    private String skuId;
    private Integer quantity;
    private String status;
}
