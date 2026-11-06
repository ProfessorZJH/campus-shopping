package cn.bugstack.ai.cases.trading.impl;

import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.model.*;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderEventVO;
import cn.bugstack.ai.domain.trading.model.valobj.TradingStatsVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleQueryService;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.domain.trading.service.IOrderQueryService;
import cn.bugstack.ai.types.common.Checks;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 每页固定批量加载，权限检查先于批量明细读取；同事务保持一致读快照。 */
@Service
@Transactional(readOnly = true)
public class OrderQueryCaseImpl implements IOrderQueryCase {

    private final IOrderQueryService orders;
    private final IAfterSaleQueryService afterSales;
    private final IFulfillmentService fulfillment;
    private final IOrderEventService events;
    private final IMerchantService merchants;
    private final IAccessService access;
    private final IUserAccountService accounts;

    public OrderQueryCaseImpl(
        IOrderQueryService orders,
        IAfterSaleQueryService afterSales,
        IFulfillmentService fulfillment,
        IOrderEventService events,
        IMerchantService merchants,
        IAccessService access,
        IUserAccountService accounts
    ) {
        this.orders = orders;
        this.afterSales = afterSales;
        this.fulfillment = fulfillment;
        this.events = events;
        this.merchants = merchants;
        this.access = access;
        this.accounts = accounts;
    }

    public OrderPage mine(String actor, String state, int page, int size) {
        accounts.requireActive(actor);
        return page(actor, null, state, page, size, "");
    }

    public OrderPage merchant(String actor, String merchant, String state, int page, int size, String q) {
        access.requirePermission(actor, merchant, "order.read");
        return page(null, merchant, state, page, size, q);
    }

    @Override
    public OrderPage merchant(String actor, String merchant, String state, int page, int size, String q, String pickupState) {
        access.requirePermission(actor, merchant, "order.read");
        return page(null, merchant, state, page, size, q, pickupState);
    }

    public OrderPage platform(String actor, String state, int page, int size, String q) {
        access.requireAdmin(actor);
        return page(null, null, state, page, size, q);
    }

    private OrderPage page(String buyer, String merchant, String state, int page, int size, String q) {
        return page(buyer, merchant, state, page, size, q, "");
    }

    private OrderPage page(String buyer, String merchant, String state, int page, int size, String q, String pickupState) {
        if (pickupState == null || pickupState.isBlank()) {
            return new OrderPage(views(orders.orders(buyer, merchant, state, page, size, q)), orders.countOrders(buyer, merchant, state, q));
        }
        return new OrderPage(
            views(orders.ordersByPickupState(buyer, merchant, state, page, size, q, pickupState)),
            orders.countOrdersByPickupState(buyer, merchant, state, q, pickupState)
        );
    }

    public OrderReadModel detail(String actor, String id) {
        accounts.requireActive(actor);
        OrderAggregate order = orders.order(id);
        if (!actor.equals(order.getBuyerId()) && !access.isAdmin(actor)) access.requirePermission(actor, order.getMerchantId(), "order.read");
        return view(order);
    }

    public OrderReadModel view(OrderAggregate order) {
        return views(List.of(order)).get(0);
    }

    public TradingStatsVO statistics(String actor, String merchant) {
        if (merchant == null) access.requireAdmin(actor);
        else access.requirePermission(actor, merchant, "dashboard.read");
        return orders.statistics(merchant);
    }

    @Override
    public List<AfterSaleVO> merchantAfterSales(String actor, String merchant, String state, int page, int size) {
        access.requirePermission(actor, merchant, "aftersale.read");
        return afterSales.afterSales(null, merchant, state, page, size);
    }

    @Override
    public long countMerchantAfterSales(String actor, String merchant, String state) {
        access.requirePermission(actor, merchant, "aftersale.read");
        return afterSales.countAfterSales(null, merchant, state);
    }

    /** 售后审阅者只需 aftersale.read 即可读取该订单的真实处理历程，不扩大到订单详情。 */
    @Override
    public List<OrderEventVO> merchantAfterSaleHistory(String actor, String merchant, String orderId) {
        access.requirePermission(actor, merchant, "aftersale.read");
        OrderAggregate order = orders.order(orderId);
        Checks.require(order != null && merchant.equals(order.getMerchantId()), ResponseCode.NOT_FOUND);
        Checks.require(!afterSales.afterSalesByOrders(List.of(orderId)).isEmpty(), ResponseCode.NOT_FOUND);
        return events.events(orderId);
    }

    @Override
    public List<AfterSaleVO> platformAfterSales(String actor, String state, int page, int size) {
        access.requireAdmin(actor);
        return afterSales.afterSales(null, null, state, page, size);
    }

    @Override
    public long countPlatformAfterSales(String actor, String state) {
        access.requireAdmin(actor);
        return afterSales.countAfterSales(null, null, state);
    }

    private List<OrderReadModel> views(List<OrderAggregate> page) {
        if (page.isEmpty()) return List.of();
        var ids = page.stream().map(OrderAggregate::getId).toList();
        var pickups = fulfillment
            .pickupsByOrders(ids)
            .stream()
            .collect(Collectors.toMap(PickupVO::orderId, p -> p));
        var refunds = afterSales
            .afterSalesByOrders(ids)
            .stream()
            .collect(Collectors.toMap(AfterSaleVO::orderId, a -> a));
        var names = merchants
            .findAll(page.stream().map(OrderAggregate::getMerchantId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(MerchantVO::id, MerchantVO::name));
        var timelines = events.eventsByOrders(ids);
        return page
            .stream()
            .map(o -> {
                String name = names.get(o.getMerchantId());
                if (name == null) throw new IllegalStateException("订单所属商户丢失");
                return new OrderReadModel(o, name, pickups.get(o.getId()), refunds.get(o.getId()), timelines.getOrDefault(o.getId(), List.of()));
            })
            .toList();
    }
}
