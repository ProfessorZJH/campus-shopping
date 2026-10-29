package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;

import cn.bugstack.ai.domain.trading.model.aggregate.AfterSaleAggregate;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** PR2：售后状态机拥有自己的业务不变量，Case 不允许通过 String 直接改状态。 */
class AfterSaleAggregateTest {

    private static AfterSaleAggregate request(String id, OrderAggregate order, String buyer, String reason, Instant now) {
        return new AfterSaleAggregate(AfterSaleAggregate.request(order, buyer, reason, null, id, now));
    }

    private static final Instant NOW = Instant.parse("2026-10-29T08:00:00Z");

    private OrderAggregate paidOrder() {
        OrderAggregate order = new OrderAggregate(
            "order-1",
            "buyer",
            "merchant",
            "store",
            List.of(new OrderItemEntity("sku-1", "中性笔", "黑色", 1200, 1)),
            "PENDING_PAYMENT",
            NOW.plusSeconds(900),
            NOW
        );
        assertTrue(order.pay(NOW));
        return order;
    }

    @Test
    void requestUsesPaidOrderIdentityAndFreezesOriginalReason() {
        OrderAggregate order = paidOrder();
        AfterSaleAggregate sale = request("sale-1", order, "buyer", " 商品有问题 ", NOW);
        assertEquals("sale-1", sale.view().id());
        assertEquals("order-1", sale.view().orderId());
        assertEquals("buyer", sale.view().buyerId());
        assertEquals("merchant", sale.view().merchantId());
        assertEquals("商品有问题", sale.view().reason());
        assertEquals(AfterSaleStatusEnumVO.REQUESTED, sale.view().state());
        AfterSaleAggregate.request(order, "buyer", "商品有问题", sale.view(), "ignored", NOW);
        assertEquals(
            "T0004",
            assertThrows(AppException.class, () -> AfterSaleAggregate.request(order, "buyer", "换个理由", sale.view(), "ignored", NOW)).getCode()
        );
        assertEquals(
            "A0006",
            assertThrows(AppException.class, () -> AfterSaleAggregate.request(order, "other", "商品有问题", sale.view(), "ignored", NOW)).getCode()
        );
    }

    @Test
    void rejectAppealAndPlatformApprovalFollowOneStateMachine() {
        OrderAggregate order = paidOrder();
        AfterSaleAggregate sale = request("sale-1", order, "buyer", "未提货", NOW);
        sale.reject(" 商户认为不符合 ");
        assertEquals(AfterSaleStatusEnumVO.REJECTED, sale.view().state());
        assertEquals("商户认为不符合", sale.view().decisionReason());
        sale.reject("不能覆盖原驳回意见");
        assertEquals("商户认为不符合", sale.view().decisionReason());

        sale.appeal(order, "buyer");
        assertEquals("DISPUTED", sale.view().status());
        sale.appeal(order, "buyer");
        assertEquals("A0006", assertThrows(AppException.class, () -> sale.appeal(order, "other")).getCode());

        sale.approve(" 平台裁定同意 ");
        assertEquals("APPROVED", sale.view().status());
        assertEquals("平台裁定同意", sale.view().decisionReason());
        assertEquals("T0004", assertThrows(AppException.class, () -> sale.approve("重复裁决")).getCode());
        assertEquals("T0004", assertThrows(AppException.class, () -> sale.reject("不允许重开")).getCode());
        // 售后单批准不等于订单已退款：库存与退款必须由 Case 同事务协调。
        assertEquals("PAID", order.getStatus());
    }

    @Test
    void requestedCanBeApprovedDirectlyButCannotBeAppealedBeforeReject() {
        OrderAggregate order = paidOrder();
        AfterSaleAggregate sale = request("sale-2", order, "buyer", "改变计划", NOW);
        assertEquals("T0004", assertThrows(AppException.class, () -> sale.appeal(order, "buyer")).getCode());
        sale.approve("商户同意");
        assertEquals("APPROVED", sale.view().status());
    }

    @Test
    void rejectedRequestCannotBeReusedToCreateAnotherAfterSale() {
        OrderAggregate order = paidOrder();
        AfterSaleAggregate sale = request("sale-3", order, "buyer", "退货", NOW);
        sale.reject("驳回");
        assertEquals(
            "T0004",
            assertThrows(AppException.class, () -> AfterSaleAggregate.request(order, "buyer", "退货", sale.view(), "ignored", NOW)).getCode()
        );
    }

    @Test
    void applicationRejectsWrongBuyerUnpaidOrderAndBlankReason() {
        OrderAggregate pending = new OrderAggregate(
            "pending",
            "buyer",
            "merchant",
            "store",
            List.of(new OrderItemEntity("sku", "中性笔", "黑色", 100, 1)),
            "PENDING_PAYMENT",
            NOW.plusSeconds(900),
            NOW
        );
        assertEquals("A0006", assertThrows(AppException.class, () -> request("sale", pending, "other", "退款", NOW)).getCode());
        assertEquals("T0004", assertThrows(AppException.class, () -> request("sale", pending, "buyer", "退款", NOW)).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> request("sale", paidOrder(), "buyer", " ", NOW)).getCode());
    }

    @Test
    void restoredAggregateRetainsExistingStatusAndCanContinueAppeal() {
        OrderAggregate order = paidOrder();
        AfterSaleAggregate first = request("sale", order, "buyer", "未提货", NOW);
        first.reject("门店拒绝");
        AfterSaleAggregate reloaded = new AfterSaleAggregate(first.view());
        assertEquals(AfterSaleStatusEnumVO.REJECTED, reloaded.view().state());
        reloaded.appeal(order, "buyer");
        assertEquals("DISPUTED", reloaded.view().status());
        assertEquals("门店拒绝", reloaded.view().decisionReason());
    }
}
