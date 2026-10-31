package cn.bugstack.ai.cases.trading.impl;

import static cn.bugstack.ai.types.common.Checks.*;

import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.model.OrderReadModel;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupTokenVO;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderStatusEnumVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 跨域写入不吞异常；事务代理回滚后才由 Controller 转换失败响应。 */
@Service
public class OrderLifecycleCaseImpl implements IOrderLifecycleCase {

    private final IOrderService trading;
    private final IAfterSaleService afterSales;
    private final IFulfillmentService fulfillment;
    private final IInventoryService inventory;
    private final IAccessService access;
    private final IUserAccountService accounts;
    private final IMerchantService merchants;
    private final IOrderQueryCase query;
    private final Clock clock;

    public OrderLifecycleCaseImpl(
        IOrderService trading,
        IAfterSaleService afterSales,
        IFulfillmentService fulfillment,
        IInventoryService inventory,
        IAccessService access,
        IUserAccountService accounts,
        IMerchantService merchants,
        IOrderQueryCase query,
        Clock clock
    ) {
        this.trading = trading;
        this.afterSales = afterSales;
        this.fulfillment = fulfillment;
        this.inventory = inventory;
        this.access = access;
        this.accounts = accounts;
        this.merchants = merchants;
        this.query = query;
        this.clock = clock;
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel pay(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        o.requireBuyer(buyer);
        if (o.pay(clock.instant())) {
            merchants.requireActiveForNewTrade(o.getMerchantId());
            trading.recordPayment(o);
            fulfillment.create(id, o.getMerchantId(), o.getStoreId(), buyer);
            trading.save(o);
        }
        return query.view(o);
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel cancel(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        o.requireBuyer(buyer);
        if (o.cancel()) {
            inventory.release(id);
            trading.save(o);
        }
        return query.view(o);
    }

    @Transactional(rollbackFor = Exception.class)
    public void expire(String id) {
        OrderAggregate o = trading.orderForUpdate(id);
        if (o.expire(clock.instant())) {
            inventory.release(id);
            trading.save(o);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void startPreparing(String actor, String merchant, String id) {
        prepare(actor, merchant, id, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public void markReady(String actor, String merchant, String id) {
        prepare(actor, merchant, id, true);
    }

    private void prepare(String actor, String merchant, String id, boolean ready) {
        access.requirePermission(actor, merchant, "order.prepare");
        OrderAggregate o = trading.orderForUpdate(id);
        require(o.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        require(o.state() == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        if (ready) fulfillment.markReady(id);
        else fulfillment.startPreparing(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public PickupTokenVO issuePickupToken(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        o.requireBuyer(buyer);
        require(o.state() == OrderStatusEnumVO.PAID, ResponseCode.ORDER_STATE_INVALID);
        requireNoPendingRefund(id);
        return fulfillment.issue(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderReadModel verifyPickup(String actor, String merchant, String id, String token) {
        access.requirePermission(actor, merchant, "pickup.verify");
        OrderAggregate o = trading.orderForUpdate(id);
        require(o.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        require(o.state() == OrderStatusEnumVO.PAID || o.state() == OrderStatusEnumVO.COMPLETED, ResponseCode.ORDER_STATE_INVALID);
        requireNoPendingRefund(id);
        if (fulfillment.verify(id, token, actor)) {
            inventory.consume(id);
            o.complete();
            trading.save(o);
            access.audit(actor, "PICKUP_COMPLETED", id, merchant, "凭证核销成功");
        }
        return query.view(o);
    }

    private void requireNoPendingRefund(String order) {
        afterSales.requirePickupAllowed(order);
    }

    @Transactional(rollbackFor = Exception.class)
    public AfterSaleVO requestRefund(String buyer, String id, String reason) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        return afterSales.requestAfterSale(o, buyer, reason);
    }

    @Transactional(rollbackFor = Exception.class)
    public void appeal(String buyer, String id) {
        accounts.requireActive(buyer);
        OrderAggregate o = trading.orderForUpdate(id);
        afterSales.appeal(o, buyer);
    }

    @Transactional(rollbackFor = Exception.class)
    public void merchantApproveRefund(String actor, String merchant, String id, String reason) {
        merchantDecideRefund(actor, merchant, id, true, reason);
    }

    @Transactional(rollbackFor = Exception.class)
    public void merchantRejectRefund(String actor, String merchant, String id, String reason) {
        merchantDecideRefund(actor, merchant, id, false, reason);
    }

    private void merchantDecideRefund(String actor, String merchant, String id, boolean approved, String reason) {
        access.requirePermission(actor, merchant, "aftersale.review");
        decideRefund(actor, merchant, id, approved, reason, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public void platformApproveRefund(String actor, String id, String reason) {
        platformDecideRefund(actor, id, true, reason);
    }

    @Transactional(rollbackFor = Exception.class)
    public void platformRejectRefund(String actor, String id, String reason) {
        platformDecideRefund(actor, id, false, reason);
    }

    private void platformDecideRefund(String actor, String id, boolean approved, String reason) {
        access.requireAdmin(actor);
        decideRefund(actor, null, id, approved, reason, true);
    }

    private void decideRefund(String actor, String merchant, String id, boolean approved, String reason, boolean platform) {
        OrderAggregate o = trading.orderForUpdate(id);
        if (!platform) require(o.getMerchantId().equals(merchant), ResponseCode.AUTH_FORBIDDEN);
        AfterSaleVO a = afterSales.afterSaleForUpdate(id);
        require(a != null, ResponseCode.NOT_FOUND);
        if (a.state() == AfterSaleStatusEnumVO.APPROVED && o.state() == OrderStatusEnumVO.REFUNDED && approved) return;
        require(o.state() == OrderStatusEnumVO.PAID, ResponseCode.REFUND_STATE_INVALID);
        AfterSaleAggregate review = new AfterSaleAggregate(a);
        if (platform) review.requirePlatformReview();
        else review.requireMerchantReview();
        if (approved) {
            afterSales.approveAfterSale(id, reason);
            fulfillment.cancel(id);
            inventory.release(id);
            trading.recordRefund(o);
            o.refund();
            trading.save(o);
        } else if (!afterSales.rejectAfterSale(id, reason)) return;
        access.audit(actor, approved ? "REFUND_APPROVED" : "REFUND_REJECTED", id, o.getMerchantId(), text(reason, "审核意见", 500));
    }
}
