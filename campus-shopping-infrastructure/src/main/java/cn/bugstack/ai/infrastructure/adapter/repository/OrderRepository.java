package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.trading.adapter.repository.IOrderRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.infrastructure.redis.RedisClients;
import cn.bugstack.ai.types.common.FailureDiagnostics;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import java.time.*;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Slf4j
@Repository
public class OrderRepository implements IOrderRepository {

    private static final Duration PLATFORM_ORDER_WINDOW = Duration.ofDays(365);

    @Resource
    private ITradingDao dao;

    @Autowired(required = false)
    private Clock clock;

    @Autowired(required = false)
    private ObjectProvider<RedisClients> redisClients;

    public CheckoutRequestVO begin(String user, String key, String fingerprint) {
        dao.gate(user, key, fingerprint);
        CheckoutRequestPO p = dao.request(user, key);
        return new CheckoutRequestVO(p.getUserId(), p.getRequestKey(), p.getFingerprint(), p.getOrderId());
    }

    public void finishRequest(String user, String key, String order) {
        require(dao.finishRequest(user, key, order) == 1, ResponseCode.REQUEST_CONFLICT);
    }

    public void insert(OrderAggregate o) {
        dao.insertOrder(
            OrderPO.builder()
                .id(o.getId())
                .buyerId(o.getBuyerId())
                .merchantId(o.getMerchantId())
                .storeId(o.getStoreId())
                .pickupStoreName(o.getPickupStoreName())
                .pickupLocation(o.getPickupLocation())
                .buyerRemark(o.getBuyerRemark())
                .pickupSlot(o.getPickupSlot())
                .paymentChannel(o.getPaymentChannel())
                .paymentTradeNo(o.getPaymentTradeNo())
                .totalCent(o.getTotalCent())
                .status(o.getStatus())
                .deadline(o.getDeadline())
                .createdAt(o.getCreatedAt())
                .build()
        );
        for (OrderItemEntity i : o.getItems())
            dao.insertItem(
                OrderItemPO.builder()
                    .orderId(o.getId())
                    .skuId(i.skuId())
                    .title(i.title())
                    .specKey(i.specKey())
                    .imageUrl(i.imageUrl() == null ? "" : i.imageUrl())
                    .unitPriceCent(i.unitPriceCent())
                    .quantity(i.quantity())
                    .build()
            );
    }

    public OrderAggregate order(String id, boolean lock) {
        return convert(dao.order(id, lock), lock);
    }

    public void save(OrderAggregate o) {
        require(dao.saveOrder(o.getId(), o.getStatus(), o.getPaymentChannel(), o.getPaymentTradeNo()) == 1, ResponseCode.NOT_FOUND);
    }

