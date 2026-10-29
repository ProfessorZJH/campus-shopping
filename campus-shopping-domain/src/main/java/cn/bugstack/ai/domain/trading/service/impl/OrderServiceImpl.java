package cn.bugstack.ai.domain.trading.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.trading.adapter.repository.IOrderRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Order 领域能力；跨领域事务由 Case 编排。 */
@Service
public class OrderServiceImpl implements IOrderService {

    private final IOrderRepository repository;
    private final Clock clock;

    public OrderServiceImpl(IOrderRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String beginCheckout(String user, String key, String fingerprint) {
        CheckoutRequestVO r = repository.begin(user, text(key, "幂等键", 64), fingerprint);
        require(fingerprint.equals(r.fingerprint()), ResponseCode.REQUEST_CONFLICT);
        return r.orderId();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void finishCheckout(String user, String key, String orderId) {
        repository.finishRequest(user, key, orderId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public OrderAggregate create(String id, String buyer, String merchant, String store, List<OrderItemEntity> items, Instant deadline) {
        OrderAggregate o = new OrderAggregate(id, buyer, merchant, store, items, "PENDING_PAYMENT", deadline, clock.instant());
        repository.insert(o);
        return o;
    }

    public OrderAggregate order(String id) {
        return order(id, false);
    }

    public OrderAggregate order(String id, boolean lock) {
        OrderAggregate o = repository.order(text(id, "订单编号", 64), lock);
        require(o != null, ResponseCode.NOT_FOUND);
        return o;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void save(OrderAggregate order) {
        repository.save(order);
    }

    public List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size) {
        return orders(buyer, merchant, status, page, size, "");
    }

    public List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size, String q) {
        return repository.orders(buyer, merchant, OrderStatusEnumVO.filter(status), offset(page, size), size, optional(q, 100));
    }

    public long countOrders(String buyer, String merchant, String status) {
        return countOrders(buyer, merchant, status, "");
    }

    public long countOrders(String buyer, String merchant, String status, String q) {
        return repository.countOrders(buyer, merchant, OrderStatusEnumVO.filter(status), optional(q, 100));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordPayment(OrderAggregate o) {
        repository.payment(o.getId(), o.getTotalCent());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordRefund(OrderAggregate o) {
        repository.refund(o.getId(), o.getTotalCent());
    }

    public List<String> expired() {
        return repository.expired(clock.instant());
    }

    public TradingStatsVO statistics(String merchant) {
        return repository.statistics(merchant);
    }
}
