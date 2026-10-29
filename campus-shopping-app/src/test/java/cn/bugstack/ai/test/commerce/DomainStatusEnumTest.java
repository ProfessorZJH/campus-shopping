package cn.bugstack.ai.test.commerce;

import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.*;
import cn.bugstack.ai.domain.fulfillment.model.aggregate.PickupAggregate;
import cn.bugstack.ai.domain.fulfillment.model.valobj.*;
import cn.bugstack.ai.domain.inventory.model.valobj.*;
import cn.bugstack.ai.domain.merchant.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.model.aggregate.ProposalAggregate;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.trading.model.valobj.*;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** PR1 回归：领域强类型状态与原有 MySQL/HTTP 字符串码必须兼容。 */
class DomainStatusEnumTest {
    private static final Instant NOW = Instant.parse("2026-10-29T00:00:00Z");

    @Test
    void enumCodesRemainUnchangedAcrossBoundaries() {
        assertEquals("PAID", OrderStatusEnumVO.PAID.name());
        assertEquals("PUBLISHED", ProductStatusEnumVO.PUBLISHED.name());
        assertEquals("ACTIVE", SkuStatusEnumVO.ACTIVE.name());
        assertEquals("RESERVED", ReservationStatusEnumVO.RESERVED.name());
        assertEquals("REPLENISH", StockMovementTypeEnumVO.REPLENISH.name());
        assertEquals("READY", PickupStatusEnumVO.READY.name());
        assertEquals("DISPUTED", AfterSaleStatusEnumVO.DISPUTED.name());
        assertEquals("CONFIRMED", ProposalStatusEnumVO.CONFIRMED.name());
        assertEquals("SUSPENDED", MerchantStatusEnumVO.SUSPENDED.name());

        assertSame(OrderStatusEnumVO.PAID, OrderStatusEnumVO.fromCode("PAID"));
        assertSame(ReservationStatusEnumVO.CONSUMED, ReservationStatusEnumVO.fromCode("CONSUMED"));
        assertThrows(AppException.class, () -> OrderStatusEnumVO.fromCode("PAYED"));
        assertThrows(AppException.class, () -> OrderStatusEnumVO.fromCode(null));
        assertThrows(AppException.class, () -> ProductStatusEnumVO.fromCode("INVALID"));
    }

    @Test
    void orderStateMachineUsesEnumInternallyAndStringExternally() {
        OrderAggregate order = new OrderAggregate("order-1", "buyer", "merchant", "store",
                List.of(new OrderItemEntity("sku-1", "中性笔", "黑色", 1200L, 1)),
                "PENDING_PAYMENT", NOW.plusSeconds(900), NOW);
        assertEquals(OrderStatusEnumVO.PENDING_PAYMENT, order.getStatusEnum());
        assertTrue(order.pay(NOW));
        assertEquals("PAID", order.getStatus());
        assertFalse(order.pay(NOW));
        order.complete();
        assertEquals(OrderStatusEnumVO.COMPLETED, order.getStatusEnum());
        assertThrows(AppException.class, order::refund);
        assertThrows(AppException.class, () -> new OrderAggregate("bad", "buyer", "merchant",
                "store", order.getItems(), "UNKNOWN", NOW.plusSeconds(900), NOW));
    }

    @Test
    void catalogRequiresActiveSkuAndRetainsExternalStrings() {
        ProductAggregate product = new ProductAggregate("product", "merchant", "store", "中性笔",
                "", "stationery", "", "DRAFT", 0,
                List.of(new ProductSkuEntity("sku", "黑色", 500L, "ACTIVE", 0)));
        assertEquals(ProductStatusEnumVO.DRAFT, product.getStatusEnum());
        product.publish();
        assertEquals("PUBLISHED", product.getStatus());
        product.unpublish();
        assertEquals(ProductStatusEnumVO.UNPUBLISHED, product.getStatusEnum());
        ProductAggregate inactive = new ProductAggregate("inactive", "merchant", "store", "中性笔",
                "", "stationery", "", "DRAFT", 0,
                List.of(new ProductSkuEntity("sku-inactive", "黑色", 500L, "INACTIVE", 0)));
        assertThrows(AppException.class, inactive::publish);
        assertThrows(AppException.class,
                () -> new ProductSkuEntity("sku", "黑色", 100L, "UNKNOWN", 0));
        assertThrows(AppException.class,
                () -> new SkuOfferVO("sku", "product", "merchant", "store", "中性笔",
                        "黑色", 500L, 0, "NOT_ON_SHELF", "ACTIVE", "", ""));
    }

