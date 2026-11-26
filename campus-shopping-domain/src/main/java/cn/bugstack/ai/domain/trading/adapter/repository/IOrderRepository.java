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

    default long countOrders(String buyer, String merchant, String status, String q, Instant since) {
        return countOrders(buyer, merchant, status, q);
    }

    List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size, String q);

    default List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size, String q, Instant since) {
        return orders(buyer, merchant, status, offset, size, q);
    }

    List<OrderAggregate> ordersByPickupState(String buyer, String merchant, String status, int offset, int size, String q, String pickupState);
    long countOrdersByPickupState(String buyer, String merchant, String status, String q, String pickupState);
    List<String> expired(Instant now);
    List<String> expiredAfter(Instant now, String after, int limit);
    Instant oldestExpired(Instant now);
    void payment(String order, long amount);
    void refund(String order, long amount);
    TradingStatsVO statistics(String merchant);
    OperationsStatisticsVO operationsStatistics(String merchant, Instant start, Instant end, Instant asOf, String timezone);

    default void insertReview(OrderReviewVO review) {}

    default List<OrderReviewVO> reviewsByProduct(String productId, int limit) {
        return List.of();
    }

    default Set<String> reviewedOrderIds(List<String> orderIds) {
        return Set.of();
    }

    default boolean hasOrderReviews(String orderId) {
        return false;
    }

    /** 多实例下协调逾期关单扫描，避免同批行锁争抢；无分布式锁时直接执行。 */
    default boolean coordinateExpiryScan(Runnable task) {
        task.run();
        return true;
    }
}
