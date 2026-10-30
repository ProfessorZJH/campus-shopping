package cn.bugstack.ai.domain.trading.adapter.repository;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IOrderRepository {
    CheckoutRequestVO begin(String user, String key, String fingerprint);
    void finishRequest(String user, String key, String order);
    void insert(OrderAggregate order);
    OrderAggregate order(String id, boolean lock);
    void save(OrderAggregate order);
    long countOrders(String buyer, String merchant, String status);
    long countOrders(String buyer, String merchant, String status, String q);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size, String q);
    List<String> expired(Instant now);
    void payment(String order, long amount);
    void refund(String order, long amount);
    TradingStatsVO statistics(String merchant);
}