    @Test
    void reservationAndMovementRejectUnknownPersistedStates() {
        ReservationVO reserved = new ReservationVO("order", "store", "sku", 1, "RESERVED");
        assertEquals(ReservationStatusEnumVO.RESERVED, reserved.statusEnum());
        StockMovementVO movement = new StockMovementVO("m1", "sku", "CONSUME", 1, "order", NOW);
        assertEquals(StockMovementTypeEnumVO.CONSUME, movement.typeEnum());
        assertThrows(AppException.class, () -> new ReservationVO("order", "store", "sku", 1, "PAID"));
        assertThrows(AppException.class,
                () -> new StockMovementVO("m1", "sku", "REFUND", 1, "order", NOW));
    }

    @Test
    void pickupStatusAndTokenRemainSingleUse() {
        PickupAggregate pickup = new PickupAggregate(new PickupVO("pick", "order", "merchant",
                "store", "buyer", "WAIT_PREP", null, null));
        pickup.ready();
        assertEquals(PickupStatusEnumVO.READY, pickup.view().statusEnum());
        pickup.issue("test-only-token", NOW.plusSeconds(1200));
        assertTrue(pickup.verify("test-only-token", NOW));
        assertFalse(pickup.verify("test-only-token", NOW));
        assertEquals("COMPLETED", pickup.view().status());
        assertThrows(AppException.class, pickup::cancel);
        assertThrows(AppException.class,
                () -> new PickupVO("pick", "order", "merchant", "store", "buyer", "NOT_READY", null, null));
    }

    @Test
    void proposalAndAfterSaleHaveValidatedStateCodes() {
        ProposalAggregate proposal = new ProposalAggregate("buyer", NOW.plusSeconds(600), "PENDING", null);
        assertTrue(proposal.confirm("buyer", "hash", NOW));
        assertFalse(proposal.confirm("buyer", "hash", NOW));
        assertEquals("CONFIRMED", proposal.getStatus());
        assertThrows(AppException.class, () -> proposal.confirm("buyer", "other", NOW));

        ProposalVO view = new ProposalVO("proposal", "buyer", "chat", "PENDING",
                List.of(), null, NOW.plusSeconds(600));
        assertEquals(ProposalStatusEnumVO.PENDING, view.statusEnum());
        AfterSaleVO afterSale = new AfterSaleVO("after", "order", "buyer", "merchant",
                "REQUESTED", "未提货", "", NOW);
        assertEquals(AfterSaleStatusEnumVO.REQUESTED, afterSale.statusEnum());
        assertThrows(AppException.class, () -> new ProposalVO("p", "u", "c", "UNKNOWN",
                List.of(), null, NOW));
        assertThrows(AppException.class, () -> new AfterSaleVO("a", "o", "u", "m",
                "REFUNDED", "原因", "", NOW));
    }

    @Test
    void merchantStatusIsValidatedWithoutChangingReadModelContract() {
        MerchantVO merchant = new MerchantVO("m", "app", "文具店", "文具", "ACTIVE",
                "store", "一号店", "图书馆");
        assertEquals(MerchantStatusEnumVO.ACTIVE, merchant.statusEnum());
        assertEquals("ACTIVE", merchant.status());
        assertThrows(AppException.class,
                () -> new MerchantVO("m", "app", "文具店", "文具", "PAUSED",
                        "store", "一号店", "图书馆"));
    }
}
