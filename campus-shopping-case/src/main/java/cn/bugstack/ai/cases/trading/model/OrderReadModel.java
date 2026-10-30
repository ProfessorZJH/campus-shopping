package cn.bugstack.ai.cases.trading.model;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** 用例层组合的订单读模型，不依赖 HTTP DTO。 */
public record OrderReadModel(
    String orderId,
    String buyerId,
    String merchantId,
    String storeId,
    String status,
    long totalCent,
    Instant deadline,
    Instant createdAt,
    List<OrderItemEntity> items,
    String merchantName,
    PickupVO pickup,
    AfterSaleVO afterSale
) {
    public OrderReadModel(OrderAggregate order, String merchantName, PickupVO pickup, AfterSaleVO afterSale) {
        this(
            order.getId(),
            order.getBuyerId(),
            order.getMerchantId(),
            order.getStoreId(),
            order.getStatus(),
            order.getTotalCent(),
            order.getDeadline(),
            order.getCreatedAt(),
            List.copyOf(order.getItems()),
            merchantName,
            pickup,
            afterSale
        );
    }

    public OrderReadModel {
        Objects.requireNonNull(orderId);
        items = List.copyOf(items);
        Objects.requireNonNull(merchantName);
        if (merchantName.isBlank()) throw new IllegalArgumentException("订单商户名不能为空");
    }
}
