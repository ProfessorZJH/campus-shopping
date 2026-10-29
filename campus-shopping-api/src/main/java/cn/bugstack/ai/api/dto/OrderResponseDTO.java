package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 订单详情读模型。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
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
