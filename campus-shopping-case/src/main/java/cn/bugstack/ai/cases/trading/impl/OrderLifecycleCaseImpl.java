package cn.bugstack.ai.cases.trading.impl;

import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupTokenVO;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.enums.ResponseCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.EnumSet;

import static cn.bugstack.ai.types.common.Checks.require;
import static cn.bugstack.ai.types.common.Checks.text;

/**
 * 订单生命周期跨域编排：订单行锁是支付、关单、核销、退款的竞争边界。
 * 售后聚合负责自身状态转换；真正的退款/库存/自提/订单修改必须在同一事务。
 */
@Service
public class OrderLifecycleCaseImpl implements IOrderLifecycleCase {
    private final IOrderService orders;
    private final IAfterSaleService afterSales;
    private final IFulfillmentService fulfillment;
    private final IInventoryService inventory;
    private final IAccessService access;
    private final IUserAccountService accounts;
    private final IMerchantService merchants;
    private final Clock clock;

    public OrderLifecycleCaseImpl(IOrderService orders, IAfterSaleService afterSales,
                                  IFulfillmentService fulfillment, IInventoryService inventory,
                                  IAccessService access, IUserAccountService accounts,
                                  IMerchantService merchants, Clock clock) {
        this.orders = orders;
        this.afterSales = afterSales;
        this.fulfillment = fulfillment;
        this.inventory = inventory;
        this.access = access;
        this.accounts = accounts;
        this.merchants = merchants;
        this.clock = clock;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderAggregate pay(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate order = orders.order(id, true);
        order.requireBuyer(buyer);
        if (order.pay(clock.instant())) {
            merchants.requireActiveForNewTrade(order.getMerchantId());
            orders.recordPayment(order);
            fulfillment.create(id, order.getMerchantId(), order.getStoreId(), buyer);
            orders.save(order);
        }
        return order;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderAggregate cancel(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate order = orders.order(id, true);
        order.requireBuyer(buyer);
        if (order.cancel()) {
            inventory.release(id);
            orders.save(order);
        }
        return order;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void expire(String id) {
        OrderAggregate order = orders.order(id, true);
        if (order.expire(clock.instant())) {
            inventory.release(id);
            orders.save(order);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void prepare(String actor, String merchant, String id, boolean ready) {
        access.requirePermission(actor, merchant, "order.prepare");
        OrderAggregate order = orders.order(id, true);
        require(order.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        require(order.getStatusEnum() == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        fulfillment.prepare(id, ready);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PickupTokenVO token(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate order = orders.order(id, true);
        order.requireBuyer(buyer);
        require(order.getStatusEnum() == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        requireNoPendingRefund(id);
        return fulfillment.issue(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderAggregate verify(String actor, String merchant, String id, String token) {
        access.requirePermission(actor, merchant, "pickup.verify");
        OrderAggregate order = orders.order(id, true);
        require(order.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        require(EnumSet.of(OrderStatusEnumVO.PAID, OrderStatusEnumVO.COMPLETED)
                .contains(order.getStatusEnum()), ResponseCode.ORDER_STATE_INVALID);
        requireNoPendingRefund(id);
        if (fulfillment.verify(id, token, actor)) {
            inventory.consume(id);
            order.complete();
            orders.save(order);
            access.audit(actor, "PICKUP_COMPLETED", id, merchant, "凭证核销成功");
        }
        return order;
    }

    private void requireNoPendingRefund(String orderId) {
        AfterSaleVO sale = afterSales.afterSale(orderId, true);
        require(sale == null || !EnumSet.of(AfterSaleStatusEnumVO.REQUESTED,
                        AfterSaleStatusEnumVO.DISPUTED, AfterSaleStatusEnumVO.APPROVED)
                        .contains(sale.statusEnum()),
                ResponseCode.REFUND_STATE_INVALID);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AfterSaleVO requestRefund(String buyer, String id, String reason) {
        accounts.requireActive(buyer);
        OrderAggregate order = orders.order(id, true);
        return afterSales.requestAfterSale(order, buyer, reason);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void appeal(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate order = orders.order(id, true);
        afterSales.appeal(order, buyer);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void decideRefund(String actor, String merchant, String id,
                             boolean approved, String reason, boolean platform) {
        if (platform) {
            access.requireAdmin(actor);
        } else {
            access.requirePermission(actor, merchant, "aftersale.review");
        }
        OrderAggregate order = orders.order(id, true);
        if (!platform) {
            require(order.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        }
        AfterSaleVO sale = afterSales.afterSale(id, true);
        require(sale != null, ResponseCode.NOT_FOUND);

        // 退款幂等回放：不能重复释放预占、插入退款记录或覆盖已确认订单。
        if (sale.statusEnum() == AfterSaleStatusEnumVO.APPROVED
                && order.getStatusEnum() == OrderStatusEnumVO.REFUNDED && approved) {
            return;
        }
        require(order.getStatusEnum() == OrderStatusEnumVO.PAID, ResponseCode.REFUND_STATE_INVALID);
        if (!platform) {
            require(sale.statusEnum() != AfterSaleStatusEnumVO.DISPUTED, ResponseCode.AUTH_FORBIDDEN);
        }

        if (approved) {
            afterSales.approveAfterSale(id, reason);
            fulfillment.cancel(id);
            inventory.release(id);
            orders.recordRefund(order);
            order.refund();
            orders.save(order);
        } else {
            afterSales.rejectAfterSale(id, reason);
        }
        access.audit(actor, approved ? "REFUND_APPROVED" : "REFUND_REJECTED",
                id, order.getMerchantId(), text(reason, "审核意见", 500));
    }
}
