package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.domain.shoppingai.service.KnowledgeEgressPolicy;
import cn.bugstack.ai.domain.trading.service.IOrderQueryService;
import cn.bugstack.ai.trigger.job.OrderExpiryJob;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class CapacityRecoveryTest {

    @Test
    void expiryCursorPassesFailuresAndContinuesPastPerRunLimit() {
        var trading = mock(IOrderQueryService.class);
        var lifecycle = mock(IOrderLifecycleCase.class);
        var closed = new HashSet<String>();
        var ids = java.util.stream.IntStream.range(0, 2105)
            .mapToObj(i -> String.format("o%06d", i))
            .toList();
        when(trading.expiredAfter(anyString(), eq(100))).thenAnswer(call -> {
            String after = call.getArgument(0);
            return ids
                .stream()
                .filter(id -> id.compareTo(after) > 0 && !closed.contains(id))
                .limit(100)
                .toList();
        });
        doAnswer(call -> {
            String id = call.getArgument(0);
            if (id.equals("o000000")) throw new IllegalStateException("controlled failure");
            closed.add(id);
            return null;
        })
            .when(lifecycle)
            .expire(anyString());
        var job = new OrderExpiryJob();
        ReflectionTestUtils.setField(job, "trading", trading);
        ReflectionTestUtils.setField(job, "lifecycle", lifecycle);
        job.closeExpired();
        assertEquals(1999, closed.size());
        job.closeExpired();
        assertEquals(2104, closed.size());
        assertEquals(1, job.failures());
        doAnswer(call -> {
            closed.add(call.getArgument(0));
            return null;
        })
            .when(lifecycle)
            .expire("o000000");
        job.closeExpired();
        assertEquals(2105, closed.size());
        verify(trading, never()).expired();
    }

    @Test
    void internalEgressRequiresBaseAndMerchantApproval() {
        var denied = new KnowledgeEgressPolicy("", "");
        assertTrue(denied.allows("PUBLIC", "base", "merchant"));
        assertFalse(denied.allows("MERCHANT_INTERNAL", "base", "merchant"));
        assertFalse(new KnowledgeEgressPolicy("base", "").allows("MERCHANT_INTERNAL", "base", "merchant"));
        var allowed = new KnowledgeEgressPolicy("base", "merchant");
        assertTrue(allowed.allows("MERCHANT_INTERNAL", "base", "merchant"));
        assertFalse(allowed.allows("MERCHANT_INTERNAL", "other-base", "merchant"));
        assertFalse(allowed.allows("MERCHANT_INTERNAL", "base", "other-merchant"));
        assertTrue(allowed.allows("PLATFORM_INTERNAL", "base", null));
        assertFalse(allowed.allows("UNKNOWN", "base", null));
        assertFalse(allowed.allows("MERCHANT_INTERNAL", "base", null));
    }
}
