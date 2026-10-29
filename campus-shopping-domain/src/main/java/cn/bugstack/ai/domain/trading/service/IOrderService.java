package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.TradingStatsVO;
import java.time.Instant;
import java.util.List;

/** 订单领域能力：建单、幂等闸门、查询与支付事实；库存预占由 Checkout Case 协调。 */
public interface IOrderService {
    String beginCheckout(String user, String key, String fingerprint);
    void finishCheckout(String user, String key, String orderId);
    OrderAggregate create(String id, String buyer, String merchant, String store,
                          List<OrderItemEntity> items, Instant deadline);
    OrderAggregate order(String id, boolean lock);
    void save(OrderAggregate order);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size, String q);
    long countOrders(String buyer, String merchant, String status);
    long countOrders(String buyer, String merchant, String status, String q);
    void recordPayment(OrderAggregate order);
    void recordRefund(OrderAggregate order);
    List<String> expired();
    TradingStatsVO statistics(String merchant);
}
