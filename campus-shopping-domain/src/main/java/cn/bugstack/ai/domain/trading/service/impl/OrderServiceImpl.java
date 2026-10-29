package cn.bugstack.ai.domain.trading.service.impl;

import cn.bugstack.ai.domain.trading.adapter.repository.IOrderRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.CheckoutRequestVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.TradingStatsVO;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import static cn.bugstack.ai.types.common.Checks.offset;
import static cn.bugstack.ai.types.common.Checks.optional;
import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 订单领域服务：维护请求幂等闸门、订单快照和模拟交易记录。
 * 跨商品核价、库存预占、订单建单由 Checkout Case 的一个事务组合。
 */
@Service
public class OrderServiceImpl implements IOrderService {
    private final IOrderRepository repository;
    private final Clock clock;

    public OrderServiceImpl(IOrderRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public String beginCheckout(String user, String key, String fingerprint) {
        CheckoutRequestVO request = repository.begin(user, text(key, "幂等键", 64), fingerprint);
        require(fingerprint.equals(request.fingerprint()), ResponseCode.REQUEST_CONFLICT);
        return request.orderId();
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void finishCheckout(String user, String key, String orderId) {
        repository.finishRequest(user, key, orderId);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public OrderAggregate create(String id, String buyer, String merchant, String store,
                                 List<OrderItemEntity> items, Instant deadline) {
        OrderAggregate order = new OrderAggregate(id, buyer, merchant, store, items,
                OrderStatusEnumVO.PENDING_PAYMENT.name(), deadline, clock.instant());
        repository.insert(order);
        return order;
    }

    @Override
    public OrderAggregate order(String id, boolean lock) {
        OrderAggregate order = repository.order(text(id, "订单编号", 64), lock);
        require(order != null, ResponseCode.NOT_FOUND);
        return order;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void save(OrderAggregate order) {
        repository.save(order);
    }

    @Override
    public List<OrderAggregate> orders(String buyer, String merchant, String status, int page, int size) {
        return orders(buyer, merchant, status, page, size, "");
    }

    @Override
    public List<OrderAggregate> orders(String buyer, String merchant, String status,
                                        int page, int size, String q) {
        return repository.orders(buyer, merchant, optional(status, 24), offset(page, size),
                size, optional(q, 100));
    }

    @Override
    public long countOrders(String buyer, String merchant, String status) {
        return countOrders(buyer, merchant, status, "");
    }

    @Override
    public long countOrders(String buyer, String merchant, String status, String q) {
        return repository.countOrders(buyer, merchant, optional(status, 24), optional(q, 100));
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordPayment(OrderAggregate order) {
        repository.payment(order.getId(), order.getTotalCent());
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordRefund(OrderAggregate order) {
        repository.refund(order.getId(), order.getTotalCent());
    }

    @Override
    public List<String> expired() {
        return repository.expired(clock.instant());
    }

    @Override
    public TradingStatsVO statistics(String merchant) {
        return repository.statistics(merchant);
    }
}
