package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.trading.impl.OrderQueryCaseImpl;
import cn.bugstack.ai.domain.fulfillment.service.IFulfillmentService;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.trading.model.valobj.OperationsStatisticsVO;
import cn.bugstack.ai.domain.trading.service.IAfterSaleQueryService;
import cn.bugstack.ai.domain.trading.service.IOrderEventService;
import cn.bugstack.ai.domain.trading.service.IOrderQueryService;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class OperationsStatisticsCaseTest {

    @Test
    void calculatesShanghaiCalendarWindowAndChecksMerchantPermission() {
        IOrderQueryService orders = mock(IOrderQueryService.class);
        IAccessService access = mock(IAccessService.class);
        Instant end = Instant.parse("2026-11-06T16:00:00Z");
        when(orders.operationsStatistics(eq("m1"), any(), any(), any(), eq("Asia/Shanghai"))).thenReturn(
            new OperationsStatisticsVO(end.minusSeconds(7 * 86400L), end, "Asia/Shanghai", end, 2, 2, 1, 1000, List.of(), List.of(), List.of())
        );
        OrderQueryCaseImpl query = new OrderQueryCaseImpl(
            orders,
            mock(IAfterSaleQueryService.class),
            mock(IFulfillmentService.class),
            mock(IOrderEventService.class),
            mock(IMerchantService.class),
            access,
            mock(IUserAccountService.class)
        );

        OperationsStatisticsVO result = query.operationsStatistics("u1", "m1", 7, "2026-11-06T16:00:00+00:00");

        assertEquals("Asia/Shanghai", result.timezone());
        verify(access).requirePermission("u1", "m1", "dashboard.read");
        verify(orders).operationsStatistics(eq("m1"), eq(Instant.parse("2026-10-30T16:00:00Z")), eq(end), any(), eq("Asia/Shanghai"));
    }

    @Test
    void rejectsUnsupportedPeriodAndFutureEnd() {
        OrderQueryCaseImpl query = new OrderQueryCaseImpl(
            mock(IOrderQueryService.class),
            mock(IAfterSaleQueryService.class),
            mock(IFulfillmentService.class),
            mock(IOrderEventService.class),
            mock(IMerchantService.class),
            mock(IAccessService.class),
            mock(IUserAccountService.class)
        );
        assertEquals("0002", assertThrows(AppException.class, () -> query.operationsStatistics("u1", "m1", 14, null)).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> query.operationsStatistics("u1", "m1", 7, "not-a-time")).getCode());
    }
}
