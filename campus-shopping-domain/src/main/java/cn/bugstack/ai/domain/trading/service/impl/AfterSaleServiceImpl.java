package cn.bugstack.ai.domain.trading.service.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.domain.trading.adapter.repository.IAfterSaleRepository;
import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** AfterSale 领域能力；跨领域事务由 Case 编排。 */
@Service
public class AfterSaleServiceImpl implements IAfterSaleService {

    private final IAfterSaleRepository repository;
    private final Clock clock;

    public AfterSaleServiceImpl(IAfterSaleRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public List<AfterSaleVO> afterSalesByOrders(List<String> orders) {
        require(orders != null && orders.size() <= 100, ResponseCode.ILLEGAL_PARAMETER);
        return repository.afterSalesByOrders(orders);
    }

    public long countAfterSales(String buyer, String merchant, String status) {
        return repository.countAfterSales(buyer, merchant, AfterSaleStatusEnumVO.filter(status));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public AfterSaleVO afterSaleForUpdate(String order) {
        return repository.afterSale(order, true);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public AfterSaleVO requestAfterSale(OrderAggregate order, String buyer, String reason) {
        AfterSaleVO previous = repository.afterSale(order.getId(), true);
        AfterSaleVO result = AfterSaleAggregate.request(order, buyer, reason, previous, UUID.randomUUID().toString(), clock.instant());
        if (previous == null) repository.insertAfterSale(result);
        return result;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void rejectAfterSale(String order, String reason) {
        AfterSaleAggregate aggregate = requireAfterSale(order);
        aggregate.reject(reason);
        saveAfterSale(aggregate);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void appeal(OrderAggregate order, String buyer) {
        AfterSaleAggregate aggregate = requireAfterSale(order.getId());
        aggregate.appeal(order, buyer);
        saveAfterSale(aggregate);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void approveAfterSale(String order, String reason) {
        AfterSaleAggregate aggregate = requireAfterSale(order);
        aggregate.approve(reason);
        saveAfterSale(aggregate);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requirePickupAllowed(String order) {
        AfterSaleVO value = repository.afterSale(order, true);
        if (value != null) new AfterSaleAggregate(value).requirePickupAllowed();
    }

    private AfterSaleAggregate requireAfterSale(String order) {
        AfterSaleVO value = repository.afterSale(order, true);
        require(value != null, ResponseCode.NOT_FOUND);
        return new AfterSaleAggregate(value);
    }

    private void saveAfterSale(AfterSaleAggregate aggregate) {
        AfterSaleVO value = aggregate.view();
        repository.saveAfterSale(value.id(), value.status(), value.decisionReason());
    }

    public List<AfterSaleVO> afterSales(String buyer, String merchant, String status, int page, int size) {
        return repository.afterSales(buyer, merchant, AfterSaleStatusEnumVO.filter(status), offset(page, size), size);
    }
}
