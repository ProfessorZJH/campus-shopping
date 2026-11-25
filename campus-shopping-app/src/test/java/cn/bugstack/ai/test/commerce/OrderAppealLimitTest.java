package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.trading.IOrderQueryCase;
import cn.bugstack.ai.cases.trading.impl.OrderLifecycleCaseImpl;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleStatusEnumVO;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;
import cn.bugstack.ai.domain.trading.model.valobj.OrderEventVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleService;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.domain.trading.service.IOrderService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrderAppealLimitTest {

    @Test
    void buyerAppealIsCappedAtThreeDisputeRoundsWhileKeepingDisputedReplayIdempotent() {
        IOrderService trading = mock(IOrderService.class);
        IOrderEventService events = mock(IOrderEventService.class);
        IAfterSaleService afterSales = mock(IAfterSaleService.class);
        IFulfillmentService fulfillment = mock(IFulfillmentService.class);
        IInventoryService inventory = mock(IInventoryService.class);
        IAccessService access = mock(IAccessService.class);
        IUserAccountService accounts = mock(IUserAccountService.class);
        IMerchantService merchants = mock(IMerchantService.class);
        IOrderQueryCase query = mock(IOrderQueryCase.class);
        OrderLifecycleCaseImpl useCase = new OrderLifecycleCaseImpl(
            trading,
            events,
            afterSales,
            fulfillment,
            inventory,
            access,
            accounts,
            merchants,
            query,
            Clock.systemUTC()
        );

        OrderAggregate order = mock(OrderAggregate.class);
        when(trading.orderForUpdate("ord-1")).thenReturn(order);
        AfterSaleVO rejected = new AfterSaleVO("as-1", "ord-1", "u-1", "m-1", AfterSaleStatusEnumVO.REJECTED.getCode(), "原因", "平台驳回", Instant.now());
        AfterSaleVO disputed = new AfterSaleVO("as-1", "ord-1", "u-1", "m-1", AfterSaleStatusEnumVO.DISPUTED.getCode(), "原因", "平台驳回", Instant.now());
        OrderEventVO disputeEvent = new OrderEventVO("ev", "ord-1", "as-1", "REFUND_DISPUTED", Instant.now(), "u-1", "BUYER", "");

        // 已达 3 轮平台争议后再次从 REJECTED 申诉必须被拒绝，防止无限阻塞核销。
        when(afterSales.afterSaleForUpdate("ord-1")).thenReturn(rejected);
        when(events.events("ord-1")).thenReturn(List.of(disputeEvent, disputeEvent, disputeEvent));
        AppException thrown = assertThrows(AppException.class, () -> useCase.appeal("u-1", "ord-1"));
        assertEquals(ResponseCode.REFUND_STATE_INVALID.getCode(), thrown.getCode());
        verify(afterSales, never()).appeal(any(), anyString());

        // 已处于 DISPUTED 状态的幂等重放不受轮次上限影响，且不重复写事件。
        when(afterSales.afterSaleForUpdate("ord-1")).thenReturn(disputed);
        when(afterSales.appeal(order, "u-1")).thenReturn(disputed);
        assertDoesNotThrow(() -> useCase.appeal("u-1", "ord-1"));
        verify(events, never()).record(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
    }
}
