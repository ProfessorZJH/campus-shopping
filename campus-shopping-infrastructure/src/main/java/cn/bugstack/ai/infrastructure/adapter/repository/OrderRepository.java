package cn.bugstack.ai.infrastructure.adapter.repository;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.domain.trading.adapter.repository.IOrderRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.ITradingDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import jakarta.annotation.Resource;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/** 本地持久化适配器；业务规则由对应领域服务维护。 */
@Repository
public class OrderRepository implements IOrderRepository {

    @Resource
    private ITradingDao dao;

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
        require(dao.saveOrder(o.getId(), o.getStatus()) == 1, ResponseCode.NOT_FOUND);
    }

    public List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size) {
        return orders(buyer, merchant, status, offset, size, "");
    }

    public List<OrderAggregate> orders(String buyer, String merchant, String status, int offset, int size, String q) {
        var rows = dao.orders(buyer, merchant, status, offset, size, q);
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
        return dao.countOrders(buyer, merchant, status, q);
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
            items,
            p.getStatus(),
            p.getDeadline(),
            p.getCreatedAt()
        );
        require(order.getTotalCent() == p.getTotalCent(), ResponseCode.UN_ERROR);
        return order;
    }
}
