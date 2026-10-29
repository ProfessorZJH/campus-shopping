package cn.bugstack.ai.domain.trading.service.impl;

import cn.bugstack.ai.domain.trading.adapter.repository.IAfterSaleRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import static cn.bugstack.ai.types.common.Checks.offset;
import static cn.bugstack.ai.types.common.Checks.optional;
import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 售后领域服务：加载并持久化售后聚合，由聚合判断状态是否合法。
 * 退款与库存释放只能由 OrderLifecycleCase 在同一事务内处理。
 */
@Service
public class AfterSaleServiceImpl implements IAfterSaleService {
    private final IAfterSaleRepository repository;
    private final Clock clock;

    public AfterSaleServiceImpl(IAfterSaleRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    public long countAfterSales(String buyer, String merchant, String status) {
        return repository.countAfterSales(buyer, merchant, optional(status, 24));
    }

    @Override
    public AfterSaleVO afterSale(String order, boolean lock) {
        return repository.afterSale(order, lock);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public AfterSaleVO requestAfterSale(OrderAggregate order, String buyer, String reason) {
        // 订单行已由 Case 锁定，保证申请与核销不能同时提交。
        order.requireBuyer(buyer);
        require(order.getStatusEnum() == OrderStatusEnumVO.PAID, ResponseCode.REFUND_STATE_INVALID);
        String checkedReason = text(reason, "退款原因", 500);
        AfterSaleVO existing = repository.afterSale(order.getId(), true);
        if (existing != null) {
            AfterSaleAggregate.restore(existing).requireSameRequest(order, buyer, checkedReason);
            return existing;
        }
        AfterSaleAggregate aggregate = AfterSaleAggregate.request(
                UUID.randomUUID().toString(), order, buyer, checkedReason, clock.instant());
        AfterSaleVO view = aggregate.view();
        repository.insert(view);
        return view;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void rejectAfterSale(String order, String reason) {
        AfterSaleAggregate aggregate = required(order);
        if (aggregate.reject(reason)) {
            repository.save(aggregate.view());
        }
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void appeal(OrderAggregate order, String buyer) {
        AfterSaleAggregate aggregate = required(order.getId());
        if (aggregate.appeal(order, buyer)) {
            repository.save(aggregate.view());
        }
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void approveAfterSale(String order, String reason) {
        AfterSaleAggregate aggregate = required(order);
        aggregate.approve(reason);
        repository.save(aggregate.view());
    }

    @Override
    public List<AfterSaleVO> afterSales(String buyer, String merchant, String status,
                                       int page, int size) {
        return repository.afterSales(buyer, merchant, status, offset(page, size), size);
    }

    private AfterSaleAggregate required(String order) {
        AfterSaleVO view = repository.afterSale(order, true);
        require(view != null, ResponseCode.NOT_FOUND);
        return AfterSaleAggregate.restore(view);
    }
}