    public List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size) {
        return orders(buyer, merchant, status, offset, size, "");
    }

    public List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size, String q) {
        return orders(buyer, merchant, status, offset, size, q, null);
    }

    @Override
    public List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size, String q, Instant since) {
        Instant effectiveSince = since != null ? since : querySince(buyer, merchant);
        var rows = dao.orders(buyer, merchant, status, effectiveSince, offset, size, q);
        if (rows.isEmpty()) return List.of();
        var items = dao
            .itemsByOrders(rows.stream().map(OrderPO::getId).toList())
            .stream()
            .collect(java.util.stream.Collectors.groupingBy(OrderItemPO::getOrderId));
        return rows
            .stream()
            .map(p -> convert(p, items.getOrDefault(p.getId(), List.of())))
            .toList();
    }

    public long countOrders(String buyer, String merchant, String status) {
        return countOrders(buyer, merchant, status, "");
    }

    public long countOrders(String buyer, String merchant, String status, String q) {
        return countOrders(buyer, merchant, status, q, null);
    }

    @Override
    public long countOrders(String buyer, String merchant, String status, String q, Instant since) {
        Instant effectiveSince = since != null ? since : querySince(buyer, merchant);
        return dao.countOrders(buyer, merchant, status, effectiveSince, q);
    }

    private Instant querySince(String buyer, String merchant) {
        if (buyer != null || merchant != null) return Instant.EPOCH;
        Instant now = clock == null ? Instant.now() : clock.instant();
        return now.minus(PLATFORM_ORDER_WINDOW);
    }

    public List<OrderAggregate> ordersByPickupState(String buyer, String merchant, String status, int offset, int size, String q, String pickupState) {
        var rows = dao.ordersByPickupState(buyer, merchant, status, offset, size, q, pickupState);
        if (rows.isEmpty()) return List.of();
        var items = dao
            .itemsByOrders(rows.stream().map(OrderPO::getId).toList())
            .stream()
            .collect(java.util.stream.Collectors.groupingBy(OrderItemPO::getOrderId));
        return rows
            .stream()
            .map(p -> convert(p, items.getOrDefault(p.getId(), List.of())))
            .toList();
    }

    public long countOrdersByPickupState(String buyer, String merchant, String status, String q, String pickupState) {
        return dao.countOrdersByPickupState(buyer, merchant, status, q, pickupState);
    }

    public List<String> expired(Instant now) {
        return dao.expired(now);
    }

    public List<String> expiredAfter(Instant now, String after, int limit) {
        return dao.expiredAfter(now, after, limit);
    }

    public Instant oldestExpired(Instant now) {
        return dao.oldestExpired(now);
    }

    public void payment(String order, long amount) {
        dao.payment(order, amount);
    }

    public void refund(String order, long amount) {
        dao.refund(order, amount);
    }

    public TradingStatsVO statistics(String merchant) {
        TradingStatsPO p = dao.statistics(merchant);
        return new TradingStatsVO(
            p.getTotalOrders(),
            p.getPendingCount(),
            p.getPaidCount(),
            p.getCompletedCount(),
            p.getRefundedCount(),
            p.getCompletedAmountCent()
        );
    }

    public OperationsStatisticsVO operationsStatistics(String merchant, Instant start, Instant end, Instant asOf, String timezone) {
        var w = dao.statisticsWindow(merchant, start, end);
        return new OperationsStatisticsVO(
            start,
            end,
            timezone,
            asOf,
            value(w.getTotalOrders()),
            value(w.getPaidOrders()),
            value(w.getRefundedOrders()),
            value(w.getCompletedAmountCent()),
            dao
                .statisticsTrend(merchant, start, end)
                .stream()
                .map(p -> new OperationsStatisticsVO.Trend(p.getDay(), value(p.getOrderCount())))
                .toList(),
            dao
                .statisticsStatuses(merchant, start, end)
                .stream()
                .map(p -> new OperationsStatisticsVO.Status(p.getStatus(), value(p.getOrderCount()), value(p.getAmountCent())))
                .toList(),
            dao
                .statisticsProducts(merchant, start, end)
                .stream()
                .map(p -> new OperationsStatisticsVO.Product(p.getProductId(), p.getTitle(), value(p.getQuantity())))
                .toList()
        );
    }

    private long value(Long value) {
        return value == null ? 0L : value;
    }

    private OrderAggregate convert(OrderPO p) {
        return convert(p, false);
    }

    private OrderAggregate convert(OrderPO p, boolean lock) {
        if (p == null) return null;
        return convert(p, dao.items(p.getId(), lock));
    }

    private OrderAggregate convert(OrderPO p, List<OrderItemPO> rows) {
        List<OrderItemEntity> items = rows
            .stream()
            .map(i ->
                new OrderItemEntity(
                    i.getSkuId(),
                    i.getTitle(),
                    i.getSpecKey(),
                    i.getUnitPriceCent(),
                    i.getQuantity(),
                    i.getImageUrl() == null ? "" : i.getImageUrl()
                )
            )
            .toList();
        OrderAggregate order = new OrderAggregate(
            p.getId(),
            p.getBuyerId(),
            p.getMerchantId(),
            p.getStoreId(),
            p.getPickupStoreName() == null ? "" : p.getPickupStoreName(),
            p.getPickupLocation() == null ? "" : p.getPickupLocation(),
            p.getBuyerRemark() == null ? "" : p.getBuyerRemark(),
            p.getPickupSlot() == null || p.getPickupSlot().isBlank() ? "IMMEDIATE" : p.getPickupSlot(),
            p.getPaymentChannel() == null ? "" : p.getPaymentChannel(),
            p.getPaymentTradeNo() == null ? "" : p.getPaymentTradeNo(),
            items,
            p.getStatus(),
            p.getDeadline(),
            p.getCreatedAt()
        );
        require(order.getTotalCent() == p.getTotalCent(), ResponseCode.UN_ERROR);
        return order;
    }

    @Override
    public void insertReview(OrderReviewVO r) {
        dao.insertReview(
            OrderReviewPO.builder()
                .id(r.id())
                .orderId(r.orderId())
                .productId(r.productId())
                .merchantId(r.merchantId())
                .buyerId(r.buyerId())
                .buyerName(r.buyerName())
                .rating(r.rating())
                .tags(r.tags() == null ? "" : r.tags())
                .content(r.content())
                .createdAt(r.createdAt())
                .build()
        );
    }

    @Override
    public List<OrderReviewVO> reviewsByProduct(String productId, int limit) {
        return dao
            .reviewsByProduct(productId, Math.max(1, Math.min(limit, 100)))
            .stream()
            .map(p ->
                new OrderReviewVO(
                    p.getId(),
                    p.getOrderId(),
                    p.getProductId(),
                    p.getMerchantId(),
                    p.getBuyerId(),
                    p.getBuyerName(),
                    p.getRating() == null ? 5 : p.getRating(),
                    p.getTags() == null ? "" : p.getTags(),
                    p.getContent(),
                    p.getCreatedAt()
                )
            )
            .toList();
    }

    @Override
    public Set<String> reviewedOrderIds(List<String> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) return Set.of();
        return Set.copyOf(dao.reviewedOrderIds(orderIds));
    }

    @Override
    public boolean hasOrderReviews(String orderId) {
        return dao.countOrderReviews(orderId) > 0;
    }

    @Override
    public boolean coordinateExpiryScan(Runnable task) {
        RedisClients redis = redisClients == null ? null : redisClients.getIfAvailable();
        if (redis == null) {
            task.run();
            return true;
        }
        var lock = redis.security().getLock(redis.namespace() + ":lock:order-expiry-scan");
        boolean acquired;
        try {
            acquired = lock.tryLock();
        } catch (RuntimeException error) {
            log.warn("order_expiry_lock_unavailable diagnostic={}", FailureDiagnostics.describe(error));
            return false;
        }
        if (!acquired) {
            log.debug("order_expiry_scan_skipped reason=CONTENDED");
            return false;
        }
        try {
            task.run();
            return true;
        } finally {
            try {
                if (lock.isHeldByCurrentThread()) lock.unlock();
            } catch (RuntimeException error) {
                log.warn("order_expiry_unlock_failed diagnostic={}", FailureDiagnostics.describe(error));
            }
        }
    }
}
