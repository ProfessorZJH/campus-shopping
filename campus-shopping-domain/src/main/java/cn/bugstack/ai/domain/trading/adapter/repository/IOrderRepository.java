package cn.bugstack.ai.domain.trading.adapter.repository;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.CheckoutRequestVO;
import cn.bugstack.ai.domain.trading.model.valobj.TradingStatsVO;
import java.time.Instant;
import java.util.List;

/** 本地订单聚合、结算请求闸门及模拟支付记录的持久化抽象。 */
public interface IOrderRepository {
    CheckoutRequestVO begin(String user, String key, String fingerprint);
    void finishRequest(String user, String key, String order);
    void insert(OrderAggregate order);
    OrderAggregate order(String id, boolean lock);
    void save(OrderAggregate order);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size, String q);
    long countOrders(String buyer, String merchant, String status);
    long countOrders(String buyer, String merchant, String status, String q);
    List<String> expired(Instant now);
    void payment(String order, long amount);
    void refund(String order, long amount);
    TradingStatsVO statistics(String merchant);
}
