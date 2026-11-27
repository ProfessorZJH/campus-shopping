package cn.bugstack.ai.cases.trading.model;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderEventVO;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** 用例层组合的订单读模型，不依赖 HTTP DTO。 */
public record OrderReadModel(
    String orderId,
    String buyerId,
    String merchantId,
    String storeId,
    String pickupStoreName,
    String pickupLocation,
    String buyerRemark,
    String pickupSlot,
    String paymentChannel,
    String paymentTradeNo,
    boolean reviewed,
    String status,
    long totalCent,
    Instant deadline,
    Instant createdAt,
    List<OrderItemEntity> items,
    String merchantName,
    PickupVO pickup,
    AfterSaleVO afterSale,
    List<OrderEventVO> events
) {
    public OrderReadModel(OrderAggregate order, String merchantName, PickupVO pickup, AfterSaleVO afterSale) {
        this(order, merchantName, pickup, afterSale, List.of(), false);
    }

    public OrderReadModel(OrderAggregate order, String merchantName, PickupVO pickup, AfterSaleVO afterSale, List<OrderEventVO> events) {
        this(order, merchantName, pickup, afterSale, events, false);
    }

    public OrderReadModel(OrderAggregate order, String merchantName, PickupVO pickup, AfterSaleVO afterSale, List<OrderEventVO> events, boolean reviewed) {
        this(
            order.getId(),
            order.getBuyerId(),
            order.getMerchantId(),
            order.getStoreId(),
            order.getPickupStoreName(),
            order.getPickupLocation(),
            order.getBuyerRemark(),
            order.getPickupSlot(),
            order.getPaymentChannel(),
            order.getPaymentTradeNo(),
            reviewed,
            order.getStatus(),
            order.getTotalCent(),
            order.getDeadline(),
            order.getCreatedAt(),
            List.copyOf(order.getItems()),
            merchantName,
            pickup,
            afterSale,
            List.copyOf(events)
        );
    }

    public OrderReadModel {
        Objects.requireNonNull(orderId);
        buyerRemark = buyerRemark == null ? "" : buyerRemark;
        pickupSlot = pickupSlot == null || pickupSlot.isBlank() ? "IMMEDIATE" : pickupSlot;
        paymentChannel = paymentChannel == null ? "" : paymentChannel;
        paymentTradeNo = paymentTradeNo == null ? "" : paymentTradeNo;
        items = List.copyOf(items);
        events = List.copyOf(events);
        Objects.requireNonNull(merchantName);
        if (merchantName.isBlank()) throw new IllegalArgumentException("订单商户名不能为空");
    }
}
