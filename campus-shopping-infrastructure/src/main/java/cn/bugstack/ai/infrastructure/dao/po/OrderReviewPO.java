package cn.bugstack.ai.infrastructure.dao.po;

import java.time.Instant;
import lombok.*;

/** 订单商品评价记录。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderReviewPO {

    private String id;
    private String orderId;
    private String productId;
    private String merchantId;
    private String buyerId;
    private String buyerName;
    private Integer rating;
    private String tags;
    private String content;
    private Instant createdAt;
}
