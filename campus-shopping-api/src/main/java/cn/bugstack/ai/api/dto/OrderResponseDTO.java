package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 订单详情读模型。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponseDTO {

    private String orderId;
    private String buyerId;
    private String merchantId;
    private String merchantName;
    private String storeId;
    private String status;
    private Long totalCent;
    private Instant deadline;
    private Instant createdAt;
    private List<OrderItemResponseDTO> items;
    private PickupResponseDTO pickup;
    private AfterSaleResponseDTO afterSale;
}
