package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.domain.trading.service.IOrderQueryService;
import cn.bugstack.ai.trigger.job.OrderExpiryJob;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.test.util.ReflectionTestUtils;

class OrderExpiryDiagnosticsTest {

    @Test
    void overdueBacklogIsLoggedEveryScanWhileIdleScansAreSampled() {
        var query = mock(IOrderQueryService.class);
        var job = new OrderExpiryJob();
        ReflectionTestUtils.setField(job, "trading", query);
        ReflectionTestUtils.setField(job, "lifecycle", mock(IOrderLifecycleCase.class));
        when(query.expiredAfter("", 100)).thenReturn(List.of());
        var logger = (Logger) LoggerFactory.getLogger(OrderExpiryJob.class);
        var capture = new ListAppender<ILoggingEvent>();
        capture.start();
        logger.addAppender(capture);
        try {
            for (int scan = 0; scan < 101; scan++) {
                job.closeExpired();
            }
            when(query.oldestExpired()).thenReturn(Instant.now().minusSeconds(60));
            job.closeExpired();
            job.closeExpired();

            var messages = capture.list
                .stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(message -> message.startsWith("order_expiry_scan "))
                .toList();
            assertEquals(4, messages.size());
            assertTrue(messages.get(0).contains("oldest_overdue_seconds=0 "));
            assertTrue(messages.get(1).contains("oldest_overdue_seconds=0 "));
            assertFalse(messages.get(2).contains("oldest_overdue_seconds=0 "));
            assertFalse(messages.get(3).contains("oldest_overdue_seconds=0 "));
        } finally {
            logger.detachAppender(capture);
            capture.stop();
        }
    }

    @Test
    void scanAndItemFailuresNeverLogDownstreamBodiesOrStackTraces() {
        var query = mock(IOrderQueryService.class);
        var life = mock(IOrderLifecycleCase.class);
        var job = new OrderExpiryJob();
        ReflectionTestUtils.setField(job, "trading", query);
        ReflectionTestUtils.setField(job, "lifecycle", life);
        var logger = (Logger) LoggerFactory.getLogger(OrderExpiryJob.class);
        var capture = new ListAppender<ILoggingEvent>();
        capture.start();
        logger.addAppender(capture);
        try {
            when(query.expiredAfter("", 100)).thenReturn(List.of("order"));
            doThrow(new IllegalStateException("PRIVATE downstream body api_key=secret")).when(life).expire("order");
            job.closeExpired();
            when(query.oldestExpired()).thenThrow(new IllegalStateException("PRIVATE database password"));
            job.closeExpired();
            assertEquals(2, job.failures());
            var failures = capture.list
                .stream()
                .filter(e -> e.getLevel().isGreaterOrEqual(ch.qos.logback.classic.Level.WARN))
                .toList();
            assertEquals(2, failures.size());
            for (var event : failures) {
                assertNull(event.getThrowableProxy());
                assertTrue(event.getFormattedMessage().contains("IllegalStateException"));
                assertFalse(event.getFormattedMessage().contains("PRIVATE"));
                assertFalse(event.getFormattedMessage().contains("secret"));
                assertFalse(event.getFormattedMessage().contains("password"));
            }
        } finally {
            logger.detachAppender(capture);
            capture.stop();
        }
    }
}
