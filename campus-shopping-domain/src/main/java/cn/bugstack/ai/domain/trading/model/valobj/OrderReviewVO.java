package cn.bugstack.ai.domain.trading.model.valobj;

import java.time.Instant;

/** 订单完成后的买家真实评价。 */
public record OrderReviewVO(
    String id,
    String orderId,
    String productId,
    String merchantId,
    String buyerId,
    String buyerName,
    int rating,
    String tags,
    String content,
    Instant createdAt
) {
    public OrderReviewVO {
        tags = tags == null ? "" : tags;
    }
}
