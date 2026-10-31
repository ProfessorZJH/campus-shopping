package cn.bugstack.ai.trigger.job;

import cn.bugstack.ai.cases.trading.IOrderLifecycleCase;
import cn.bugstack.ai.domain.trading.service.IOrderQueryService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 每条候选在独立用例事务中重新检查截止时间和状态，多个实例重复扫描仍安全。 */
@Slf4j
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "campus.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class OrderExpiryJob {

    @Resource
    private IOrderQueryService trading;

    @Resource
    private IOrderLifecycleCase lifecycle;

    private String cursor = "";
    private final java.util.concurrent.atomic.AtomicLong failures = new java.util.concurrent.atomic.AtomicLong();

    public long failures() {
        return failures.get();
    }

    @Scheduled(fixedDelayString = "${campus.order.expiry-scan-ms:15000}")
    public synchronized void closeExpired() {
        try {
            var oldest = trading.oldestExpired();
            log.info(
                "order_expiry_scan oldest_overdue_seconds={} failure_total={}",
                oldest == null ? 0 : Math.max(0, java.time.Duration.between(oldest, java.time.Instant.now()).toSeconds()),
                failures.get()
            );
            // 每轮最多2000笔；游标跨轮保留，失败旧单不会长期占据第一页。重启可安全重扫。
            for (int batch = 0; batch < 20; batch++) {
                var ids = trading.expiredAfter(cursor, 100);
                for (String id : ids) {
                    try {
                        lifecycle.expire(id);
                    } catch (Exception error) {
                        failures.incrementAndGet();
                        log.warn("order_expiry_failed diagnostic={}", cn.bugstack.ai.types.common.FailureDiagnostics.describe(error));
                    }
                    cursor = id;
                }
                if (ids.size() < 100) {
                    cursor = "";
                    return;
                }
            }
        } catch (Exception error) {
            failures.incrementAndGet();
            log.error("order_expiry_scan_failed diagnostic={}", cn.bugstack.ai.types.common.FailureDiagnostics.describe(error));
        }
    }
}
