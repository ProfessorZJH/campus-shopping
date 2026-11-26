package cn.bugstack.ai.domain.trading.service;

import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import java.time.*;
import java.util.*;

/** 按业务能力限定的领域端口。 */
public interface IOrderQueryService {
    OrderAggregate order(String id);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size);
    List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size, String q);

    default List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size, String q, Instant since) {
        return orders(buyer, merchant, status, page, size, q);
    }

    long countOrders(String buyer, String merchant, String status);
    long countOrders(String buyer, String merchant, String status, String q);

    default long countOrders(String buyer, String merchant, String status, String q, Instant since) {
        return countOrders(buyer, merchant, status, q);
    }

    List<OrderAggregate> ordersByPickupState(String buyer, String merchant, String status, int page, int size, String q, String pickupState);
    long countOrdersByPickupState(String buyer, String merchant, String status, String q, String pickupState);
    List<String> expired();
    List<String> expiredAfter(String after, int limit);
    Instant oldestExpired();
    TradingStatsVO statistics(String merchant);
    OperationsStatisticsVO operationsStatistics(String merchant, Instant start, Instant end, Instant asOf, String timezone);

    default List<OrderReviewVO> reviewsByProduct(String productId, int limit) {
        return List.of();
    }

    default Set<String> reviewedOrderIds(List<String> orderIds) {
        return Set.of();
    }

    /** 多实例下协调逾期关单扫描；无共享锁时直接执行。 */
    default boolean coordinateExpiryScan(Runnable task) {
        task.run();
        return true;
    }
}
